// ==========================================
// YSP AI BACKEND (SMART ROUTING + LOGGING)
// ==========================================

// Store Gemini API keys in Script Properties:
// AI_CHATBOT_API_KEY, AI_CHATBOT_API_KEY_1..AI_CHATBOT_API_KEY_20

const CHATBOT_CONFIG = {
  MODEL_NAME: 'gemini-2.5-flash',
  LOGIN_SHEET_NAME_FALLBACK: 'User Profiles',
  UNKNOWN_LOG_SHEET: 'AI_Unknown_Questions',
  UNKNOWN_LOG_HEADERS: [
    'Timestamp',
    'Question',
    'NormalizedQuestion',
    'CurrentPage',
    'CurrentUrl',
    'Username',
    'ContextSnippet',
    'AIReply',
    'ReviewStatus',
    'ApprovedAnswer',
    'DBAction',
    'KnowledgeCategory',
    'TimesAsked',
    'LastAskedAt'
  ],
  REVIEW_STATUS_OPTIONS: ['Pending', 'Reviewed', 'Resolved', 'Rejected'],
  DB_ACTION_OPTIONS: ['Pending Review', 'Add to Database', 'Ignore'],
  DEFAULT_UNKNOWN_REPLY:
    'I need a bit more detail so we can answer correctly. Please include the specific page, name, event, or date.',
  MAX_CONTEXT_CHARS: 1200,
  MAX_HISTORY_ITEMS: 8,
  MAX_POST_BODY_CHARS: 60000,
  MAX_UNKNOWN_LOG_FIELD_CHARS: 500,
  DIRECTORY_GEMINI_REWRITE_ROUNDS: 2
};

var CHATBOT_RUNTIME_TRACE_ = null;

function doPost(e) {
  try {
    beginChatbotRuntimeTrace_();
    var rawData = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    if (rawData && rawData.length > CHATBOT_CONFIG.MAX_POST_BODY_CHARS) {
      return createChatbotJsonResponse_({
        reply: 'Request too large.',
        source: deriveChatbotResponseSource_(),
        code: 413
      });
    }
    var data = {};
    try {
      data = JSON.parse(rawData || '{}');
    } catch (parseError) {
      return createChatbotJsonResponse_({
        reply: 'Invalid request payload.',
        source: deriveChatbotResponseSource_(),
        code: 400
      });
    }
    var authResult = verifyChatbotRequestAuth_(data);
    if (!authResult.ok) {
      return createChatbotJsonResponse_({
        reply: authResult.error || 'Unauthorized request.',
        source: deriveChatbotResponseSource_(),
        code: authResult.code || 401
      });
    }
    data.username = authResult.username;
    var userMessage = toStringValue_(data.message);

    if (!userMessage) {
      return createChatbotJsonResponse_({
        reply: 'Please type a message.',
        source: deriveChatbotResponseSource_()
      });
    }

    var requestContext = extractChatRequestContext_(data);
    var reviewUnknownsReply = handleReviewUnknownsCommand_(userMessage, requestContext, data);
    if (reviewUnknownsReply) {
      markDatabaseUsed_();
      return createChatbotJsonResponse_({
        reply: reviewUnknownsReply,
        source: deriveChatbotResponseSource_()
      });
    }

    var cannedReply = lookupApprovedUnknownAnswer_(userMessage, requestContext.currentPage);
    if (cannedReply) {
      markDatabaseUsed_();
      return createChatbotJsonResponse_({
        reply: cannedReply,
        source: deriveChatbotResponseSource_()
      });
    }

    var directoryReply = handleDirectoryMessage(userMessage, data);
    if (directoryReply) {
      markDatabaseUsed_();
      return createChatbotJsonResponse_({
        reply: directoryReply,
        source: deriveChatbotResponseSource_()
      });
    }

    var aiResponse = callGemini(userMessage, data.context || '', requestContext, data.history || []);
    var finalReply = toStringValue_(aiResponse);
    if (!finalReply) {
      finalReply = CHATBOT_CONFIG.DEFAULT_UNKNOWN_REPLY;
    }

    if (isUnknownStyleReply_(finalReply)) {
      logUnknownQuestion_(userMessage, finalReply, requestContext);
      finalReply = CHATBOT_CONFIG.DEFAULT_UNKNOWN_REPLY;
    }

    return createChatbotJsonResponse_({
      reply: finalReply,
      source: deriveChatbotResponseSource_()
    });

  } catch (error) {
    return createChatbotJsonResponse_({
      reply: 'System Error: ' + error.toString(),
      source: deriveChatbotResponseSource_()
    });
  }
}

function beginChatbotRuntimeTrace_() {
  CHATBOT_RUNTIME_TRACE_ = {
    usedGemini: false,
    usedDatabase: false
  };
}

function markGeminiUsed_() {
  if (!CHATBOT_RUNTIME_TRACE_) beginChatbotRuntimeTrace_();
  CHATBOT_RUNTIME_TRACE_.usedGemini = true;
}

function markDatabaseUsed_() {
  if (!CHATBOT_RUNTIME_TRACE_) beginChatbotRuntimeTrace_();
  CHATBOT_RUNTIME_TRACE_.usedDatabase = true;
}

function deriveChatbotResponseSource_() {
  if (!CHATBOT_RUNTIME_TRACE_) return 'database';
  if (CHATBOT_RUNTIME_TRACE_.usedGemini && CHATBOT_RUNTIME_TRACE_.usedDatabase) return 'mixed';
  if (CHATBOT_RUNTIME_TRACE_.usedGemini) return 'gemini';
  return 'database';
}

function createChatbotJsonResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function verifyChatbotRequestAuth_(data) {
  var sessionSecret = toStringValue_(PropertiesService.getScriptProperties().getProperty('SESSION_SECRET_KEY'));
  if (!sessionSecret) {
    return {
      ok: false,
      code: 503,
      error: 'Server auth misconfigured: SESSION_SECRET_KEY is missing.'
    };
  }

  var tokenUser = verifyChatbotHmacToken_(toStringValue_(data && data.sessionToken));
  if (!tokenUser || !tokenUser.username) {
    return {
      ok: false,
      code: 401,
      error: 'Invalid or expired session token.'
    };
  }

  return { ok: true, username: tokenUser.username };
}

function verifyChatbotHmacToken_(token) {
  if (!token || typeof token !== 'string') return null;
  var secret = toStringValue_(PropertiesService.getScriptProperties().getProperty('SESSION_SECRET_KEY'));
  if (!secret) return null;
  var parts = token.split('.');
  if (parts.length !== 2) return null;
  var payload = parts[0];
  var signature = parts[1];
  var expectedSig = bytesToHexForChatbot_(Utilities.computeHmacSha256Signature(payload, secret));
  if (!constantTimeEqualsForChatbot_(signature, expectedSig)) return null;
  try {
    var decoded = Utilities.newBlob(Utilities.base64Decode(payload)).getDataAsString();
    var fields = decoded.split('|');
    if (fields.length < 2) return null;
    var username = fields[0];
    var expiry = parseInt(fields[1], 10);
    if (!username || isNaN(expiry) || new Date().getTime() > expiry) return null;
    return { username: username };
  } catch (e) {
    Logger.log('verifyChatbotHmacToken_ error: ' + e);
    return null;
  }
}

