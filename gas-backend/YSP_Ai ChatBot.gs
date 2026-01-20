// ==========================================
// YSP AI BACKEND (ROTATING KEYS)
// ==========================================

// ADD YOUR MULTIPLE KEYS HERE
const API_KEYS = [
  'AIzaSyCGqxDa4-eI6Fz48tLqqxiuNMn839hCENc', // Key 1
  'AIzaSyABAlLmqblSn53gu0SIwtpXaNucgIG556Q', // Key 2
  'AIzaSyA_P9k9I4TQyEzgq4rHMWqWimueRL0uA-k',
  'AIzaSyDerYlDjo_EaizhdKxjZ-CcHYEpX4rxD_o',
  'AIzaSyAWOCoN3kM16vlHFR_sVPsSElC9rbS0IBQ'
];

const MODEL_NAME = 'gemini-2.5-flash';

function doPost(e) {
  try {
    var rawData = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var data = JSON.parse(rawData || '{}');
    var userMessage = (data.message || '').toString().trim();

    if (!userMessage) {
      return ContentService.createTextOutput(JSON.stringify({
        reply: 'Please type a message.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var directoryReply = handleDirectoryMessage(userMessage, data);
    if (directoryReply) {
      return ContentService.createTextOutput(JSON.stringify({
        reply: directoryReply
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var aiResponse = callGemini(userMessage, data.context || '');

    return ContentService.createTextOutput(JSON.stringify({
      reply: aiResponse
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      reply: 'System Error: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
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
      return 'I could not find that person. Please check the name and try again.';
    }

    var infoReply = handleMemberInfoQuery(message, targetRow, idx);
    if (infoReply) return infoReply;

    return formatMemberSummary(targetRow, idx);
  } catch (e) {
    Logger.log('Directory query error: ' + e.toString());
    return 'Directory search failed. Please try again.';
  }
}

function isDirectoryRequest(message, data) {
  var lower = message.toLowerCase();
  if (lower.indexOf('@members') !== -1 || lower.indexOf('/@members') !== -1) return true;
  if (data && data.forceDirectory === true) return true;

  var allowedPage = data && data.contextPage &&
    (data.contextPage === 'Officer Directory' || data.contextPage === 'Manage Members');
  if (!allowedPage) return false;

  return /member|members|officer|committee|role|position|chapter|birthday|email verified|unverified|gender|female|male|id code/.test(lower);
}

function getDirectoryData() {
  var ss = SpreadsheetApp.openById(LOGIN_SPREADSHEET_ID);
  var sheet = ss.getSheetByName(LOGIN_SHEET_NAME);
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
  var lower = message.toLowerCase();
  var wantsCount = /how many|count|number of/.test(lower);
  var wantsWho = /\bwho\b/.test(lower);

  if (/(female|females|women|girl|girls)\b/.test(lower)) {
    var femaleCount = rows.filter(function(row) {
      return isGenderMatch(getDirectoryValue(row, idx.gender), 'female');
    }).length;
    return 'I found ' + femaleCount + ' female members in ' + scopeLabel + '.';
  }

  if (/(male|males|men|boy|boys)\b/.test(lower)) {
    var maleCount = rows.filter(function(row) {
      return isGenderMatch(getDirectoryValue(row, idx.gender), 'male');
    }).length;
    return 'I found ' + maleCount + ' male members in ' + scopeLabel + '.';
  }

  if (/not verified|unverified|email(s)? verified/.test(lower)) {
    var unverifiedRows = rows.filter(function(row) {
      return !isEmailVerified(row, idx);
    });
    if (wantsWho && unverifiedRows.length) {
      var names = unverifiedRows.slice(0, 20).map(function(row) {
        return getDirectoryValue(row, idx.fullName);
      }).filter(Boolean);
      return 'Members without verified emails (' + unverifiedRows.length + '): ' + names.join(', ');
    }
    return 'I found ' + unverifiedRows.length + ' members without verified emails in ' + scopeLabel + '.';
  }

  if (wantsCount) {
    return 'I found ' + rows.length + ' members in ' + scopeLabel + '.';
  }

  return '';
}

function isGenderMatch(value, target) {
  var normalized = normalizeDirectoryText(value);
  if (target === 'male') {
    return normalized === 'male' || normalized === 'm' || normalized === 'man' || normalized === 'men';
  }
  if (target === 'female') {
    return normalized === 'female' || normalized === 'f' || normalized === 'woman' || normalized === 'women';
  }
  return false;
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

function handleMemberInfoQuery(message, row, idx) {
  var lower = message.toLowerCase();

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
    return 'Email for ' + getDirectoryValue(row, idx.fullName) + ': ' + (getDirectoryValue(row, idx.email) || 'Not available');
  }

  if (lower.indexOf('contact') !== -1) {
    return 'Contact for ' + getDirectoryValue(row, idx.fullName) + ': ' + (getDirectoryValue(row, idx.contactNumber) || 'Not available');
  }

  if (lower.indexOf('id code') !== -1) {
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

function formatMemberSummary(row, idx) {
  var fullName = getDirectoryValue(row, idx.fullName) || 'Not available';
  var age = getDirectoryValue(row, idx.age);
  if (!age) age = calculateDirectoryAge(getDirectoryValue(row, idx.birthday));

  var lines = [
    'Full Name: ' + fullName,
    'Age: ' + (age || 'Not available'),
    'Contact: ' + (getDirectoryValue(row, idx.contactNumber) || 'Not available'),
    'Email: ' + (getDirectoryValue(row, idx.email) || 'Not available'),
    'ID Code: ' + (getDirectoryValue(row, idx.idCode) || 'Not available'),
    'Position: ' + (getDirectoryValue(row, idx.position) || 'Not available'),
    'Chapter: ' + (getDirectoryValue(row, idx.chapter) || 'Not available'),
    'Committee: ' + (getDirectoryValue(row, idx.committee) || 'Not available'),
    'Profile Picture: ' + (getDirectoryValue(row, idx.profilePic) || 'Not available')
  ];

  return lines.join('\n');
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

  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  for (let i = 0; i < API_KEYS.length; i++) {
    const key = API_KEYS[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${key}`;

    try {
      const response = UrlFetchApp.fetch(url, options);
      if (response.getResponseCode() === 200) {
        const json = JSON.parse(response.getContentText());
        if (!json.error) {
          return json.candidates[0].content.parts[0].text;
        }
      }
    } catch (e) {
      console.log('Directory hints key ' + i + ' error: ' + e.toString());
    }
  }

  return '';
}

function callGemini(msg, context) {
  var contextText = context ? '\nExtra Context:\n' + context : '';
  const payload = {
    "system_instruction": {
      "parts": [{ "text": `
      You are YSP-Bot, the official AI assistant for the Youth Service Philippines (YSP) Tagum Chapter Portal.
      CONTEXT: You are a floating chat bubble inside the student leader WebApp.
      TONE: Professional, encouraging, concise. Use "We".
      INFO: Membership Officer is Ezequiel John B. Crisostomo. Apply in 'Membership' tab. Attendance in 'Events' tab.
      RESTRICTIONS: No code. No technical explanations. Short answers.
      ${contextText}
      `}]
    },
    "contents": [{ "role": "user", "parts": [{ "text": msg }] }]
  };

  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  for (let i = 0; i < API_KEYS.length; i++) {
    const key = API_KEYS[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${key}`;

    try {
      const response = UrlFetchApp.fetch(url, options);
      if (response.getResponseCode() === 200) {
        const json = JSON.parse(response.getContentText());
        if (!json.error) {
          return json.candidates[0].content.parts[0].text;
        }
      }
      console.log('Key ' + i + ' failed. Trying next...');
    } catch (e) {
      console.log('Key ' + i + ' error: ' + e.toString());
    }
  }

  return 'High Traffic: All AI lines are busy. Please try again in 1 minute.';
}
