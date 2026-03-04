/* ═══════════════════════════════════════════════════════════════════════════
 *  YSP Meet Attendance Tracker — Content Script v2.0
 *  ─────────────────────────────────────────────────────────────────────────
 *  Async multi-strategy participant detection engine with confidence-based
 *  leave detection, reliable sync, and modern Google Meet DOM support.
 *
 *  Key improvements over v1:
 *  • Async scroll with requestAnimationFrame delay (catches virtual-scroll)
 *  • data-participant-id extraction for stable unique identifiers
 *  • Confidence-based leave detection (replaces 90s grace timer)
 *  • Targeted MutationObserver (participant container only)
 *  • text/plain Content-Type for CORS-free GAS sync
 *  • document_start compatible with polling initialization
 *  • Force sync from popup support
 * ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CONFIG = {
    backendUrl: 'https://script.google.com/macros/s/AKfycbyTYEMa5apc6ZSCVce1qowpbcooRB88OjtW-nSvsb4ZK-W8N9XcQp2dbigoaPTg316J/exec',
    sharedSecret: 'P37-5mgdNfjRd9KcSt4gw5SYVfzO5EHFyq4XYHKVe7PpL7FRbwab_czEa3ez4YsN',
    source: 'ysp-meet-extension-v2',
    scanIntervalMs: 2500,
    heartbeatIntervalMs: 30000,
    minSyncGapMs: 7000,
    deepScanIntervalMs: 5000,        // v2: 5s (was 12s)
    panelScrollPasses: 10,            // v2: 10 (was 4)
    scrollSettleMs: 200,              // v2: wait after each scroll step
    autoOpenPeoplePanel: true,
    panelOpenAttemptCooldownMs: 8000, // v2: 8s (was 15s)
    panelOpenWaitMs: 2000,            // v2: max wait for panel DOM after click
    stateReuseMaxIdleMs: 2 * 60 * 1000,
    consecutiveMissesForLeave: 3,     // v2: confidence-based (replaces leaveGraceMs)
    debug: false,
  };
  
  // Diagnostic logging control - set to true for verbose scan-by-scan logs
  var VERBOSE_DIAG = false;
  
  // NOTE: Page helper injection (yspFullDump) removed due to Google Meet CSP blocking inline scripts.
  // Use yspDumpParticipants() from the console instead (exposed at the bottom of this file).
  
  var TRACKER_VERSION = '2.0.0';
  var MEETING_ORIGIN_HINT = 'meet_page_auto';

  var TRACKER_PREFIX = 'ysp_meet_tracker_state_';
  var CHROME_OK = typeof chrome !== 'undefined' && chrome && chrome.runtime && chrome.storage && chrome.storage.local;
  var STORAGE_KEYS = {
    enabled: 'ysp_tracker_enabled',
    active: 'ysp_tracker_active',
    meetingId: 'ysp_tracker_current_meeting_id',
    lastSyncAt: 'ysp_tracker_last_sync_at',
    lastSyncOk: 'ysp_tracker_last_sync_ok',
    lastSyncError: 'ysp_tracker_last_sync_error',
    lastMeetingOrigin: 'ysp_tracker_last_meeting_origin',
    liveCount: 'ysp_tracker_live_count',
    seenCount: 'ysp_tracker_seen_count',
    captureCount: 'ysp_tracker_capture_count',
  };

  var STOPWORDS = new Set([
    'you', 'search', 'people', 'chat', 'present now',
    'meeting details', 'raise hand', 'leave call',
    'camera off', 'microphone off', 'turn on microphone',
    'turn off microphone', 'turn on camera', 'turn off camera',
    'present', 'more options', 'captions', 'cast',
    'more actions', 'more_vert', 'morevert', 'morevertmore actions',
    'add people', 'invite', 'close', 'expand', 'collapse',
    'minimize', 'maximize', 'send message', 'spotlight', 'call',
    'remove', 'pin', 'unpin', 'mute', 'unmute', 'presenting',
    'in the meeting', 'in this call', 'contributors', 'everyone',
    'host', 'organizer', 'co-host', 'co host',
    // Google Meet admission/control buttons
    'admit', 'deny', 'ask to join', 'waiting', 'joining',
    'stop presenting', 'share screen', 'end call', 'rejoin',
    'ask to unmute', 'hand raised', 'lower hand', 'reactions',
    'activities', 'breakout rooms', 'whiteboard', 'recording',
    'start recording', 'stop recording', 'turn on captions',
    'turn off captions', 'apply visual effects', 'change layout',
    'full screen', 'exit full screen', 'settings', 'report a problem',
    'report abuse', 'help', 'keyboard shortcuts', 'view', 'cancel',
    'confirm', 'ok', 'yes', 'no', 'done', 'apply', 'save',
    'back', 'next', 'previous', 'skip', 'learn more', 'got it',
    'dismiss', 'send', 'submit', 'join now', 'ask to join',
    'request to join', 'knock', 'knocking', 'waiting room',
    'in call', 'not in call', 'offline', 'online', 'busy',
    'view all', 'show all', 'hide', 'show', 'more', 'less',
    'info', 'details', 'options', 'menu', 'actions',
  ]);

  var NOISE_PATTERNS = [
    /more options for/i,
    /more actions for/i,
    /^more_vert/i,
    /more_vert/i,
    /^morevert/i,
    /morevertmore/i,
    /^more actions$/i,
    /^more options$/i,
    /^\d+\s*participant/i,
    /^presenting$/i,
    /^pin$/i,
    /^unpin$/i,
    /^you$/i,
    /^\(you\)$/i,
    /^muted?$/i,
    /^unmuted?$/i,
    /^remove$/i,
    /^add people$/i,
    /^invite$/i,
    /^close$/i,
    /^expand$/i,
    /^collapse$/i,
    /^minimize$/i,
    /^maximize$/i,
    /^send message$/i,
    /^spotlight$/i,
    /^call$/i,
    // Google Meet admission/control UI
    /^admit$/i,
    /^deny$/i,
    /^ask to join$/i,
    /^waiting$/i,
    /^joining$/i,
    /^rejoin$/i,
    /^stop presenting$/i,
    /^share screen$/i,
    /^end call$/i,
    /^hand raised$/i,
    /^lower hand$/i,
    /^reactions$/i,
    /^activities$/i,
    /^breakout rooms?$/i,
    /^whiteboard$/i,
    /^recording$/i,
    /^start recording$/i,
    /^stop recording$/i,
    /^captions?$/i,
    /^settings$/i,
    /^help$/i,
    /^cancel$/i,
    /^confirm$/i,
    /^done$/i,
    /^apply$/i,
    /^save$/i,
    /^back$/i,
    /^next$/i,
    /^skip$/i,
    /^learn more$/i,
    /^got it$/i,
    /^dismiss$/i,
    /^send$/i,
    /^submit$/i,
    /^join now$/i,
    /^knock$/i,
    /^knocking$/i,
    /^info$/i,
    /^details$/i,
    /^options$/i,
    /^menu$/i,
    /^actions$/i,
    /^show$/i,
    /^hide$/i,
    /^view$/i,
    /^more$/i,
    /^view all$/i,
    /^show all$/i,
    // Single-word UI garbage (very short)
    /^ok$/i,
    /^yes$/i,
    /^no$/i,
    // Anything that looks like an action button
    /^turn (on|off)/i,
    /^ask to/i,
    /microphone$/i,
    /camera$/i,
  ];

  /* ─── Modern multi-strategy DOM selectors (2024-2026+ Meet UI) ────── */

  var GRID_SELECTORS = [
    '[data-participant-id] [dir="auto"]',
    '[data-participant-id] span[dir="auto"]',
    '[data-member-id] [dir="auto"]',
    '[data-member-id] span',
    'div[aria-label*="(You)"]',
    '[aria-label*="more actions for"]',
    '[aria-label*="More actions for"]',
    '[aria-label*="more options for"]',
    '[aria-label*="More options for"]',
  ];

  var PANEL_NAME_SELECTORS = [
    '[data-participant-id] [dir="auto"]',
    '[data-participant-id] span[dir="auto"]',
    '[data-participant-id] span',
    '[data-member-id] [dir="auto"]',
    '[data-member-id] span',
    '[role="listitem"] [dir="auto"]',
    '[role="listitem"] span[dir="auto"]',
    '[role="listitem"] span',
    'span[data-hovercard-id]',
    '[aria-label*="more actions for"]',
    '[aria-label*="More actions for"]',
    '[aria-label*="more options for"]',
    '[aria-label*="More options for"]',
    '[aria-label*="Mute"][aria-label*="microphone"]',
    '[aria-label*="mute"][aria-label*="microphone"]',
  ];

  var PANEL_ROOT_SELECTORS = [
    '[aria-label*="Everyone"][role="complementary"]',
    '[aria-label*="People"][role="complementary"]',
    '[role="complementary"] [data-participant-id]',
    '[role="complementary"] [data-member-id]',
    'aside [data-participant-id]',
    'aside [data-member-id]',
    '[role="dialog"] [data-participant-id]',
    '[role="complementary"] [aria-label*="Mute"][aria-label*="microphone"]',
    '[role="complementary"] [aria-label*="mute"][aria-label*="microphone"]',
    '[role="complementary"] [aria-label*="In the meeting"]',
    '[role="complementary"] [aria-label*="In this call"]',
    '[role="complementary"] [aria-label*="Contributors"]',
  ];

  var PANEL_BUTTON_SELECTORS = [
    '[aria-label*="Show everyone"]',
    '[aria-label*="Everyone"]',
    '[aria-label*="People"]',
    '[aria-label*="show everyone"]',
    '[aria-label*="people"]',
    '[aria-label*="Participants"]',
    '[aria-label*="participants"]',
  ];

  /* ─── State ────────────────────────────────────────────────────────── */

  var meetingId = extractMeetingId_(location.href);
  if (!meetingId) return;

  var stateKey = TRACKER_PREFIX + meetingId;
  var state = loadOrCreateState_();
  var trackingEnabled = true;
  var disposed = false;
  var scanQueued = false;
  var scanRunning = false;
  var lastSyncAt = 0;
  var lastFingerprint = '';
  var lastDeepScanAt = 0;
  var lastPanelOpenAttemptAt = 0;
  var scanTimerHandle = null;
  var heartbeatTimer = null;
  var mutationObserver = null;
  var trackerBadgeEl = null;
  var isPanelCurrentlyOpen = false;
  var meetingVerified = false; // Whether the meeting exists in backend
  var meetingVerificationPending = false;
  var meetingVerificationError = '';

  /* ─── Initialization (document_start compatible) ───────────────────── */

  waitForMeetUI_().then(function () {
    initializeTrackerSettings_();
    // First verify if meeting exists in backend, then start tracking
    verifyMeetingExists_().then(function(exists) {
      meetingVerified = exists;
      if (exists) {
        log_('Meeting verified in backend, starting full tracking');
      } else {
        log_('Meeting not found in backend, tracking locally only (use popup to register)');
      }
      startTracking_();
      // Notify popup about verification status
      updateMeetingVerificationStatus_();
    }).catch(function(err) {
      log_('Meeting verification failed, continuing with tracking', err);
      meetingVerificationError = String(err && err.message || err);
      startTracking_();
      updateMeetingVerificationStatus_();
    });
  });

  /* ─── Wait for Meet UI to be ready ─────────────────────────────────── */

  function waitForMeetUI_() {
    return new Promise(function (resolve) {
      function check() {
        if (document.querySelector('[data-participant-id]') ||
            document.querySelector('[data-meeting-id]') ||
            document.querySelector('[data-unresolved-meeting-id]') ||
            document.querySelector('div[jscontroller]') ||
            (document.body && document.body.innerText && /joined/i.test(document.body.innerText))) {
          resolve();
          return;
        }
        if (document.readyState === 'complete' && document.body) {
          resolve();
          return;
        }
        setTimeout(check, 500);
      }
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        check();
      } else {
        document.addEventListener('DOMContentLoaded', check, { once: true });
      }
    });
  }

  /* ─── Meeting Verification ─────────────────────────────────────────── */

  function verifyMeetingExists_() {
    return new Promise(function(resolve, reject) {
      if (meetingVerificationPending) {
        resolve(meetingVerified);
        return;
      }
      meetingVerificationPending = true;
      
      var payload = JSON.stringify({
        action: 'checkMeetingExists',
        extSecret: CONFIG.sharedSecret,
        source: CONFIG.source,
        meetingId: meetingId,
        meetUrl: 'https://meet.google.com/' + meetingId
      });
      
      fetch(CONFIG.backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: payload,
        credentials: 'omit',
        mode: 'cors'
      })
      .then(function(res) { return res.text(); })
      .then(function(text) {
        meetingVerificationPending = false;
        try {
          var parsed = JSON.parse(text || '{}');
          if (parsed.success && parsed.data) {
            resolve(parsed.data.exists === true);
          } else {
            meetingVerificationError = parsed.error || 'Unknown verification error';
            resolve(false);
          }
        } catch (e) {
          meetingVerificationError = 'Failed to parse verification response';
          resolve(false);
        }
      })
      .catch(function(err) {
        meetingVerificationPending = false;
        meetingVerificationError = String(err && err.message || err);
        reject(err);
      });
    });
  }

  function updateMeetingVerificationStatus_() {
    if (!CHROME_OK) return;
    var patch = {};
    patch['ysp_meeting_verified'] = meetingVerified;
    patch['ysp_meeting_verification_error'] = meetingVerificationError;
    patch['ysp_meeting_id'] = meetingId;
    safeChromeStorageSet_(patch);
  }

  function registerMeetingAndSync_() {
    // Force sync to register the meeting in backend (it will auto-create as manual meeting)
    meetingVerified = true;
    updateMeetingVerificationStatus_();
    sync_(true, 'manual_register');
    log_('Meeting registered via manual sync');
  }

  /* ─── State Management ─────────────────────────────────────────────── */

  function loadOrCreateState_() {
    var candidate = null;
    try {
      candidate = JSON.parse(localStorage.getItem(stateKey) || 'null');
    } catch (e) { /* ignore */ }

    if (shouldReuseState_(candidate)) return candidate;

    return {
      meetingId: meetingId,
      meetingUrl: location.href,
      meetingDate: new Date().toISOString().slice(0, 10),
      startedAt: new Date().toISOString(),
      lastScanAt: '',
      updatedAt: '',
      attendees: {},
      meta: {
        syncCount: 0,
        capture: { domCount: 0, panelCount: 0, mergedCount: 0, lastDeepScanAt: '', participantCountHint: 0 },
      },
    };
  }

  function clearMeetingLocalState_() {
    try { localStorage.removeItem(stateKey); } catch (e) { log_('Failed to clear state', e); }
  }

  function shouldReuseState_(candidate) {
    if (!candidate || typeof candidate !== 'object') return false;
    var lastScanMs = Date.parse(String(candidate.lastScanAt || ''));
    if (!isFinite(lastScanMs)) return false;
    return (Date.now() - lastScanMs) <= Number(CONFIG.stateReuseMaxIdleMs || 0);
  }

  function saveState_() {
    state.updatedAt = new Date().toISOString();
    try { localStorage.setItem(stateKey, JSON.stringify(state)); } catch (e) { log_('Failed to save state', e); }
  }

  /* ─── Tracking Lifecycle ───────────────────────────────────────────── */

  function startTracking_() {
    if (disposed) return;
    setTrackerStatus_({ active: true, meetingId: meetingId });
    updateTrackerBadge_('ON');

    // Self-rescheduling scan loop (prevents overlapping async scans)
    scheduleScan_();

    // Heartbeat
    heartbeatTimer = setInterval(function () {
      sync_(false, 'heartbeat');
    }, CONFIG.heartbeatIntervalMs);

    // MutationObserver — target participant container, fall back to body
    setupMutationObserver_();

    // DIAGNOSTIC: Dump all participant-related DOM on startup
    setTimeout(function() {
      dumpParticipantDom_();
    }, 5000);

    // Meeting end detection
    window.addEventListener('beforeunload', function () { finalizeAndSync_('page_unload'); });
    document.addEventListener('pagehide', function () { finalizeAndSync_('page_hide'); });
    setInterval(detectMeetingEnded_, 5000);

    // Listen for force sync and register meeting from popup
    if (CHROME_OK) {
      try {
        chrome.runtime.onMessage.addListener(function (msg) {
          if (msg && msg.type === 'YSP_FORCE_SYNC') {
            sync_(true, 'manual_force');
          }
          if (msg && msg.type === 'YSP_REGISTER_MEETING') {
            registerMeetingAndSync_();
          }
          if (msg && msg.type === 'YSP_GET_VERIFICATION_STATUS') {
            updateMeetingVerificationStatus_();
          }
        });
      } catch (e) { /* ignore */ }
    }
  }

  function scheduleScan_() {
    if (disposed) return;
    scanTimerHandle = setTimeout(function () {
      if (!disposed && trackingEnabled && !scanRunning) {
        scanAndTrack_().then(function () {
          scheduleScan_();
        }).catch(function () {
          scheduleScan_();
        });
      } else {
        scheduleScan_();
      }
    }, CONFIG.scanIntervalMs);
  }

  function setupMutationObserver_() {
    var narrowTarget = null;
    try {
      var pidEl = document.querySelector('[data-participant-id]');
      narrowTarget = pidEl ? pidEl.closest('[jscontroller]') : null;
    } catch (e) { /* ignore */ }
    if (!narrowTarget) narrowTarget = document.querySelector('[role="main"]') || document.body || document.documentElement;

    mutationObserver = new MutationObserver(function () {
      queueScan_();
    });
    mutationObserver.observe(narrowTarget, { childList: true, subtree: true });
  }

  function queueScan_() {
    if (disposed || scanQueued || scanRunning) return;
    scanQueued = true;
    setTimeout(function () {
      scanQueued = false;
      if (!disposed && !scanRunning) scanAndTrack_();
    }, 100);
  }

  /* ─── Core Scan + Track (async) ────────────────────────────────────── */

  async function scanAndTrack_() {
    if (!trackingEnabled || scanRunning) return;
    scanRunning = true;

    try {
      var nowIso = new Date().toISOString();
      state.lastScanAt = nowIso;
      purgeSyntheticAttendees_();

      var result = await extractParticipants_();
      updateTrackingState_(result.names, result.ids, result.isHighConfidence, nowIso);

      var metrics = computeTrackerMetrics_();
      updateTrackerBadge_('ON', metrics);
      setTrackerMetrics_(metrics);
      saveState_();
      sync_(false, 'participant_scan');
    } catch (err) {
      log_('Scan error', err);
    } finally {
      scanRunning = false;
    }
  }

  /* ─── Participant Extraction (async, multi-strategy) ───────────────── */

  async function extractParticipants_() {
    var names = new Set();
    var ids = new Map();

    // Strategy 1: Main DOM grid
    extractParticipantsFromDom_(names, ids);

    // Strategy 2: People panel (primary reliable source)
    var shouldDeepScan = (Date.now() - lastDeepScanAt) >= CONFIG.deepScanIntervalMs;
    var countHint = getParticipantCountHint_();
    var forcePanelScan = countHint > names.size;
    var panelResult = await extractParticipantsFromPeoplePanel_(shouldDeepScan || forcePanelScan);
    panelResult.names.forEach(function (name) { names.add(name); });
    panelResult.ids.forEach(function (name, id) { ids.set(id, name); });
    isPanelCurrentlyOpen = panelResult.panelWasOpen;

    // Strategy 3: aria-label mute fallback
    extractFromAriaLabels_(names);

    // Update capture metadata
    if (!state.meta.capture) {
      state.meta.capture = { domCount: 0, panelCount: 0, mergedCount: 0, lastDeepScanAt: '', participantCountHint: 0 };
    }
    state.meta.capture.domCount = ids.size;
    state.meta.capture.panelCount = panelResult.names.size;
    state.meta.capture.mergedCount = names.size;
    state.meta.capture.participantCountHint = countHint;
    state.meta.capture.afterFallbackCount = names.size;
    if (shouldDeepScan || forcePanelScan) {
      state.meta.capture.lastDeepScanAt = new Date().toISOString();
    }

    var isHighConfidence = isPanelCurrentlyOpen && (countHint <= 0 || names.size >= countHint);
    
    // DIAGNOSTIC: Log extracted participants
    if (VERBOSE_DIAG) console.log('[YSP DIAG] extractParticipants_ result:', {
      namesArray: Array.from(names),
      namesCount: names.size,
      idsCount: ids.size,
      countHint: countHint,
      panelOpen: isPanelCurrentlyOpen,
      isHighConfidence: isHighConfidence
    });
    
    return { names: names, ids: ids, isHighConfidence: isHighConfidence };
  }

  /* Strategy 1: Main grid DOM */
  function extractParticipantsFromDom_(names, ids) {
    var i, j, nodes, text, pidEl, pid;
    var rawTextsFound = [];
    
    for (i = 0; i < GRID_SELECTORS.length; i++) {
      nodes = document.querySelectorAll(GRID_SELECTORS[i]);
      for (j = 0; j < nodes.length; j++) {
        text = extractNameFromNode_(nodes[j]);
        rawTextsFound.push({ selector: GRID_SELECTORS[i], text: text });
        if (isLikelyParticipantName_(text)) {
          names.add(normalizeSpacing_(text));
          pidEl = nodes[j].closest('[data-participant-id]') || nodes[j].closest('[data-member-id]');
          if (pidEl) {
            pid = pidEl.getAttribute('data-participant-id') || pidEl.getAttribute('data-member-id') || '';
            if (pid) ids.set(pid, normalizeSpacing_(text));
          }
        }
      }
    }

    var ariaNames = [];
    var ariaNodes = document.querySelectorAll('[aria-label]');
    for (i = 0; i < ariaNodes.length; i++) {
      var label = String(ariaNodes[i].getAttribute('aria-label') || '').trim();
      var fromMoreActions = label.match(/more (?:actions|options) for (.+)$/i);
      if (fromMoreActions && fromMoreActions[1]) {
        ariaNames.push(fromMoreActions[1]);
        if (isLikelyParticipantName_(fromMoreActions[1])) {
          names.add(normalizeSpacing_(fromMoreActions[1]));
        }
      }
    }
    
    if (VERBOSE_DIAG) console.log('[YSP DIAG] extractParticipantsFromDom_ raw:', { 
      rawTextsFound: rawTextsFound.slice(0, 20), 
      ariaNames: ariaNames,
      namesAfterGrid: Array.from(names)
    });
  }

  /* Strategy 2: People panel with async scroll */
  async function extractParticipantsFromPeoplePanel_(allowDeepScan) {
    var result = { names: new Set(), ids: new Map(), panelWasOpen: false };

    var panelAlreadyOpen = !!findPeoplePanelRoot_();
    if (VERBOSE_DIAG) console.log('[YSP DIAG] Panel already open:', panelAlreadyOpen);
    
    if (!panelAlreadyOpen) {
      var opened = await ensurePeoplePanelOpen_();
      if (VERBOSE_DIAG) console.log('[YSP DIAG] Attempted to open panel, success:', opened);
      if (!opened) return result;
    }

    var panelRoot = findPeoplePanelRoot_();
    if (VERBOSE_DIAG) console.log('[YSP DIAG] Panel root found:', !!panelRoot);
    if (!panelRoot) return result;
    result.panelWasOpen = true;

    // Enhanced diagnostic: dump panel structure (only if verbose)
    if (VERBOSE_DIAG) dumpPanelParticipants_(panelRoot);

    collectParticipantNamesFromRoot_(panelRoot, result.names, result.ids);
    if (VERBOSE_DIAG) console.log('[YSP DIAG] Panel names after initial collect:', Array.from(result.names));

    if (!allowDeepScan) return result;

    var scroller = findScrollableContainer_(panelRoot);
    if (!scroller) {
      lastDeepScanAt = Date.now();
      return result;
    }

    var originalTop = Number(scroller.scrollTop || 0);
    var maxTop = Math.max(0, Number(scroller.scrollHeight || 0) - Number(scroller.clientHeight || 0));

    if (maxTop <= 0) {
      lastDeepScanAt = Date.now();
      return result;
    }

    var passes = Math.max(1, Number(CONFIG.panelScrollPasses || 10));
    var step = Math.max(1, Math.floor(maxTop / passes));

    for (var pos = 0; pos <= maxTop; pos += step) {
      scroller.scrollTop = pos;
      await waitForRender_(CONFIG.scrollSettleMs);
      collectParticipantNamesFromRoot_(panelRoot, result.names, result.ids);
    }

    // Final pass at the very bottom
    scroller.scrollTop = maxTop;
    await waitForRender_(CONFIG.scrollSettleMs);
    collectParticipantNamesFromRoot_(panelRoot, result.names, result.ids);

    scroller.scrollTop = originalTop;
    lastDeepScanAt = Date.now();
    return result;
  }

  /* Async panel open with DOM wait */
  async function ensurePeoplePanelOpen_() {
    if (findPeoplePanelRoot_()) return true;
    if (!CONFIG.autoOpenPeoplePanel) return false;

    var now = Date.now();
    if (now - lastPanelOpenAttemptAt < Number(CONFIG.panelOpenAttemptCooldownMs || 8000)) {
      return false;
    }

    var btn = findPeoplePanelToggleButton_();
    if (!btn) return false;

    lastPanelOpenAttemptAt = now;
    try { btn.click(); } catch (e) { return false; }

    await waitForRender_(50);
    switchToPeopleTabIfNeeded_();

    var maxWait = Number(CONFIG.panelOpenWaitMs || 2000);
    var pollInterval = 100;
    for (var elapsed = 0; elapsed < maxWait; elapsed += pollInterval) {
      await waitForRender_(pollInterval);
      if (findPeoplePanelRoot_()) return true;
    }
    return false;
  }

  /* Strategy 3: aria-label fallback */
  function extractFromAriaLabels_(names) {
    var ariaNodes = document.querySelectorAll(
      '[aria-label*="Mute"][aria-label*="microphone"], [aria-label*="mute"][aria-label*="microphone"]'
    );
    for (var i = 0; i < ariaNodes.length; i++) {
      var name = extractNameFromMuteLabel_(ariaNodes[i]);
      if (name && isLikelyParticipantName_(name)) {
        names.add(normalizeSpacing_(name));
      }
    }
  }

  /* ─── Panel Helpers ────────────────────────────────────────────────── */

  function findPeoplePanelRoot_() {
    for (var i = 0; i < PANEL_ROOT_SELECTORS.length; i++) {
      var node = document.querySelector(PANEL_ROOT_SELECTORS[i]);
      if (node) return node;
    }
    return null;
  }

  function findPeoplePanelToggleButton_() {
    for (var i = 0; i < PANEL_BUTTON_SELECTORS.length; i++) {
      var nodes = document.querySelectorAll(PANEL_BUTTON_SELECTORS[i]);
      for (var j = 0; j < nodes.length; j++) {
        var n = nodes[j];
        if (!n) continue;
        var label = String(n.getAttribute('aria-label') || '').toLowerCase();
        if (label.indexOf('add people') !== -1 || label.indexOf('invite') !== -1) continue;
        if (label.indexOf('chat') !== -1 || label.indexOf('message') !== -1 || label.indexOf('activity') !== -1) continue;
        var clickable = n.closest('button,[role="button"],div[role="button"]') || n;
        if (clickable) return clickable;
      }
    }
    return null;
  }

  function switchToPeopleTabIfNeeded_() {
    var tabs = document.querySelectorAll('button, div[role="tab"], [role="button"]');
    for (var i = 0; i < tabs.length; i++) {
      var node = tabs[i];
      if (!node) continue;
      var txt = normalizeSpacing_(node.textContent || '').toLowerCase();
      var aria = String(node.getAttribute('aria-label') || '').toLowerCase();
      var label = txt || aria;
      if (!label) continue;
      if (label === 'people' || label.indexOf('in the meeting') !== -1 ||
          label.indexOf('in this call') !== -1 || label === 'everyone') {
        try { node.click(); } catch (e) { /* ignore */ }
        return;
      }
    }
  }

  function findScrollableContainer_(root) {
    if (!root) return null;
    var candidates = root.querySelectorAll('div, section');
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (c.scrollHeight > c.clientHeight + 10) return c;
    }
    return root.scrollHeight > root.clientHeight + 10 ? root : null;
  }

  function collectParticipantNamesFromRoot_(root, outputNames, outputIds) {
    if (!root || !outputNames) return;
    var i, j, nodes, text, pidEl, pid;
    for (i = 0; i < PANEL_NAME_SELECTORS.length; i++) {
      nodes = root.querySelectorAll(PANEL_NAME_SELECTORS[i]);
      for (j = 0; j < nodes.length; j++) {
        text = extractNameFromNode_(nodes[j]) || extractNameFromMuteLabel_(nodes[j]);
        if (isLikelyParticipantName_(text)) {
          var normalized = normalizeSpacing_(text);
          outputNames.add(normalized);
          if (outputIds) {
            pidEl = nodes[j].closest('[data-participant-id]') || nodes[j].closest('[data-member-id]');
            if (pidEl) {
              pid = pidEl.getAttribute('data-participant-id') || pidEl.getAttribute('data-member-id') || '';
              if (pid) outputIds.set(pid, normalized);
            }
          }
        }
      }
    }
  }

  /* ─── Name Extraction & Validation ─────────────────────────────────── */

  function extractNameFromNode_(node) {
    var txt = (node && (node.textContent || node.innerText)) ? String(node.textContent || node.innerText) : '';
    var trimmed = normalizeSpacing_(txt);
    if (!trimmed) return '';
    if (/more (actions|options) for /i.test(trimmed)) {
      return trimmed.replace(/more (actions|options) for /i, '').trim();
    }
    return trimmed;
  }

  function extractNameFromMuteLabel_(node) {
    if (!node || !node.getAttribute) return '';
    var label = String(node.getAttribute('aria-label') || '').trim();
    if (!label) return '';
    var m = label.match(/mute\s+(.+?)(?:'s)?\s+microphone/i);
    return m && m[1] ? normalizeSpacing_(m[1]) : '';
  }

  function isLikelyParticipantName_(value) {
    if (!value) return false;
    var cleaned = normalizeSpacing_(value);
    if (!cleaned) return false;
    if (cleaned.length < 2 || cleaned.length > 80) return false;
    if (/[@#<>|{}\[\]]/.test(cleaned)) return false;
    if (!/[a-z0-9]/i.test(cleaned)) return false;
    if (looksLikeRepeatedPhrase_(cleaned)) return false;
    for (var i = 0; i < NOISE_PATTERNS.length; i++) {
      if (NOISE_PATTERNS[i].test(cleaned)) return false;
    }
    var lowered = cleaned.toLowerCase();
    if (STOPWORDS.has(lowered)) return false;
    if (/^\d+$/.test(lowered)) return false;
    return true;
  }

  function looksLikeRepeatedPhrase_(value) {
    var t = normalizeSpacing_(value);
    if (t.length < 8 || t.length % 2 !== 0) return false;
    var half = t.length / 2;
    return t.slice(0, half) === t.slice(half);
  }

  /* ─── Participant Count Hint ───────────────────────────────────────── */

  function getParticipantCountHint_() {
    var best = 0;
    var nodes = document.querySelectorAll('button[aria-label], div[role="button"][aria-label]');
    for (var i = 0; i < nodes.length; i++) {
      var label = String(nodes[i].getAttribute('aria-label') || '');
      var lower = label.toLowerCase();
      if (lower.indexOf('participant') === -1 &&
          lower.indexOf('everyone') === -1 &&
          lower.indexOf('show everyone') === -1 &&
          lower.indexOf('people') === -1) {
        continue;
      }

      var fromLabel = label.match(/(\d+)\s*participants?/i);
      if (fromLabel) {
        best = Math.max(best, Number(fromLabel[1] || 0));
      }

      var txt = normalizeSpacing_(nodes[i].textContent || '');
      if (/^\d{1,3}$/.test(txt)) {
        best = Math.max(best, Number(txt));
      } else {
        var fromText = txt.match(/(\d+)\s*participants?/i);
        if (fromText) {
          best = Math.max(best, Number(fromText[1] || 0));
        }
      }
    }
    return best;
  }

  /* ─── Confidence-Based Leave Detection ─────────────────────────────── */

  function updateTrackingState_(currentNamesSet, currentIds, isHighConfidence, nowIso) {
    var nowMs = Date.parse(nowIso) || Date.now();
    var activeKeys = new Set();
    var countHint = Number(state.meta.capture && state.meta.capture.participantCountHint || 0);
    var isUndercaptured = countHint > 0 && currentNamesSet.size < countHint;
    
    // DIAGNOSTIC: Log incoming names to updateTrackingState_
    if (VERBOSE_DIAG) console.log('[YSP DIAG] updateTrackingState_ called:', {
      incomingNames: Array.from(currentNamesSet),
      incomingCount: currentNamesSet.size,
      countHint: countHint,
      isUndercaptured: isUndercaptured,
      currentStateKeys: Object.keys(state.attendees || {})
    });

    currentNamesSet.forEach(function (displayName) {
      var normalizedName = normalizeName_(displayName);
      if (VERBOSE_DIAG) console.log('[YSP DIAG] Processing name: "' + displayName + '" -> normalized: "' + normalizedName + '"');
      if (!normalizedName) {
        if (VERBOSE_DIAG) console.log('[YSP DIAG] SKIPPED - empty normalized name');
        return;
      }
      var key = normalizedName;
      activeKeys.add(key);

      if (!state.attendees[key]) {
        if (VERBOSE_DIAG) console.log('[YSP DIAG] NEW attendee added with key: "' + key + '"');
        state.attendees[key] = {
          participantKey: key,
          name: displayName,
          normalizedName: normalizedName,
          participantId: '',
          firstJoinTime: nowIso,
          lastSeenTime: nowIso,
          lastLeaveTime: '',
          totalDurationSeconds: 0,
          joinCount: 1,
          exitCount: 0,
          isPresent: true,
          consecutiveMisses: 0,
          sessions: [{ joinTime: nowIso, leaveTime: '', durationSeconds: 0 }],
        };
      } else {
        var attendee = state.attendees[key];
        attendee.name = displayName;
        attendee.lastSeenTime = nowIso;
        attendee.consecutiveMisses = 0;

        if (!attendee.isPresent) {
          attendee.isPresent = true;
          attendee.joinCount = Number(attendee.joinCount || 0) + 1;
          attendee.sessions = Array.isArray(attendee.sessions) ? attendee.sessions : [];
          attendee.sessions.push({ joinTime: nowIso, leaveTime: '', durationSeconds: 0 });
        }
      }

      // Attach participant ID
      if (currentIds && currentIds.size > 0) {
        currentIds.forEach(function (name, pid) {
          if (normalizeName_(name) === key && pid) {
            state.attendees[key].participantId = pid;
          }
        });
      }
    });

    // Process absent participants — confidence-based
    var attendeeKeys = Object.keys(state.attendees);
    for (var i = 0; i < attendeeKeys.length; i++) {
      var key = attendeeKeys[i];
      var att = state.attendees[key];
      if (!att || !att.isPresent) continue;
      if (activeKeys.has(key)) continue;

      if (isUndercaptured) continue;

      att.consecutiveMisses = (att.consecutiveMisses || 0) + 1;

      var threshold = CONFIG.consecutiveMissesForLeave;
      if (isHighConfidence) threshold = 2;

      if (att.consecutiveMisses < threshold) continue;

      att.isPresent = false;
      att.lastLeaveTime = nowIso;
      att.exitCount = Number(att.exitCount || 0) + 1;
      att.consecutiveMisses = 0;

      var sessions = Array.isArray(att.sessions) ? att.sessions : [];
      if (sessions.length > 0) {
        var lastSession = sessions[sessions.length - 1];
        if (lastSession && !lastSession.leaveTime) {
          lastSession.leaveTime = nowIso;
          lastSession.durationSeconds = calcDurationSeconds_(lastSession.joinTime, lastSession.leaveTime);
        }
      }
    }

    recomputeAllDurations_(nowIso);
    
    // DIAGNOSTIC: Final state summary
    var finalKeys = Object.keys(state.attendees || {});
    if (VERBOSE_DIAG) console.log('[YSP DIAG] updateTrackingState_ FINAL:', {
      totalAttendees: finalKeys.length,
      attendeeKeys: finalKeys,
      presentCount: finalKeys.filter(function(k) { return state.attendees[k] && state.attendees[k].isPresent; }).length
    });
  }

  /* ─── Synthetic / Noise Cleanup ────────────────────────────────────── */

  function purgeSyntheticAttendees_() {
    var attendees = state && state.attendees ? state.attendees : {};
    var keys = Object.keys(attendees);
    for (var i = 0; i < keys.length; i++) {
      var attendee = attendees[keys[i]];
      if (!attendee) continue;
      if (isSyntheticParticipant_(attendee, keys[i])) {
        delete attendees[keys[i]];
      }
    }
  }

  function isSyntheticParticipant_(attendee, key) {
    var name = normalizeSpacing_(String(attendee && attendee.name || '')).toLowerCase();
    return /^external participant #?\d+$/.test(name) ||
           /^external participant #?\d+$/.test(key);
  }

  /* ─── Duration Computation ─────────────────────────────────────────── */

  function recomputeAllDurations_(nowIso) {
    var keys = Object.keys(state.attendees);
    for (var i = 0; i < keys.length; i++) {
      var attendee = state.attendees[keys[i]];
      if (!attendee) continue;
      attendee.totalDurationSeconds = calculateTotalDuration_(attendee, nowIso);
    }
  }

  function calculateTotalDuration_(attendee, nowIso) {
    var sessions = Array.isArray(attendee.sessions) ? attendee.sessions : [];
    var total = 0;
    for (var i = 0; i < sessions.length; i++) {
      var s = sessions[i];
      if (!s || !s.joinTime) continue;
      total += calcDurationSeconds_(s.joinTime, s.leaveTime || nowIso);
    }
    return Math.max(0, Math.floor(total));
  }

  function calcDurationSeconds_(startIso, endIso) {
    var a = Date.parse(startIso);
    var b = Date.parse(endIso);
    if (!isFinite(a) || !isFinite(b) || b < a) return 0;
    return Math.floor((b - a) / 1000);
  }

  /* ─── Payload Builder ──────────────────────────────────────────────── */

  function buildPayload_(isFinal, reason) {
    var nowIso = new Date().toISOString();
    if (isFinal) {
      closeOpenSessions_(nowIso);
      recomputeAllDurations_(nowIso);
      saveState_();
    }

    var attendees = [];
    var keys = Object.keys(state.attendees);
    for (var i = 0; i < keys.length; i++) {
      var attendee = state.attendees[keys[i]];
      if (!attendee) continue;
      attendees.push({
        participantKey: attendee.participantKey,
        participantId: attendee.participantId || '',
        name: attendee.name,
        normalizedName: attendee.normalizedName,
        firstJoinTime: attendee.firstJoinTime || '',
        lastLeaveTime: attendee.lastLeaveTime || '',
        totalDurationSeconds: Number(attendee.totalDurationSeconds || 0),
        joinCount: Number(attendee.joinCount || 0),
        exitCount: Number(attendee.exitCount || 0),
        isPresent: !!attendee.isPresent,
        sessions: Array.isArray(attendee.sessions) ? attendee.sessions : [],
      });
    }

    // DIAGNOSTIC: Log attendees being sent
    if (VERBOSE_DIAG) console.log('[YSP DIAG] buildPayload_ attendees:', {
      count: attendees.length,
      attendees: attendees.map(function(a) { return { pk: a.participantKey, name: a.name, normalized: a.normalizedName, present: a.isPresent }; })
    });
    
    return {
      action: 'syncMeetAttendance',
      extensionSecret: CONFIG.sharedSecret,
      source: CONFIG.source,
      payloadVersion: 2,
      payloadId: meetingId + '-' + Date.now(),
      meeting: {
        id: state.meetingId,
        meetCode: meetingId,
        url: state.meetingUrl || location.href,
        date: state.meetingDate,
        startedAt: state.startedAt,
        lastTrackedAt: nowIso,
        originHint: MEETING_ORIGIN_HINT,
      },
      attendees: attendees,
      client: {
        isFinal: !!isFinal,
        reason: reason || '',
        trackerVersion: TRACKER_VERSION,
        trackingMode: 'automatic',
        autoStart: true,
        autoStop: true,
        pageUrl: location.href,
        userAgent: navigator.userAgent,
        sentAt: nowIso,
        captureConfidence: isPanelCurrentlyOpen ? 'high' : 'low',
        panelOpen: isPanelCurrentlyOpen,
        participantCountHint: state.meta.capture ? state.meta.capture.participantCountHint : 0,
      },
    };
  }

  function closeOpenSessions_(nowIso) {
    var keys = Object.keys(state.attendees);
    for (var i = 0; i < keys.length; i++) {
      var attendee = state.attendees[keys[i]];
      if (!attendee || !attendee.isPresent) continue;
      attendee.isPresent = false;
      attendee.lastLeaveTime = nowIso;
      attendee.exitCount = Number(attendee.exitCount || 0) + 1;
      var sessions = Array.isArray(attendee.sessions) ? attendee.sessions : [];
      if (!sessions.length) continue;
      var last = sessions[sessions.length - 1];
      if (last && !last.leaveTime) {
        last.leaveTime = nowIso;
        last.durationSeconds = calcDurationSeconds_(last.joinTime, nowIso);
      }
    }
  }

  /* ─── Sync ─────────────────────────────────────────────────────────── */

  function shouldSync_(payload, force) {
    if (force) return true;
    var now = Date.now();
    if (now - lastSyncAt < CONFIG.minSyncGapMs) return false;
    var fp = JSON.stringify(
      (payload.attendees || []).map(function (a) {
        return [a.participantKey, a.isPresent ? 1 : 0, a.totalDurationSeconds, a.joinCount, a.exitCount];
      })
    );
    if (fp === lastFingerprint) return false;
    lastFingerprint = fp;
    return true;
  }

  function sync_(isFinal, reason) {
    if (disposed) return;
    if (!trackingEnabled && !isFinal) return;
    if (!CONFIG.backendUrl || !/^https:\/\/script\.google\.com\/macros\/s\//.test(CONFIG.backendUrl)) return;
    if (!CONFIG.sharedSecret) return;
    
    // Skip sync if meeting not verified in backend (unless it's a manual force/register)
    if (!meetingVerified && reason !== 'manual_force' && reason !== 'manual_register') {
      if (VERBOSE_DIAG) console.log('[YSP DIAG] sync_ SKIPPED - meeting not verified in backend');
      return;
    }

    var payload = buildPayload_(!!isFinal, reason);
    
    // DIAGNOSTIC: Log full payload before sync check
    if (VERBOSE_DIAG) console.log('[YSP DIAG] sync_ payload built:', {
      meetingId: payload.meeting && payload.meeting.id,
      attendeesCount: payload.attendees ? payload.attendees.length : 0,
      isFinal: isFinal,
      reason: reason
    });
    
    if (!shouldSync_(payload, !!isFinal)) {
      if (VERBOSE_DIAG) console.log('[YSP DIAG] sync_ SKIPPED by shouldSync_');
      return;
    }

    lastSyncAt = Date.now();
    state.meta.syncCount = Number(state.meta.syncCount || 0) + 1;
    saveState_();

    sendSyncToBackground_(payload, !!isFinal, reason || '');
  }

  /* ─── Meeting End Detection ────────────────────────────────────────── */

  function detectMeetingEnded_() {
    var leftText = document.body ? document.body.innerText : '';
    if (!leftText) return;
    if (/you left the meeting/i.test(leftText) || /rejoin/i.test(leftText)) {
      finalizeAndSync_('meeting_end_detected');
    }
  }

  function finalizeAndSync_(reason) {
    if (disposed) return;
    disposed = true;

    if (scanTimerHandle) clearTimeout(scanTimerHandle);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (mutationObserver) {
      try { mutationObserver.disconnect(); } catch (e) { /* ignore */ }
    }

    sync_(true, reason || 'finalize');
    setTrackerStatus_({ active: false, meetingId: '' });
    updateTrackerBadge_('OFF');
    clearMeetingLocalState_();
  }

  /* ─── Sync Transport ───────────────────────────────────────────────── */

  function sendSyncToBackground_(payload, isFinal, reason) {
    if (!isExtensionContextAlive_()) {
      sendSyncDirect_(payload, isFinal, reason);
      return;
    }

    var outgoing = Object.assign({}, payload, { backendUrl: CONFIG.backendUrl });
    if (VERBOSE_DIAG) console.log('[YSP DIAG] sendSyncToBackground_ sending', outgoing.attendees ? outgoing.attendees.length : 0, 'attendees');
    safeRuntimeSendMessage_({ type: 'YSP_MEET_SYNC', payload: outgoing }, function (resp, hasRuntimeError) {
      if (VERBOSE_DIAG) console.log('[YSP DIAG] sendSyncToBackground_ response:', { resp: resp, hasRuntimeError: hasRuntimeError });
      if (hasRuntimeError || !resp || !resp.ok) {
        sendSyncDirect_(payload, isFinal, reason);
        return;
      }
      var data = resp.data || {};
      var origin = String(resp.meetingOrigin || data.meetingOrigin || '');
      state.meta.lastServerAckAt = new Date().toISOString();
      state.meta.lastServerMeetingOrigin = origin;
      saveState_();
      
      // Mark meeting as verified since sync succeeded
      if (!meetingVerified) {
        meetingVerified = true;
        updateMeetingVerificationStatus_();
        log_('Meeting now verified (sync succeeded)');
      }

      var storagePatch = {};;
      storagePatch[STORAGE_KEYS.lastSyncAt] = state.meta.lastServerAckAt;
      storagePatch[STORAGE_KEYS.lastSyncOk] = true;
      storagePatch[STORAGE_KEYS.lastSyncError] = '';
      if (origin) storagePatch[STORAGE_KEYS.lastMeetingOrigin] = origin;
      safeChromeStorageSet_(storagePatch);

      log_('Synced', { final: !!isFinal, reason: reason, origin: origin });
    });
  }

  function sendSyncDirect_(payload, isFinal, reason) {
    if (VERBOSE_DIAG) console.log('[YSP DIAG] sendSyncDirect_ sending', payload.attendees ? payload.attendees.length : 0, 'attendees to', CONFIG.backendUrl);
    fetch(CONFIG.backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: 'omit',
      mode: 'cors',
    })
      .then(function (res) { return res.text(); })
      .then(function (text) {
        if (VERBOSE_DIAG) console.log('[YSP DIAG] sendSyncDirect_ raw response:', text);
        var parsed = null;
        try { parsed = JSON.parse(String(text || '{}')); } catch (e) { parsed = null; }
        if (VERBOSE_DIAG) console.log('[YSP DIAG] sendSyncDirect_ parsed response:', parsed);

        if (parsed && parsed.success) {
          var origin = parsed.meetingOrigin || (parsed.data && parsed.data.meetingOrigin) || '';
          state.meta.lastServerAckAt = new Date().toISOString();
          state.meta.lastServerMeetingOrigin = String(origin || '');
          saveState_();
          
          // Mark meeting as verified since sync succeeded
          if (!meetingVerified) {
            meetingVerified = true;
            updateMeetingVerificationStatus_();
            log_('Meeting now verified (direct sync succeeded)');
          }
        }

        if (isExtensionContextAlive_()) {
          var ok = !!(parsed && parsed.success);
          var patch = {};
          patch[STORAGE_KEYS.lastSyncAt] = new Date().toISOString();
          patch[STORAGE_KEYS.lastSyncOk] = ok;
          patch[STORAGE_KEYS.lastSyncError] = ok ? '' : 'Direct sync response not OK';
          if (state.meta.lastServerMeetingOrigin) {
            patch[STORAGE_KEYS.lastMeetingOrigin] = state.meta.lastServerMeetingOrigin;
          }
          safeChromeStorageSet_(patch);
        }

        log_('Synced (direct)', { final: !!isFinal, reason: reason });
      })
      .catch(function (error) {
        if (isExtensionContextAlive_()) {
          var patch = {};
          patch[STORAGE_KEYS.lastSyncAt] = new Date().toISOString();
          patch[STORAGE_KEYS.lastSyncOk] = false;
          patch[STORAGE_KEYS.lastSyncError] = String(error && (error.message || error.toString()) || error);
          safeChromeStorageSet_(patch);
        }
        log_('Sync failed (direct)', error);
      });
  }

  /* ─── Chrome Extension Helpers ─────────────────────────────────────── */

  function isExtensionContextAlive_() {
    if (!CHROME_OK) return false;
    try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; }
  }

  function safeChromeStorageSet_(payload) {
    if (!isExtensionContextAlive_()) return;
    try {
      chrome.storage.local.set(payload, function () {
        try { void chrome.runtime.lastError; } catch (e) { /* ignore */ }
      });
    } catch (e) { /* ignore */ }
  }

  function safeChromeStorageGet_(defaults, callback) {
    if (!isExtensionContextAlive_()) {
      if (typeof callback === 'function') callback(defaults || {});
      return;
    }
    try {
      chrome.storage.local.get(defaults, function (items) {
        try {
          if (chrome.runtime.lastError) {
            if (typeof callback === 'function') callback(defaults || {});
            return;
          }
        } catch (e) {
          if (typeof callback === 'function') callback(defaults || {});
          return;
        }
        if (typeof callback === 'function') callback(items || defaults || {});
      });
    } catch (e) {
      if (typeof callback === 'function') callback(defaults || {});
    }
  }

  function safeRuntimeSendMessage_(message, callback) {
    if (!isExtensionContextAlive_()) {
      if (typeof callback === 'function') callback(null, true);
      return;
    }
    try {
      chrome.runtime.sendMessage(message, function (resp) {
        var hasRuntimeError = false;
        try { hasRuntimeError = !!chrome.runtime.lastError; } catch (e) { hasRuntimeError = true; }
        if (typeof callback === 'function') callback(resp || null, hasRuntimeError);
      });
    } catch (e) {
      if (typeof callback === 'function') callback(null, true);
    }
  }

  /* ─── Tracker Settings ─────────────────────────────────────────────── */

  function initializeTrackerSettings_() {
    if (!isExtensionContextAlive_()) return;
    safeChromeStorageGet_({ ysp_tracker_enabled: true }, function (items) {
      trackingEnabled = !!items.ysp_tracker_enabled;
      updateTrackerBadge_(trackingEnabled ? 'ON' : 'OFF');
      if (!trackingEnabled) {
        setTrackerStatus_({ active: false, meetingId: '' });
      }
    });

    try {
      chrome.storage.onChanged.addListener(function (changes, areaName) {
        if (areaName !== 'local' || !changes || !changes.ysp_tracker_enabled) return;
        trackingEnabled = !!changes.ysp_tracker_enabled.newValue;
        updateTrackerBadge_(trackingEnabled ? 'ON' : 'OFF');
        if (!trackingEnabled) {
          setTrackerStatus_({ active: false, meetingId: '' });
        } else {
          setTrackerStatus_({ active: true, meetingId: meetingId });
        }
      });
    } catch (e) { /* ignore */ }
  }

  function setTrackerStatus_(stateUpdate) {
    if (!isExtensionContextAlive_()) return;
    var payload = {};
    if (Object.prototype.hasOwnProperty.call(stateUpdate || {}, 'active')) {
      payload[STORAGE_KEYS.active] = !!stateUpdate.active;
    }
    if (Object.prototype.hasOwnProperty.call(stateUpdate || {}, 'meetingId')) {
      payload[STORAGE_KEYS.meetingId] = String(stateUpdate.meetingId || '');
    }
    safeChromeStorageSet_(payload);
  }

  function setTrackerMetrics_(metrics) {
    if (!isExtensionContextAlive_()) return;
    var patch = {};
    patch[STORAGE_KEYS.liveCount] = Number(metrics && metrics.liveCount || 0);
    patch[STORAGE_KEYS.seenCount] = Number(metrics && metrics.seenCount || 0);
    patch[STORAGE_KEYS.captureCount] = Number(metrics && metrics.captureCount || 0);
    safeChromeStorageSet_(patch);
  }

  function computeTrackerMetrics_() {
    var keys = Object.keys(state.attendees || {});
    var liveCount = 0;
    for (var i = 0; i < keys.length; i++) {
      if (state.attendees[keys[i]] && state.attendees[keys[i]].isPresent) liveCount++;
    }
    var captureCount = Number(state.meta.capture && state.meta.capture.mergedCount || 0);
    return { liveCount: liveCount, seenCount: keys.length, captureCount: captureCount };
  }

  /* ─── DIAGNOSTIC: DOM Dump ─────────────────────────────────────────── */
  
  function dumpParticipantDom_() {
    console.log('[YSP DIAG] ========== DOM DUMP START ==========');
    
    // 1. All data-participant-id elements
    var participantEls = document.querySelectorAll('[data-participant-id]');
    console.log('[YSP DIAG] [data-participant-id] elements:', participantEls.length);
    participantEls.forEach(function(el, i) {
      var pid = el.getAttribute('data-participant-id');
      var textContent = (el.textContent || '').substring(0, 100);
      console.log('[YSP DIAG]   #' + i + ' pid=' + pid + ' text=' + textContent);
    });
    
    // 2. All data-member-id elements
    var memberEls = document.querySelectorAll('[data-member-id]');
    console.log('[YSP DIAG] [data-member-id] elements:', memberEls.length);
    memberEls.forEach(function(el, i) {
      var mid = el.getAttribute('data-member-id');
      var textContent = (el.textContent || '').substring(0, 100);
      console.log('[YSP DIAG]   #' + i + ' mid=' + mid + ' text=' + textContent);
    });
    
    // 3. All role="listitem" elements (panel list)
    var listItems = document.querySelectorAll('[role="listitem"]');
    console.log('[YSP DIAG] [role="listitem"] elements:', listItems.length);
    listItems.forEach(function(el, i) {
      var textContent = (el.textContent || '').substring(0, 100);
      console.log('[YSP DIAG]   #' + i + ' text=' + textContent);
    });
    
    // 4. "more actions for X" aria labels
    var moreActionsEls = document.querySelectorAll('[aria-label*="more actions for"], [aria-label*="More actions for"], [aria-label*="more options for"], [aria-label*="More options for"]');
    console.log('[YSP DIAG] "more actions/options for" elements:', moreActionsEls.length);
    moreActionsEls.forEach(function(el, i) {
      console.log('[YSP DIAG]   #' + i + ' aria-label=' + el.getAttribute('aria-label'));
    });
    
    // 5. Video tiles / name overlays
    var videoNames = document.querySelectorAll('[dir="auto"]');
    var uniqueVideoNames = [];
    videoNames.forEach(function(el) {
      var txt = (el.textContent || '').trim();
      if (txt && txt.length > 1 && txt.length < 60 && uniqueVideoNames.indexOf(txt) === -1) {
        uniqueVideoNames.push(txt);
      }
    });
    console.log('[YSP DIAG] Unique [dir="auto"] texts:', uniqueVideoNames);
    
    // 6. Participant count indicator
    var countHint = getParticipantCountHint_();
    console.log('[YSP DIAG] Participant count hint from UI:', countHint);
    
    // 7. Panel root check
    var panelRoot = findPeoplePanelRoot_();
    console.log('[YSP DIAG] People panel root found:', !!panelRoot);
    if (panelRoot) {
      console.log('[YSP DIAG] Panel root innerHTML preview:', (panelRoot.innerHTML || '').substring(0, 500));
    }
    
    console.log('[YSP DIAG] ========== DOM DUMP END ==========');
  }

  function dumpPanelParticipants_(panelRoot) {
    if (!panelRoot) return;
    console.log('[YSP DIAG] ========== PANEL DUMP START ==========');
    
    // Find all li, list items in the panel
    var listItems = panelRoot.querySelectorAll('li, [role="listitem"], [role="row"]');
    console.log('[YSP DIAG] Panel list items (li, listitem, row):', listItems.length);
    for (var i = 0; i < listItems.length; i++) {
      var el = listItems[i];
      console.log('[YSP DIAG]   ListItem #' + i + ':', {
        text: (el.textContent || '').substring(0, 120),
        tagName: el.tagName,
        role: el.getAttribute('role'),
        ariaLabel: el.getAttribute('aria-label')
      });
    }
    
    // Find all elements with names using diverse selectors
    var nameSelectors = [
      '[data-participant-id]',
      '[data-member-id]',
      'span[dir="auto"]',
      '[dir="auto"]',
      '[data-hovercard-id]',
      '[data-tooltip]',
      '[aria-labelledby]',
    ];
    
    for (var s = 0; s < nameSelectors.length; s++) {
      var selector = nameSelectors[s];
      var els = panelRoot.querySelectorAll(selector);
      if (els.length > 0) {
        console.log('[YSP DIAG] Panel "' + selector + '" elements:', els.length);
        for (var j = 0; j < els.length; j++) {
          var text = (els[j].textContent || '').trim().substring(0, 80);
          console.log('[YSP DIAG]     #' + j + ': "' + text + '"');
        }
      }
    }
    
    // Get all spans with any text
    var allSpans = panelRoot.querySelectorAll('span');
    var spanTexts = [];
    for (var k = 0; k < allSpans.length; k++) {
      var spanText = (allSpans[k].textContent || '').trim();
      if (spanText && spanText.length > 1 && spanText.length < 60) {
        if (spanTexts.indexOf(spanText) === -1) {
          spanTexts.push(spanText);
        }
      }
    }
    console.log('[YSP DIAG] Panel unique span texts:', spanTexts);
    
    // Get all divs with aria-label (potential participant rows)
    var ariaRows = panelRoot.querySelectorAll('[aria-label]');
    console.log('[YSP DIAG] Panel elements with aria-label:', ariaRows.length);
    for (var m = 0; m < Math.min(ariaRows.length, 15); m++) {
      var label = ariaRows[m].getAttribute('aria-label') || '';
      if (label.length > 5) {
        console.log('[YSP DIAG]   aria-label: "' + label.substring(0, 100) + '"');
      }
    }
    
    console.log('[YSP DIAG] ========== PANEL DUMP END ==========');
  }

  /* ─── Utility ──────────────────────────────────────────────────────── */

  function extractMeetingId_(url) {
    try {
      var parsed = new URL(url);
      var match = parsed.pathname.match(/\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
      return match ? match[1].toLowerCase() : '';
    } catch (e) { return ''; }
  }

  function normalizeName_(name) {
    if (!name) return '';
    return normalizeSpacing_(name)
      .toLowerCase()
      .replace(/\(you\)/gi, '')
      .replace(/[^a-z0-9 ]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeSpacing_(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function waitForRender_(ms) {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        setTimeout(resolve, ms || 0);
      });
    });
  }

  /* ─── Badge Overlay ────────────────────────────────────────────────── */

  function updateTrackerBadge_(label, metrics) {
    var details = metrics
      ? (' | Live ' + Number(metrics.liveCount || 0) + ' | Seen ' + Number(metrics.seenCount || 0))
      : '';
    var text = 'YSP Tracker: ' + label + details;

    if (trackerBadgeEl) {
      trackerBadgeEl.textContent = text;
      trackerBadgeEl.style.background = label === 'ON' ? '#16a34a' : '#b91c1c';
      return;
    }
    if (!document.body) return;

    trackerBadgeEl = document.createElement('div');
    trackerBadgeEl.textContent = text;
    trackerBadgeEl.style.cssText = [
      'position: fixed',
      'bottom: 14px',
      'right: 14px',
      'z-index: 2147483647',
      'padding: 6px 10px',
      'border-radius: 999px',
      'font-size: 12px',
      'font-weight: 700',
      'color: #ffffff',
      'background: ' + (label === 'ON' ? '#16a34a' : '#b91c1c'),
      'box-shadow: 0 8px 20px rgba(0,0,0,0.25)',
      'pointer-events: none',
      'user-select: none',
      'font-family: Arial, sans-serif',
    ].join('; ');
    document.body.appendChild(trackerBadgeEl);
  }

  function log_() {
    if (!CONFIG.debug) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[YSP Meet Tracker v2]');
    console.log.apply(console, args);
  }
  
  // DIAGNOSTIC: Expose dump function globally for manual console calls
  // Note: yspFullDump() and yspVerbose() are exposed at the top of the file (before early return)
  window.yspDumpParticipants = dumpParticipantDom_;
  window.yspForceSync = function() { sync_(true, 'manual_console'); };
  console.log('[YSP] Tracker ACTIVE. Additional helpers: yspDumpParticipants(), yspForceSync()');
})();