function constantTimeEqualsForChatbot_(a, b) {
  var left = toStringValue_(a);
  var right = toStringValue_(b);
  if (!left || !right) return false;
  if (left.length !== right.length) return false;
  var mismatch = 0;
  for (var i = 0; i < left.length; i++) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

function bytesToHexForChatbot_(bytes) {
  var out = [];
  for (var i = 0; i < bytes.length; i++) {
    out.push(('0' + (bytes[i] & 0xFF).toString(16)).slice(-2));
  }
  return out.join('');
}

function extractChatRequestContext_(data) {
  var contextPage = toStringValue_(data.contextPage || data.currentPage || data.page);
  var currentUrl = toStringValue_(data.currentUrl || data.url || data.path);
  var username = toStringValue_(data.username || data.user || data.actor);
  var email = toStringValue_(data.email || data.userEmail || '');
  var idCode = toStringValue_(data.idCode || data.userIdCode || data.id || '');
  var userRole = toStringValue_(data.userRole || data.role || '');
  var contextSnippet = toStringValue_(data.context || '');
  if (contextSnippet.length > CHATBOT_CONFIG.MAX_CONTEXT_CHARS) {
    contextSnippet = contextSnippet.slice(0, CHATBOT_CONFIG.MAX_CONTEXT_CHARS);
  }
  return {
    currentPage: contextPage,
    currentUrl: currentUrl,
    username: username,
    email: email,
    idCode: idCode,
    userRole: userRole,
    contextSnippet: contextSnippet
  };
}

function resolveChatbotApiKeys_() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var keys = [];

  if (props.AI_CHATBOT_API_KEY) keys.push(toStringValue_(props.AI_CHATBOT_API_KEY));
  for (var i = 1; i <= 20; i++) {
    var k = toStringValue_(props['AI_CHATBOT_API_KEY_' + i]);
    if (k) keys.push(k);
  }

  var seen = {};
  var filtered = [];
  for (var j = 0; j < keys.length; j++) {
    var key = toStringValue_(keys[j]);
    if (!key) continue;
    if (seen[key]) continue;
    seen[key] = true;
    filtered.push(key);
  }
  return filtered;
}

function buildContextBlockForPrompt_(context, history, approvedHit) {
  var lines = [];
  if (context.currentPage) lines.push('Current Page: ' + context.currentPage);
  if (context.currentUrl) lines.push('Current URL: ' + context.currentUrl);
  if (context.username) lines.push('Username: ' + context.username);
  if (context.contextSnippet) lines.push('Frontend Context: ' + context.contextSnippet);

  if (approvedHit && approvedHit.answer) {
    lines.push('Approved Internal Answer Match: ' + approvedHit.answer);
  }

  var safeHistory = Array.isArray(history) ? history.slice(-CHATBOT_CONFIG.MAX_HISTORY_ITEMS) : [];
  if (safeHistory.length > 0) {
    var historyLines = [];
    for (var i = 0; i < safeHistory.length; i++) {
      var row = safeHistory[i] || {};
      var role = toStringValue_(row.role || row.sender || 'user');
      var text = toStringValue_(row.text || row.message || '');
      if (!text) continue;
      if (text.length > 240) text = text.slice(0, 240) + '...';
      historyLines.push(role + ': ' + text);
    }
    if (historyLines.length) {
      lines.push('Recent Chat History:\n' + historyLines.join('\n'));
    }
  }

  return lines.join('\n');
}

function isUnknownStyleReply_(reply) {
  var text = toStringValue_(reply).toLowerCase();
  if (!text) return true;
  return (
    text.indexOf("i don't know") !== -1 ||
    text.indexOf('i do not know') !== -1 ||
    text.indexOf('not sure') !== -1 ||
    text.indexOf('cannot find') !== -1 ||
    text.indexOf('can\'t find') !== -1 ||
    text.indexOf('no available information') !== -1
  );
}

function normalizeQuestionForMatch_(value) {
  return toStringValue_(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeQuestion_(value) {
  var normalized = normalizeQuestionForMatch_(value);
  if (!normalized) return [];
  var parts = normalized.split(' ');
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    if (parts[i] && parts[i].length >= 2) out.push(parts[i]);
  }
  return out;
}

function computeTokenSimilarity_(a, b) {
  var aTokens = tokenizeQuestion_(a);
  var bTokens = tokenizeQuestion_(b);
  if (!aTokens.length || !bTokens.length) return 0;

  var aMap = {};
  var bMap = {};
  for (var i = 0; i < aTokens.length; i++) aMap[aTokens[i]] = true;
  for (var j = 0; j < bTokens.length; j++) bMap[bTokens[j]] = true;

  var intersection = 0;
  var union = 0;
  var seen = {};

  for (var k = 0; k < aTokens.length; k++) {
    var tokenA = aTokens[k];
    if (!seen[tokenA]) {
      seen[tokenA] = true;
      union++;
      if (bMap[tokenA]) intersection++;
    }
  }
  for (var m = 0; m < bTokens.length; m++) {
    var tokenB = bTokens[m];
    if (!seen[tokenB]) {
      seen[tokenB] = true;
      union++;
    }
  }

  if (union === 0) return 0;
  return intersection / union;
}

function getOrCreateUnknownSheet_() {
  var unknownSheetSpreadsheetId = resolveUnknownLogSpreadsheetIdForChatbot_();
  if (!unknownSheetSpreadsheetId) {
    throw new Error(
      'Chatbot spreadsheet is not configured. Set CHATBOT_UNKNOWN_LOG_SPREADSHEET_ID or LOGIN_SPREADSHEET_ID in Script Properties.'
    );
  }

  var ss = SpreadsheetApp.openById(unknownSheetSpreadsheetId);
  var sheet = ss.getSheetByName(CHATBOT_CONFIG.UNKNOWN_LOG_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CHATBOT_CONFIG.UNKNOWN_LOG_SHEET);
  }

  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, CHATBOT_CONFIG.UNKNOWN_LOG_HEADERS.length).setValues([CHATBOT_CONFIG.UNKNOWN_LOG_HEADERS]);
    sheet.getRange(1, 1, 1, CHATBOT_CONFIG.UNKNOWN_LOG_HEADERS.length).setFontWeight('bold');
  } else {
    var firstRow = sheet.getRange(1, 1, 1, CHATBOT_CONFIG.UNKNOWN_LOG_HEADERS.length).getValues()[0];
    var missing = false;
    for (var i = 0; i < CHATBOT_CONFIG.UNKNOWN_LOG_HEADERS.length; i++) {
      if (toStringValue_(firstRow[i]) !== CHATBOT_CONFIG.UNKNOWN_LOG_HEADERS[i]) {
        missing = true;
        break;
      }
    }
    if (missing) {
      sheet.getRange(1, 1, 1, CHATBOT_CONFIG.UNKNOWN_LOG_HEADERS.length).setValues([CHATBOT_CONFIG.UNKNOWN_LOG_HEADERS]);
      sheet.getRange(1, 1, 1, CHATBOT_CONFIG.UNKNOWN_LOG_HEADERS.length).setFontWeight('bold');
    }
  }

  var maxRows = sheet.getMaxRows();
  if (maxRows < 2) sheet.insertRowsAfter(1, 1);

  var reviewValidation = SpreadsheetApp.newDataValidation()
    .requireValueInList(CHATBOT_CONFIG.REVIEW_STATUS_OPTIONS, true)
    .setAllowInvalid(false)
    .build();
  var dbActionValidation = SpreadsheetApp.newDataValidation()
    .requireValueInList(CHATBOT_CONFIG.DB_ACTION_OPTIONS, true)
    .setAllowInvalid(false)
    .build();

  sheet.getRange(2, 9, Math.max(sheet.getMaxRows() - 1, 1), 1).setDataValidation(reviewValidation);
  sheet.getRange(2, 11, Math.max(sheet.getMaxRows() - 1, 1), 1).setDataValidation(dbActionValidation);

  return sheet;
}

function lookupApprovedUnknownAnswer_(question, currentPage) {
  var normalized = normalizeQuestionForMatch_(question);
  if (!normalized) return '';

  var sheet = getOrCreateUnknownSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return '';

  var rows = sheet.getRange(2, 1, lastRow - 1, CHATBOT_CONFIG.UNKNOWN_LOG_HEADERS.length).getValues();
  var bestAnswer = '';
  var bestScore = 0;

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var loggedQ = toStringValue_(row[1]);
    var normalizedQ = toStringValue_(row[2]);
    var loggedPage = toStringValue_(row[3]);
    var approvedAnswer = toStringValue_(row[9]);
    var dbAction = toStringValue_(row[10]);
    if (!approvedAnswer) continue;
    if (dbAction !== 'Add to Database') continue;

    var compareQuestion = normalizedQ || loggedQ;
    if (!compareQuestion) continue;
    var score = computeTokenSimilarity_(normalized, compareQuestion);

    if (normalizeQuestionForMatch_(compareQuestion) === normalized) {
      return approvedAnswer;
    }
    if (currentPage && loggedPage && currentPage === loggedPage) {
      score += 0.1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestAnswer = approvedAnswer;
    }
  }

  return bestScore >= 0.72 ? bestAnswer : '';
}

function logUnknownQuestion_(question, aiReply, context) {
  try {
    var sheet = getOrCreateUnknownSheet_();
    var safeQuestion = sanitizeForSheetCell_(toStringValue_(question), CHATBOT_CONFIG.MAX_UNKNOWN_LOG_FIELD_CHARS);
    var safeReply = sanitizeForSheetCell_(toStringValue_(aiReply), CHATBOT_CONFIG.MAX_UNKNOWN_LOG_FIELD_CHARS);
    var safePage = sanitizeForSheetCell_(toStringValue_(context.currentPage), 160);
    var safeUrl = sanitizeForSheetCell_(toStringValue_(context.currentUrl), 350);
    var safeUsername = sanitizeForSheetCell_(toStringValue_(context.username), 120);
    var safeSnippet = sanitizeForSheetCell_(toStringValue_(context.contextSnippet), CHATBOT_CONFIG.MAX_CONTEXT_CHARS);
    var normalized = normalizeQuestionForMatch_(safeQuestion);
    var lastRow = sheet.getLastRow();
    var nowIso = new Date().toISOString();

    if (lastRow >= 2) {
      var rows = sheet.getRange(2, 1, lastRow - 1, CHATBOT_CONFIG.UNKNOWN_LOG_HEADERS.length).getValues();
      for (var i = rows.length - 1; i >= 0; i--) {
        var row = rows[i];
        var rowNormalized = toStringValue_(row[2]);
        var rowPage = toStringValue_(row[3]);
        var dbAction = toStringValue_(row[10]);
        if (!rowNormalized || rowNormalized !== normalized) continue;
        if (rowPage !== safePage) continue;
        if (dbAction === 'Add to Database' || dbAction === 'Ignore') break;

        var targetRow = i + 2;
        var times = parseInt(String(row[12] || '1'), 10);
        if (isNaN(times) || times < 1) times = 1;
        sheet.getRange(targetRow, 13).setValue(times + 1);
        sheet.getRange(targetRow, 14).setValue(nowIso);
        return;
      }
    }

    var newRow = [
      nowIso,
      safeQuestion,
      normalized,
      safePage,
      safeUrl,
      safeUsername,
      safeSnippet,
      safeReply,
      'Pending',
      '',
      'Pending Review',
      '',
      1,
      nowIso
    ];
    sheet.appendRow(newRow);
  } catch (error) {
    Logger.log('Failed to log unknown chatbot question: ' + error);
  }
}

function handleDirectoryMessage(message, data) {
  var lower = message.toLowerCase();
  if (lower.indexOf('@clear chat history') !== -1) {
    return 'Chat history cleared.';
  }

  if (!isDirectoryRequest(message, data)) {
    return '';
  }

  try {
    var directoryData = getDirectoryData();
    var rows = directoryData.rows;
    var idx = directoryData.idx;

    if (!rows.length) {
      return 'No directory data is available right now.';
    }

    var scope = extractScopeFilters(message, rows, idx);
    var scopedRows = applyScopeFilters(rows, idx, scope);
    var scopeLabel = formatScopeLabel(scope);

    if (!scopedRows.length) {
      return 'I could not find any matching members for that scope.';
    }

    var countReply = handleCountQueries(message, scopedRows, idx, scopeLabel);
    if (countReply) return countReply;

    var targetRow = findBestMatch(message, scopedRows, idx);
    if (!targetRow) {
      var geminiHints = getGeminiDirectoryHints(message, rows, idx);
      if (geminiHints) {
        var mergedScope = mergeDirectoryScope(scope, geminiHints);
        var geminiScopedRows = applyScopeFilters(rows, idx, mergedScope);
        if (geminiScopedRows.length) {
          if (geminiHints.name) {
            targetRow = findBestMatchFromCandidate(geminiHints.name, geminiScopedRows, idx);
          }
          if (!targetRow) {
            targetRow = findBestMatch(message, geminiScopedRows, idx);
          }
        }
      }
    }

    if (!targetRow) {
      targetRow = resolveDirectoryTargetWithRewrites_(message, rows, idx, scope);
    }

    if (!targetRow) {
      return 'I could not match the member yet. Please include full name, committee, role, or chapter.';
    }

    var infoReply = handleMemberInfoQuery(message, targetRow, idx, data);
    if (infoReply) return infoReply;

    return formatMemberSummary(targetRow, idx, data);
  } catch (e) {
    Logger.log('Directory query error: ' + e.toString());
    return 'Directory search failed. Please try again.';
  }
}

function isDirectoryRequest(message, data) {
  var lower = message.toLowerCase();

  var allowedPage = isDirectoryPageContext_(data && data.contextPage ? data.contextPage : '');
  if (!allowedPage) return false;

  if (lower.indexOf('@members') !== -1 || lower.indexOf('/@members') !== -1) return true;
  return /member|members|officer|committee|role|position|chapter|barangay|birthday|email verified|unverified|gender|female|male|id code/.test(lower);
}

function isDirectoryPageContext_(pageValue) {
  var page = normalizePageKey_(pageValue);
  if (!page) return false;
  return (
    page === 'officerdirectory' ||
    page === 'officerdirectorypage' ||
    page === 'managemembers' ||
    page === 'managememberspage' ||
    page.indexOf('officerdirectory') !== -1 ||
    page.indexOf('managemembers') !== -1
  );
}

function getDirectoryData() {
  var ssId = resolveLoginSpreadsheetIdForChatbot_();
  var sheetName = resolveLoginSheetNameForChatbot_();
  if (!ssId) {
    throw new Error('LOGIN_SPREADSHEET_ID is not configured.');
  }

  var ss = SpreadsheetApp.openById(ssId);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Directory database not found.');
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0] || [];
  var idx = buildDirectoryColumnIndex(headers);
  var rows = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[idx.fullName] && !row[idx.idCode]) continue;

    var status = getDirectoryValue(row, idx.status).toLowerCase();
    var role = getDirectoryValue(row, idx.role).toLowerCase();
    if (status === 'banned' || status === 'suspended' || role === 'banned' || role === 'suspended') {
      continue;
    }

    rows.push(row);
  }

  return { rows: rows, idx: idx };
}

function extractScopeFilters(message, rows, idx) {
  var normalizedMessage = normalizeDirectoryText(message);
  var scope = {
    executiveBoardOnly: normalizedMessage.indexOf('executive board') !== -1,
    committees: [],
    roles: [],
    positions: []
  };

  var committees = collectUniqueValues(rows, idx.committee);
  var roles = collectUniqueValues(rows, idx.role);
  var positions = collectUniqueValues(rows, idx.position);

  scope.committees = matchValueScope(normalizedMessage, committees);
  scope.roles = matchValueScope(normalizedMessage, roles);
  scope.positions = matchValueScope(normalizedMessage, positions);

  return scope;
}

function collectUniqueValues(rows, colIdx) {
  var values = {};
  for (var i = 0; i < rows.length; i++) {
    var value = getDirectoryValue(rows[i], colIdx).trim();
    if (value) values[value] = true;
  }
  return Object.keys(values);
}

function matchValueScope(messageNormalized, values) {
  var matches = [];
  for (var i = 0; i < values.length; i++) {
    var normalizedValue = normalizeDirectoryText(values[i]);
    if (!normalizedValue) continue;
    if (messageNormalized.indexOf(normalizedValue) !== -1) {
      matches.push(values[i]);
    }
  }
  return matches;
}

function applyScopeFilters(rows, idx, scope) {
  var hasCommittee = scope.committees.length > 0;
  var hasRole = scope.roles.length > 0;
  var hasPosition = scope.positions.length > 0;
  var execOnly = scope.executiveBoardOnly;

  if (!hasCommittee && !hasRole && !hasPosition && !execOnly) {
    return rows;
  }

  return rows.filter(function(row) {
    var committee = getDirectoryValue(row, idx.committee);
    var role = getDirectoryValue(row, idx.role);
    var position = getDirectoryValue(row, idx.position);

    if (execOnly) {
      var execMatch =
        normalizeDirectoryText(committee).indexOf('executive board') !== -1 ||
        normalizeDirectoryText(role).indexOf('executive board') !== -1 ||
        normalizeDirectoryText(position).indexOf('executive board') !== -1;
      if (!execMatch) return false;
    }

    if (hasCommittee && scope.committees.indexOf(committee) === -1) return false;
    if (hasRole && scope.roles.indexOf(role) === -1) return false;
    if (hasPosition && scope.positions.indexOf(position) === -1) return false;
    return true;
  });
}

function formatScopeLabel(scope) {
  if (scope.executiveBoardOnly) return 'Executive Board';
  if (scope.committees.length) return scope.committees.join(', ');
  if (scope.roles.length) return scope.roles.join(', ');
  if (scope.positions.length) return scope.positions.join(', ');
  return 'all members';
}

function handleCountQueries(message, rows, idx, scopeLabel) {
  var intent = inferDirectoryAggregateIntent_(message, rows, idx);
  if (!intent || !intent.isAggregate) return '';

  var filteredRows = applyDirectoryAggregateFilters_(rows, idx, intent.filters || {});
  var memberLabel = 'members in ' + scopeLabel;

  if (!filteredRows.length) {
    return 'No members matched that filter in ' + scopeLabel + '.';
  }

  if (intent.intent === 'list') {
    var names = filteredRows.slice(0, 30).map(function(row) {
      return getDirectoryValue(row, idx.fullName);
    }).filter(Boolean);
    var extra = filteredRows.length > names.length ? ' (+' + (filteredRows.length - names.length) + ' more)' : '';
    return 'Matching ' + memberLabel + ' (' + filteredRows.length + '): ' + names.join(', ') + extra;
  }

  return 'I found ' + filteredRows.length + ' ' + memberLabel + '.';
}

function inferDirectoryAggregateIntent_(message, rows, idx) {
  var lower = toStringValue_(message).toLowerCase();
  var wantsCount = /\b(how many|count|number of|total)\b/.test(lower);
  var wantsList = /\b(who|which|list|show|display|give me)\b/.test(lower);

  var filters = {
    gender: detectGenderFilter_(lower),
    emailVerified: detectEmailVerificationFilter_(lower),
    barangay: findKnownValueMention_(message, collectUniqueValues(rows, idx.barangay)),
    chapter: findKnownValueMention_(message, collectUniqueValues(rows, idx.chapter)),
    committee: findKnownValueMention_(message, collectUniqueValues(rows, idx.committee)),
    role: findKnownValueMention_(message, collectUniqueValues(rows, idx.role)),
    position: findKnownValueMention_(message, collectUniqueValues(rows, idx.position))
  };

  var localAggregateSignal = Boolean(
    wantsCount ||
    wantsList ||
    filters.gender ||
    filters.emailVerified !== null ||
    filters.barangay ||
    /\b(verified email|unverified|not verified|barangay|chapter|committee|role|position|female|male|women|men)\b/.test(lower)
  );

  var geminiIntent = callGeminiForDirectoryAggregateIntent_(message, rows, idx);
  if (geminiIntent) {
    if (!filters.gender && geminiIntent.gender) filters.gender = geminiIntent.gender;
    if (filters.emailVerified === null && geminiIntent.emailVerified !== null && geminiIntent.emailVerified !== undefined) {
      filters.emailVerified = geminiIntent.emailVerified;
    }
    if (!filters.barangay && geminiIntent.barangay) filters.barangay = geminiIntent.barangay;
    if (!filters.chapter && geminiIntent.chapter) filters.chapter = geminiIntent.chapter;
    if (!filters.committee && geminiIntent.committee) filters.committee = geminiIntent.committee;
    if (!filters.role && geminiIntent.role) filters.role = geminiIntent.role;
    if (!filters.position && geminiIntent.position) filters.position = geminiIntent.position;
    if (!wantsCount && geminiIntent.intent === 'count') wantsCount = true;
    if (!wantsList && geminiIntent.intent === 'list') wantsList = true;
    if (!localAggregateSignal && geminiIntent.isAggregate) localAggregateSignal = true;
  }

  return {
    isAggregate: localAggregateSignal,
    intent: wantsList && !wantsCount ? 'list' : 'count',
    filters: filters
  };
}

function detectGenderFilter_(lowerMessage) {
  if (/\b(female|females|woman|women|girl|girls)\b/.test(lowerMessage)) return 'female';
  if (/\b(male|males|man|men|boy|boys)\b/.test(lowerMessage)) return 'male';
  return '';
}

function detectEmailVerificationFilter_(lowerMessage) {
  if (/\b(not verified|unverified|without verified|without email verification)\b/.test(lowerMessage)) return false;
  if (/\b(verified email|email verified|verified members)\b/.test(lowerMessage)) return true;
  return null;
}

function findKnownValueMention_(message, values) {
  var normalizedMessage = normalizeDirectoryText(message);
  if (!normalizedMessage || !values || !values.length) return '';
  var best = '';
  for (var i = 0; i < values.length; i++) {
    var value = toStringValue_(values[i]);
    if (!value) continue;
    var normalized = normalizeDirectoryText(value);
    if (!normalized) continue;
    if (normalizedMessage.indexOf(normalized) === -1) continue;
    if (!best || normalized.length > normalizeDirectoryText(best).length) {
      best = value;
    }
  }
  return best;
}

function applyDirectoryAggregateFilters_(rows, idx, filters) {
  return rows.filter(function(row) {
    if (filters.gender) {
      if (!isGenderMatch(getDirectoryValue(row, idx.gender), filters.gender)) return false;
    }
    if (filters.emailVerified !== null && filters.emailVerified !== undefined) {
      var verified = isEmailVerified(row, idx);
      if (verified !== filters.emailVerified) return false;
    }
    if (filters.barangay) {
      if (normalizeDirectoryText(getDirectoryValue(row, idx.barangay)) !== normalizeDirectoryText(filters.barangay)) return false;
    }
    if (filters.chapter) {
      if (normalizeDirectoryText(getDirectoryValue(row, idx.chapter)) !== normalizeDirectoryText(filters.chapter)) return false;
    }
    if (filters.committee) {
      if (normalizeDirectoryText(getDirectoryValue(row, idx.committee)) !== normalizeDirectoryText(filters.committee)) return false;
    }
    if (filters.role) {
      if (normalizeDirectoryText(getDirectoryValue(row, idx.role)) !== normalizeDirectoryText(filters.role)) return false;
    }
    if (filters.position) {
      if (normalizeDirectoryText(getDirectoryValue(row, idx.position)) !== normalizeDirectoryText(filters.position)) return false;
    }
    return true;
  });
}

function callGeminiForDirectoryAggregateIntent_(message, rows, idx) {
  try {
    var committees = collectUniqueValues(rows, idx.committee).slice(0, 60);
    var roles = collectUniqueValues(rows, idx.role).slice(0, 60);
    var positions = collectUniqueValues(rows, idx.position).slice(0, 60);
    var barangays = collectUniqueValues(rows, idx.barangay).slice(0, 120);
    var chapters = collectUniqueValues(rows, idx.chapter).slice(0, 60);

    var payload = {
      "system_instruction": {
        "parts": [{
          "text":
            'Extract member-list query intent and filters from a user message. ' +
            'Return strict JSON only with keys: ' +
            '{"isAggregate":boolean,"intent":"count|list|unknown","gender":"male|female|","emailVerified":true|false|null,' +
            '"barangay":"", "chapter":"", "committee":"", "role":"", "position":""}. ' +
            'Use only values from the provided lists when possible.'
        }]
      },
      "contents": [{
        "role": "user",
        "parts": [{
          "text":
            'Message: ' + message +
            '\nCommittees: ' + committees.join(', ') +
            '\nRoles: ' + roles.join(', ') +
            '\nPositions: ' + positions.join(', ') +
            '\nBarangays: ' + barangays.join(', ') +
            '\nChapters: ' + chapters.join(', ')
        }]
      }]
    };

    var response = callGeminiWithRotation_(payload);
    if (!response.success || !response.text) return null;
    var parsed = parseGeminiJson(response.text);
    if (!parsed) return null;

    var intent = toStringValue_(parsed.intent).toLowerCase();
    var gender = toStringValue_(parsed.gender).toLowerCase();
    if (gender !== 'male' && gender !== 'female') gender = '';
    var emailVerified = null;
    if (parsed.emailVerified === true) emailVerified = true;
    else if (parsed.emailVerified === false) emailVerified = false;

    return {
      isAggregate: Boolean(parsed.isAggregate),
      intent: intent === 'list' ? 'list' : (intent === 'count' ? 'count' : 'unknown'),
      gender: gender,
      emailVerified: emailVerified,
      barangay: normalizeDirectoryScopeValues([toStringValue_(parsed.barangay)], barangays)[0] || '',
      chapter: normalizeDirectoryScopeValues([toStringValue_(parsed.chapter)], chapters)[0] || '',
      committee: normalizeDirectoryScopeValues([toStringValue_(parsed.committee)], committees)[0] || '',
      role: normalizeDirectoryScopeValues([toStringValue_(parsed.role)], roles)[0] || '',
      position: normalizeDirectoryScopeValues([toStringValue_(parsed.position)], positions)[0] || ''
    };
  } catch (e) {
    Logger.log('Directory aggregate intent parse error: ' + e);
    return null;
  }
}

function isGenderMatch(value, target) {
  var normalized = normalizeGenderValue_(value);
  if (target === 'male') {
    return normalized === 'male';
  }
  if (target === 'female') {
    return normalized === 'female';
  }
  return false;
}

function normalizeGenderValue_(value) {
  var text = normalizeDirectoryText(value);
  if (!text) return '';
  if (text === 'm') return 'male';
  if (text === 'f') return 'female';
  if (
    text.indexOf('female') !== -1 ||
    text === 'woman' ||
    text === 'women' ||
    text === 'girl' ||
    text === 'girls' ||
    text.indexOf('feminine') !== -1
  ) {
    return 'female';
  }
  if (
    text.indexOf('male') !== -1 ||
    text === 'man' ||
    text === 'men' ||
    text === 'boy' ||
    text === 'boys' ||
    text.indexOf('masculine') !== -1
  ) {
    return 'male';
  }
  if (text === 'm f' || text === 'f m' || text.indexOf('non binary') !== -1 || text.indexOf('nonbinary') !== -1) {
    return '';
  }
  return '';
}

function isEmailVerified(row, idx) {
  var rawValue = idx.emailVerified !== undefined ? row[idx.emailVerified] : '';
  var rawAlt = idx.verifiedEmail !== undefined ? row[idx.verifiedEmail] : '';
  return rawValue === true ||
    String(rawValue).toLowerCase() === 'true' ||
    String(rawValue).toLowerCase() === 'yes' ||
    rawAlt === true ||
    String(rawAlt).toLowerCase() === 'true' ||
    String(rawAlt).toLowerCase() === 'yes';
}

function findBestMatch(message, rows, idx) {
  var cleaned = stripMemberCommand(message);
  var normalizedMessage = normalizeDirectoryText(stripDirectoryHonorifics(cleaned));
  var candidate = extractNameCandidate(normalizedMessage);
  if (!candidate) return null;

  var tokens = buildDirectoryTokens(candidate);
  if (!tokens.length) return null;

  for (var i = 0; i < rows.length; i++) {
    var fullName = getDirectoryValue(rows[i], idx.fullName);
    if (matchesDirectoryTokens(fullName, candidate, tokens)) {
      return rows[i];
    }
  }
  return null;
}

function stripMemberCommand(message) {
  return message.replace(/\/?@members/gi, '').trim();
}

function extractNameCandidate(normalizedMessage) {
  var candidate = normalizedMessage
    .replace(/\bwho is\b/g, '')
    .replace(/\bwho's\b/g, '')
    .replace(/\bwhos\b/g, '')
    .replace(/\bwhen is\b/g, '')
    .replace(/\bwhat is\b/g, '')
    .replace(/\bwhat's\b/g, '')
    .replace(/\bwhats\b/g, '')
    .replace(/\bbirthday\b/g, '')
    .replace(/\bbirthdate\b/g, '')
    .replace(/\bage\b/g, '')
    .replace(/\bemail\b/g, '')
    .replace(/\bcontact\b/g, '')
    .replace(/\bid code\b/g, '')
    .replace(/\bposition\b/g, '')
    .replace(/\bcommittee\b/g, '')
    .replace(/\bchapter\b/g, '')
    .replace(/\bprofile picture\b/g, '')
    .replace(/\bprofile\b/g, '')
    .replace(/\bmember\b/g, '')
    .replace(/\bofficer\b/g, '')
    .replace(/\bsummary\b/g, '')
    .replace(/\bshow\b/g, '')
    .replace(/\bplease\b/g, '')
    .replace(/\bthe\b/g, '')
    .replace(/\bof\b/g, '')
    .replace(/\bfor\b/g, '')
    .replace(/\bhas\b/g, '')
    .replace(/\bdoes\b/g, '')
    .replace(/\bnot\b/g, '')
    .replace(/\btheir\b/g, '')
    .replace(/\bemail verified\b/g, '')
    .replace(/\bverified\b/g, '')
    .replace(/\bunverified\b/g, '')
    .replace(/\bemails\b/g, '')
    .replace(/\bemail\b/g, '');

  candidate = candidate.replace(/\s+/g, ' ').trim();
  return candidate;
}

function handleMemberInfoQuery(message, row, idx, data) {
  var lower = message.toLowerCase();
  var canViewSensitive = canViewSensitiveDirectoryFields_(data);

  if (lower.indexOf('birthday') !== -1 || lower.indexOf('birthdate') !== -1) {
    var birthday = formatBirthday(getDirectoryValue(row, idx.birthday));
    return 'Birthday for ' + getDirectoryValue(row, idx.fullName) + ': ' + birthday;
  }

  if (lower.indexOf('age') !== -1) {
    var age = getDirectoryValue(row, idx.age);
    if (!age) age = calculateDirectoryAge(getDirectoryValue(row, idx.birthday));
    return 'Age for ' + getDirectoryValue(row, idx.fullName) + ': ' + (age || 'Not available');
  }

  if (lower.indexOf('email') !== -1) {
    if (!canViewSensitive) return 'Email is restricted. Please contact an admin or auditor.';
    return 'Email for ' + getDirectoryValue(row, idx.fullName) + ': ' + (getDirectoryValue(row, idx.email) || 'Not available');
  }

  if (lower.indexOf('contact') !== -1) {
    if (!canViewSensitive) return 'Contact number is restricted. Please contact an admin or auditor.';
    return 'Contact for ' + getDirectoryValue(row, idx.fullName) + ': ' + (getDirectoryValue(row, idx.contactNumber) || 'Not available');
  }

  if (lower.indexOf('id code') !== -1) {
    if (!canViewSensitive) return 'ID Code is restricted. Please contact an admin or auditor.';
    return 'ID Code for ' + getDirectoryValue(row, idx.fullName) + ': ' + (getDirectoryValue(row, idx.idCode) || 'Not available');
  }

  if (lower.indexOf('position') !== -1) {
    return 'Position for ' + getDirectoryValue(row, idx.fullName) + ': ' + (getDirectoryValue(row, idx.position) || 'Not available');
  }

  if (lower.indexOf('chapter') !== -1) {
    return 'Chapter for ' + getDirectoryValue(row, idx.fullName) + ': ' + (getDirectoryValue(row, idx.chapter) || 'Not available');
  }

  if (lower.indexOf('committee') !== -1) {
    return 'Committee for ' + getDirectoryValue(row, idx.fullName) + ': ' + (getDirectoryValue(row, idx.committee) || 'Not available');
  }

  return '';
}

function formatBirthday(value) {
  if (!value) return 'Not available';
  var date = new Date(value);
  if (isNaN(date.getTime())) return value.toString();
  var iso = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var longDate = Utilities.formatDate(date, Session.getScriptTimeZone(), 'MMMM d, yyyy');
  return iso + ' (' + longDate + ')';
}

function formatMemberSummary(row, idx, data) {
  var fullName = getDirectoryValue(row, idx.fullName) || 'Not available';
  var age = getDirectoryValue(row, idx.age);
  if (!age) age = calculateDirectoryAge(getDirectoryValue(row, idx.birthday));
  var canViewSensitive = canViewSensitiveDirectoryFields_(data);
  var contactValue = getDirectoryValue(row, idx.contactNumber) || 'Not available';
  var emailValue = getDirectoryValue(row, idx.email) || 'Not available';
  var idCodeValue = getDirectoryValue(row, idx.idCode) || 'Not available';

  if (!canViewSensitive) {
    contactValue = maskPhoneForChatbot_(contactValue);
    emailValue = maskEmailForChatbot_(emailValue);
    idCodeValue = maskIdForChatbot_(idCodeValue);
  }

  var lines = [
    'Full Name: ' + fullName,
    'Age: ' + (age || 'Not available'),
    'Contact: ' + contactValue,
    'Email: ' + emailValue,
    'ID Code: ' + idCodeValue,
    'Position: ' + (getDirectoryValue(row, idx.position) || 'Not available'),
    'Chapter: ' + (getDirectoryValue(row, idx.chapter) || 'Not available'),
    'Committee: ' + (getDirectoryValue(row, idx.committee) || 'Not available'),
    'Profile Picture: ' + (getDirectoryValue(row, idx.profilePic) || 'Not available')
  ];

  return lines.join('\n');
}

function canViewSensitiveDirectoryFields_(data) {
  var verifiedUsername = toStringValue_(data && data.username);
  var role = toStringValue_(getUserRoleFromLoginSheetForChatbot_(verifiedUsername)).toLowerCase();
  if (!role) return false;
  return role.indexOf('admin') !== -1 || role.indexOf('auditor') !== -1;
}

function getUserRoleFromLoginSheetForChatbot_(username) {
  try {
    var u = toStringValue_(username).toLowerCase();
    if (!u) return '';
    var ssId = resolveLoginSpreadsheetIdForChatbot_();
    var sheetName = resolveLoginSheetNameForChatbot_();
    if (!ssId) return '';
    var ss = SpreadsheetApp.openById(ssId);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return '';
    var data = sheet.getDataRange().getValues();
    var headers = data[0] || [];
    var usernameIdx = findHeaderIndexByAliases_(headers, ['Username', 'User Name', 'username']);
    var roleIdx = findHeaderIndexByAliases_(headers, ['Role', 'role']);
    if (usernameIdx === -1 || roleIdx === -1) return '';
    for (var i = 1; i < data.length; i++) {
      if (toStringValue_(data[i][usernameIdx]).toLowerCase() === u) {
        return toStringValue_(data[i][roleIdx]).toLowerCase();
      }
    }
    return '';
  } catch (e) {
    Logger.log('getUserRoleFromLoginSheetForChatbot_ error: ' + e);
    return '';
  }
}

function maskEmailForChatbot_(email) {
  var text = toStringValue_(email);
  if (!text || text === 'Not available') return text || 'Not available';
  var parts = text.split('@');
  if (parts.length !== 2) return 'w***w';
  var local = parts[0];
  var domain = parts[1];
  if (!local || !domain) return 'w***w';
  return local.charAt(0) + '***' + local.slice(-1) + '@' + domain.charAt(0) + '***';
}

function maskPhoneForChatbot_(phone) {
  var text = toStringValue_(phone);
  if (!text || text === 'Not available') return text || 'Not available';
  var digits = text.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return '***-***-' + digits.slice(-4);
}

function maskIdForChatbot_(idCode) {
  var text = toStringValue_(idCode);
  if (!text || text === 'Not available') return text || 'Not available';
  if (text.length <= 2) return '**';
  return text.charAt(0) + '***' + text.charAt(text.length - 1);
}

function getGeminiDirectoryHints(message, rows, idx) {
  try {
    var committees = collectUniqueValues(rows, idx.committee).slice(0, 50);
    var roles = collectUniqueValues(rows, idx.role).slice(0, 50);
    var positions = collectUniqueValues(rows, idx.position).slice(0, 50);

    var responseText = callGeminiForDirectoryHints(message, committees, roles, positions);
    var parsed = parseGeminiJson(responseText);
    if (!parsed) return null;

    return {
      name: (parsed.name || '').toString().trim(),
      executiveBoardOnly: Boolean(parsed.executiveBoardOnly),
      committees: normalizeDirectoryScopeValues(parsed.committees, committees),
      roles: normalizeDirectoryScopeValues(parsed.roles, roles),
      positions: normalizeDirectoryScopeValues(parsed.positions, positions)
    };
  } catch (e) {
    Logger.log('Gemini directory hints error: ' + e.toString());
    return null;
  }
}

function mergeDirectoryScope(scope, hints) {
  return {
    executiveBoardOnly: scope.executiveBoardOnly || hints.executiveBoardOnly,
    committees: uniqueDirectoryValues(scope.committees.concat(hints.committees)),
    roles: uniqueDirectoryValues(scope.roles.concat(hints.roles)),
    positions: uniqueDirectoryValues(scope.positions.concat(hints.positions))
  };
}

function uniqueDirectoryValues(values) {
  var map = {};
  var result = [];
  for (var i = 0; i < values.length; i++) {
    var value = values[i];
    if (!value) continue;
    var key = normalizeDirectoryText(value);
    if (map[key]) continue;
    map[key] = true;
    result.push(value);
  }
  return result;
}

function normalizeDirectoryScopeValues(values, allowedValues) {
  if (!values || !values.length) return [];
  var allowedMap = {};
  for (var i = 0; i < allowedValues.length; i++) {
    allowedMap[normalizeDirectoryText(allowedValues[i])] = allowedValues[i];
  }

  var result = [];
  for (var j = 0; j < values.length; j++) {
    var key = normalizeDirectoryText(values[j]);
    if (allowedMap[key]) {
      result.push(allowedMap[key]);
    }
  }
  return uniqueDirectoryValues(result);
}

function findBestMatchFromCandidate(candidate, rows, idx) {
  var normalizedCandidate = normalizeDirectoryText(stripDirectoryHonorifics(candidate || ''));
  if (!normalizedCandidate) return null;
  var tokens = buildDirectoryTokens(normalizedCandidate);
  if (!tokens.length) return null;

  for (var i = 0; i < rows.length; i++) {
    var fullName = getDirectoryValue(rows[i], idx.fullName);
    if (matchesDirectoryTokens(fullName, normalizedCandidate, tokens)) {
      return rows[i];
    }
  }
  return null;
}

function parseGeminiJson(text) {
  if (!text) return null;
  var cleaned = text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
  var start = cleaned.indexOf('{');
  var end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  var jsonText = cleaned.substring(start, end + 1);
  try {
    return JSON.parse(jsonText);
  } catch (e) {
    return null;
  }
}

function callGeminiForDirectoryHints(message, committees, roles, positions) {
  var systemText =
    'You extract directory search hints. Return only JSON with keys: ' +
    '"name" (string), "committees" (array), "roles" (array), "positions" (array), ' +
    '"executiveBoardOnly" (boolean). Use only provided list values. If unsure, use empty values.';

  var payload = {
    "system_instruction": {
      "parts": [{ "text": systemText }]
    },
    "contents": [{
      "role": "user",
      "parts": [{
        "text": 'Message: ' + message +
          '\nCommittees: ' + committees.join(', ') +
          '\nRoles: ' + roles.join(', ') +
          '\nPositions: ' + positions.join(', ')
      }]
    }]
  };

  var response = callGeminiWithRotation_(payload);
  if (!response.success) return '';
  return response.text || '';
}

function resolveDirectoryTargetWithRewrites_(message, rows, idx, baseScope) {
  var attempts = 0;
  var workingMessage = toStringValue_(message);
  var lastTarget = null;

  while (attempts < CHATBOT_CONFIG.DIRECTORY_GEMINI_REWRITE_ROUNDS && workingMessage) {
    attempts++;
    var rewritten = rewriteDirectoryQuestionWithGemini_(workingMessage, rows, idx);
    if (!rewritten || rewritten === workingMessage) break;

    var scope = extractScopeFilters(rewritten, rows, idx);
    var mergedScope = mergeDirectoryScope(baseScope || { executiveBoardOnly: false, committees: [], roles: [], positions: [] }, scope);
    var scopedRows = applyScopeFilters(rows, idx, mergedScope);
    if (!scopedRows.length) {
      workingMessage = rewritten;
      continue;
    }

    var direct = findBestMatch(rewritten, scopedRows, idx);
    if (direct) return direct;

    var hints = getGeminiDirectoryHints(rewritten, rows, idx);
    if (hints) {
      var hintedScope = mergeDirectoryScope(mergedScope, hints);
      var hintedRows = applyScopeFilters(rows, idx, hintedScope);
      if (hintedRows.length) {
        if (hints.name) {
          lastTarget = findBestMatchFromCandidate(hints.name, hintedRows, idx);
          if (lastTarget) return lastTarget;
        }
        lastTarget = findBestMatch(rewritten, hintedRows, idx);
        if (lastTarget) return lastTarget;
      }
    }

    workingMessage = rewritten;
  }

  return lastTarget;
}

function rewriteDirectoryQuestionWithGemini_(message, rows, idx) {
  try {
    var committees = collectUniqueValues(rows, idx.committee).slice(0, 50);
    var roles = collectUniqueValues(rows, idx.role).slice(0, 50);
    var positions = collectUniqueValues(rows, idx.position).slice(0, 50);

    var payload = {
      "system_instruction": {
        "parts": [{
          "text":
            'Rewrite the user query for member search. Keep intent same. ' +
            'Return strict JSON only: {"query":"..."} ' +
            'If name is present, preserve exact spelling.'
        }]
      },
      "contents": [{
        "role": "user",
        "parts": [{
          "text":
            'Query: ' + message +
            '\nKnown committees: ' + committees.join(', ') +
            '\nKnown roles: ' + roles.join(', ') +
            '\nKnown positions: ' + positions.join(', ')
        }]
      }]
    };

    var response = callGeminiWithRotation_(payload);
    if (!response.success || !response.text) return '';
    var parsed = parseGeminiJson(response.text);
    if (!parsed) return '';
    return toStringValue_(parsed.query);
  } catch (e) {
    Logger.log('Directory rewrite error: ' + e);
    return '';
  }
}

function handleReviewUnknownsCommand_(message, context, rawData) {
  var lower = toStringValue_(message).toLowerCase();
  if (!/^@review\s+unknowns\b/.test(lower)) return '';

  if (!isSystemToolsPage_(context.currentPage)) {
    return 'This command is available only in the System Tools page.';
  }
  if (!context.username && !context.email && !context.idCode) {
    return 'Please log in first before using this command.';
  }
  if (!doesUserExistInLoginSheet_(context)) {
    return 'Logged-in user was not found in the directory records.';
  }

  if (!hasReviewUnknownsAccess_(context)) {
    return 'You do not have permission to review unknown questions.';
  }

  var sheet = getOrCreateUnknownSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 'No unknown questions are queued for review.';

  var rows = sheet.getRange(2, 1, lastRow - 1, CHATBOT_CONFIG.UNKNOWN_LOG_HEADERS.length).getValues();
  var pending = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var reviewStatus = toStringValue_(row[8]) || 'Pending';
    var dbAction = toStringValue_(row[10]) || 'Pending Review';
    var approvedAnswer = toStringValue_(row[9]);
    if (dbAction === 'Add to Database' && approvedAnswer) continue;
    if (dbAction === 'Ignore') continue;
    if (reviewStatus === 'Resolved') continue;

    pending.push({
      question: toStringValue_(row[1]),
      page: toStringValue_(row[3]) || 'Unknown',
      timesAsked: Number(row[12] || 1),
      reviewStatus: reviewStatus,
      dbAction: dbAction
    });
  }

  if (!pending.length) return 'No pending unknown questions at the moment.';

  pending.sort(function(a, b) { return (b.timesAsked || 0) - (a.timesAsked || 0); });
  var top = pending.slice(0, 12);
  var lines = ['Pending unknown questions (' + pending.length + ' total):'];
  for (var j = 0; j < top.length; j++) {
    var item = top[j];
    lines.push(
      (j + 1) + '. [' + item.page + '] ' + item.question +
      ' (asked ' + item.timesAsked + 'x, ' + item.reviewStatus + ', ' + item.dbAction + ')'
    );
  }
  lines.push('Review in sheet: ' + CHATBOT_CONFIG.UNKNOWN_LOG_SHEET);
  return lines.join('\n');
}

function hasReviewUnknownsAccess_(context) {
  var username = toStringValue_(context && context.username);
  if (!username) return false;
  var role = toStringValue_(getUserRoleFromLoginSheetForChatbot_(username)).toLowerCase();
  if (!role) return false;
  if (role.indexOf('auditor') !== -1) return true;
  if (role.indexOf('admin') !== -1) return true;
  return false;
}

function isSystemToolsPage_(page) {
  var key = normalizePageKey_(page);
  return key.indexOf('systemtools') !== -1 || key === 'system tools';
}

function normalizePageKey_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function doesUserExistInLoginSheet_(context) {
  try {
    var username = toStringValue_(context && context.username).toLowerCase();
    if (!username) return false;

    var ssId = resolveLoginSpreadsheetIdForChatbot_();
    var sheetName = resolveLoginSheetNameForChatbot_();
    if (!ssId) return false;

    var ss = SpreadsheetApp.openById(ssId);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return false;

    var data = sheet.getDataRange().getValues();
    var headers = data[0] || [];
    var usernameIdx = findHeaderIndexByAliases_(headers, ['Username', 'User Name', 'username']);
    if (usernameIdx === -1) return false;

    for (var i = 1; i < data.length; i++) {
      if (toStringValue_(data[i][usernameIdx]).toLowerCase() === username) return true;
    }
    return false;
  } catch (e) {
    Logger.log('doesUserExistInLoginSheet_ error: ' + e);
    return false;
  }
}

function findHeaderIndexByAliases_(headers, aliases) {
  if (!headers || !headers.length) return -1;
  var normalizedAliases = {};
  for (var i = 0; i < aliases.length; i++) {
    normalizedAliases[normalizeDirectoryText(aliases[i])] = true;
  }
  for (var j = 0; j < headers.length; j++) {
    var h = normalizeDirectoryText(headers[j]);
    if (h && normalizedAliases[h]) return j;
  }
  return -1;
}

function callGemini(msg, context, requestContext, history) {
  var approvedHit = lookupApprovedUnknownAnswer_(msg, requestContext.currentPage);
  if (approvedHit) return approvedHit;

  var promptContext = buildContextBlockForPrompt_(requestContext, history, { answer: approvedHit });
  var contextText = context ? '\nExtra Context:\n' + context : '';
  var payload = {
    "system_instruction": {
      "parts": [{ "text": `
      You are YSP-Bot, the official AI assistant for the Youth Service Philippines (YSP) Tagum Chapter Portal.
      CONTEXT: You are a floating chat bubble inside the student leader WebApp.
      TONE: Professional, encouraging, concise. Use "We".
      INFO: Membership Officer is Ezequiel John B. Crisostomo. Apply in 'Membership' tab. Attendance in 'Events' tab.
      RESTRICTIONS: Avoid unsafe/harmful content.
      BEHAVIOR:
      - Act like a helpful LLM assistant for YSP users.
      - Prefer concrete answers over vague responses.
      - Give concise answers by default; expand when user asks for more detail.
      - Do not use markdown symbols (no **bold**, __underline__, or backticks).
      - If details are missing, ask one focused follow-up question.
      - Do not output the phrase "I don't know". Give the best safe guidance based on known context.
      - If you are uncertain, say what detail is needed next.
      REQUEST CONTEXT:
      ${promptContext}
      ${contextText}
      `}]
    },
    "contents": [{ "role": "user", "parts": [{ "text": msg }] }]
  };

  var ai = callGeminiWithRotation_(payload);
  if (!ai.success || !ai.text) {
    return 'High Traffic: All AI lines are busy. Please try again in 1 minute.';
  }

  var text = ai.text;
  if (!isUnknownStyleReply_(text)) return text;

  var retryPayload = {
    "system_instruction": {
      "parts": [{
        "text":
          'Rewrite into a helpful, specific response for YSP web app users. ' +
          'Do not say "I don\'t know". Ask one clarifying question if needed.'
      }]
    },
    "contents": [{
      "role": "user",
      "parts": [{
        "text":
          'User question: ' + msg +
          '\nDraft response: ' + text +
          '\nContext:\n' + promptContext
      }]
    }]
  };
  var retry = callGeminiWithRotation_(retryPayload);
  if (retry.success && retry.text) return retry.text;
  return text;
}

function callGeminiWithRotation_(payload) {
  markGeminiUsed_();
  var keys = resolveChatbotApiKeys_();
  if (!keys.length) {
    return { success: false, text: '', error: 'No Gemini API keys configured' };
  }

  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var url =
      'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(CHATBOT_CONFIG.MODEL_NAME) +
      ':generateContent?key=' + encodeURIComponent(key);

    try {
      var response = UrlFetchApp.fetch(url, options);
      var status = response.getResponseCode();
      if (status < 200 || status >= 300) {
        Logger.log('Gemini key index failed: ' + i + ', status=' + status);
        continue;
      }
      var bodyText = response.getContentText() || '';
      var parsed = JSON.parse(bodyText);
      var text = extractGeminiText_(parsed);
      if (!text) continue;
      return { success: true, text: text };
    } catch (error) {
      Logger.log('Gemini key index error: ' + i + ', error=' + error);
    }
  }

  return { success: false, text: '', error: 'All keys failed' };
}

function extractGeminiText_(json) {
  if (!json || !json.candidates || !json.candidates.length) return '';
  var candidate = json.candidates[0];
  if (!candidate || !candidate.content || !candidate.content.parts) return '';
  var parts = candidate.content.parts;
  var textParts = [];
  for (var i = 0; i < parts.length; i++) {
    var text = toStringValue_(parts[i] && parts[i].text ? parts[i].text : '');
    if (text) textParts.push(text);
  }
  return textParts.join('\n').trim();
}

function resolveLoginSpreadsheetIdForChatbot_() {
  try {
    if (typeof LOGIN_SPREADSHEET_ID !== 'undefined' && LOGIN_SPREADSHEET_ID) {
      return String(LOGIN_SPREADSHEET_ID);
    }
  } catch (e) {}
  return PropertiesService.getScriptProperties().getProperty('LOGIN_SPREADSHEET_ID') || '';
}

function resolveLoginSheetNameForChatbot_() {
  try {
    if (typeof LOGIN_SHEET_NAME !== 'undefined' && LOGIN_SHEET_NAME) {
      return String(LOGIN_SHEET_NAME);
    }
  } catch (e) {}
  return CHATBOT_CONFIG.LOGIN_SHEET_NAME_FALLBACK;
}

function resolveUnknownLogSpreadsheetIdForChatbot_() {
  try {
    if (typeof CHATBOT_UNKNOWN_LOG_SPREADSHEET_ID !== 'undefined' && CHATBOT_UNKNOWN_LOG_SPREADSHEET_ID) {
      return String(CHATBOT_UNKNOWN_LOG_SPREADSHEET_ID);
    }
  } catch (e) {}

  var props = PropertiesService.getScriptProperties();
  var directId = toStringValue_(props.getProperty('CHATBOT_UNKNOWN_LOG_SPREADSHEET_ID'));
  if (directId) return directId;

  return toStringValue_(resolveLoginSpreadsheetIdForChatbot_());
}

function debugChatbotSpreadsheetAccess() {
  return debugChatbotHealthCheck();
}

function toStringValue_(value) {
  return String(value || '').trim();
}

function sanitizeForSheetCell_(value, maxLen) {
  var text = toStringValue_(value);
  if (!text) return '';
  var limit = Number(maxLen || 0);
  if (limit > 0 && text.length > limit) {
    text = text.slice(0, limit);
  }
  if (/^[=\-+@]/.test(text)) {
    text = "'" + text;
  }
  return text;
}

function debugChatbotHealthCheck() {
  var requiredScopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/script.external_request'
  ];
  var result = {
    ok: true,
    checkedAt: new Date().toISOString(),
    requiredScopes: requiredScopes,
    auth: {},
    properties: {},
    spreadsheets: {
      unknownLog: {},
      login: {}
    },
    gemini: {}
  };

  result.auth = getAuthDiagnostics_(requiredScopes);
  if (!result.auth.authorized) result.ok = false;

  result.properties = getPropertyDiagnostics_();
  if (!result.properties.hasUnknownOrLoginSpreadsheetId) result.ok = false;

  result.spreadsheets.unknownLog = checkUnknownLogSpreadsheetAccess_();
  if (!result.spreadsheets.unknownLog.ok) result.ok = false;

  result.spreadsheets.login = checkLoginSpreadsheetAccess_();
  if (!result.spreadsheets.login.ok) result.ok = false;

  result.gemini = {
    configuredKeyCount: resolveChatbotApiKeys_().length
  };
  if (result.gemini.configuredKeyCount < 1) result.ok = false;

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function getAuthDiagnostics_(scopes) {
  var out = {
    authorized: false,
    status: 'UNKNOWN',
    authorizationUrl: '',
    error: ''
  };
  try {
    var info = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL, scopes);
    var status = info.getAuthorizationStatus();
    out.status = String(status);
    out.authorized = status === ScriptApp.AuthorizationStatus.NOT_REQUIRED;
    if (!out.authorized) {
      out.authorizationUrl = info.getAuthorizationUrl() || '';
    }
  } catch (e) {
    out.error = String(e);
  }
  return out;
}

function getPropertyDiagnostics_() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var hasUnknown = !!toStringValue_(props.CHATBOT_UNKNOWN_LOG_SPREADSHEET_ID);
  var hasLogin = !!toStringValue_(props.LOGIN_SPREADSHEET_ID);
  var loginSheetName = toStringValue_(props.LOGIN_SHEET_NAME);
  return {
    hasChatbotUnknownLogSpreadsheetId: hasUnknown,
    hasLoginSpreadsheetId: hasLogin,
    hasUnknownOrLoginSpreadsheetId: hasUnknown || hasLogin,
    hasLoginSheetName: !!loginSheetName
  };
}

function checkUnknownLogSpreadsheetAccess_() {
  var out = {
    ok: false,
    spreadsheetId: '',
    sheetName: CHATBOT_CONFIG.UNKNOWN_LOG_SHEET
  };
  try {
    var spreadsheetId = resolveUnknownLogSpreadsheetIdForChatbot_();
    out.spreadsheetId = spreadsheetId || '';
    if (!spreadsheetId) {
      out.error = 'No spreadsheet ID resolved for unknown logs.';
      return out;
    }

    var ss = SpreadsheetApp.openById(spreadsheetId);
    out.spreadsheetName = ss.getName();
    out.spreadsheetUrl = ss.getUrl();

    var sheet = getOrCreateUnknownSheet_();
    out.sheetId = sheet.getSheetId();
    out.lastRow = sheet.getLastRow();
    out.ok = true;
  } catch (e) {
    out.error = String(e);
  }
  return out;
}

function checkLoginSpreadsheetAccess_() {
  var out = {
    ok: false,
    spreadsheetId: '',
    sheetName: ''
  };
  try {
    var ssId = resolveLoginSpreadsheetIdForChatbot_();
    out.spreadsheetId = ssId || '';
    out.sheetName = resolveLoginSheetNameForChatbot_();
    if (!ssId) {
      out.error = 'LOGIN_SPREADSHEET_ID is not configured.';
      return out;
    }

    var ss = SpreadsheetApp.openById(ssId);
    out.spreadsheetName = ss.getName();
    out.spreadsheetUrl = ss.getUrl();

    var sheet = ss.getSheetByName(out.sheetName);
    out.sheetFound = !!sheet;
    if (!sheet) {
      out.error = 'Login sheet tab not found: ' + out.sheetName;
      return out;
    }

    out.lastRow = sheet.getLastRow();
    out.ok = true;
  } catch (e) {
    out.error = String(e);
  }
  return out;
}
