(function () {
  'use strict';

  const CONFIG = {
    backendUrl: 'https://script.google.com/macros/s/AKfycbyTYEMa5apc6ZSCVce1qowpbcooRB88OjtW-nSvsb4ZK-W8N9XcQp2dbigoaPTg316J/exec',
    sharedSecret: 'P37-5mgdNfjRd9KcSt4gw5SYVfzO5EHFyq4XYHKVe7PpL7FRbwab_czEa3ez4YsN',
    source: 'ysp-meet-extension-v2',
    scanIntervalMs: 2500,
    heartbeatIntervalMs: 30000,
    minSyncGapMs: 7000,
    deepScanIntervalMs: 12000,
    panelScrollPasses: 4,
    autoOpenPeoplePanel: true,
    panelOpenAttemptCooldownMs: 15000,
    stateReuseMaxIdleMs: 2 * 60 * 1000,
    leaveGraceMs: 90000,
    debug: false,
  };
  const TRACKER_VERSION = '2.0.0';
  const MEETING_ORIGIN_HINT = 'meet_page_auto';

  const TRACKER_PREFIX = 'ysp_meet_tracker_state_';
  const CHROME_OK = typeof chrome !== 'undefined' && chrome && chrome.runtime && chrome.storage && chrome.storage.local;
  const STORAGE_KEYS = {
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
  const STOPWORDS = new Set([
    'you',
    'search',
    'people',
    'chat',
    'present now',
    'meeting details',
    'raise hand',
    'leave call',
    'camera off',
    'microphone off',
  ]);
  const NOISE_PATTERNS = [
    /more options for/i,
    /^more_vert$/i,
    /^frame_person/i,
    /^reframe$/i,
    /visual effects/i,
    /backgrounds and effects/i,
    /others might still see your full video/i,
    /present now/i,
    /meeting details/i,
    /raise hand/i,
    /leave call/i,
    /camera off/i,
    /microphone off/i,
    /^chat$/i,
  ];

  if (!/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i.test(location.href)) {
    return;
  }

  const meetingId = extractMeetingId_(location.href);
  if (!meetingId) return;

  const stateKey = TRACKER_PREFIX + meetingId;
  const loadedState = loadState_();
  let state = shouldReuseState_(loadedState) ? loadedState : createInitialState_();
  let disposed = false;
  let scanTimer = null;
  let heartbeatTimer = null;
  let mutationObserver = null;
  let scanQueued = false;
  let lastFingerprint = '';
  let lastSyncAt = 0;
  let lastDeepScanAt = 0;
  let trackingEnabled = true;
  let trackerBadgeEl = null;
  let lastPanelOpenAttemptAt = 0;

  log_('Tracker started for meeting', meetingId);
  initializeTrackerSettings_();
  updateTrackerBadge_('ON');
  setTrackerStatus_({ active: true, meetingId: meetingId });
  queueScan_();

  scanTimer = setInterval(queueScan_, CONFIG.scanIntervalMs);
  heartbeatTimer = setInterval(function () {
    sync_(false, 'heartbeat');
  }, CONFIG.heartbeatIntervalMs);

  mutationObserver = new MutationObserver(function () {
    queueScan_();
    detectMeetingEnded_();
  });
  mutationObserver.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
  });

  window.addEventListener('beforeunload', function () {
    finalizeAndSync_('beforeunload');
  });
  window.addEventListener('pagehide', function () {
    finalizeAndSync_('pagehide');
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      sync_(false, 'tab_hidden');
    } else {
      queueScan_();
    }
  });

  function createInitialState_() {
    const now = new Date().toISOString();
    return {
      meetingId: meetingId,
      meetingUrl: location.href,
      meetingDate: now.slice(0, 10),
      startedAt: now,
      updatedAt: now,
      lastScanAt: null,
      attendees: {},
      meta: {
        syncCount: 0,
        trackerVersion: TRACKER_VERSION,
        originHint: MEETING_ORIGIN_HINT,
        lastServerAckAt: '',
        lastServerMeetingOrigin: '',
      },
    };
  }

  function loadState_() {
    try {
      const raw = localStorage.getItem(stateKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.meetingId !== meetingId || typeof parsed.attendees !== 'object') {
        return null;
      }
      return parsed;
    } catch (error) {
      log_('Failed to load state', error);
      return null;
    }
  }

  function clearMeetingLocalState_() {
    try {
      localStorage.removeItem(stateKey);
    } catch (error) {
      log_('Failed to clear state', error);
    }
  }

  function shouldReuseState_(candidate) {
    if (!candidate || typeof candidate !== 'object') return false;
    const lastScanMs = Date.parse(String(candidate.lastScanAt || ''));
    if (!isFinite(lastScanMs)) return false;
    return (Date.now() - lastScanMs) <= Number(CONFIG.stateReuseMaxIdleMs || 0);
  }

  function saveState_() {
    state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(stateKey, JSON.stringify(state));
    } catch (error) {
      log_('Failed to save state', error);
    }
  }

  function queueScan_() {
    if (disposed || scanQueued) return;
    scanQueued = true;
    setTimeout(function () {
      scanQueued = false;
      if (!disposed) scanAndTrack_();
    }, 100);
  }

  function scanAndTrack_() {
    if (!trackingEnabled) return;
    const nowIso = new Date().toISOString();
    state.lastScanAt = nowIso;
    purgeSyntheticAttendees_();

    const currentNames = extractParticipants_();
    updateTrackingState_(currentNames, nowIso);
    const metrics = computeTrackerMetrics_();
    updateTrackerBadge_('ON', metrics);
    setTrackerMetrics_(metrics);
    saveState_();
    sync_(false, 'participant_scan');
  }

  function extractParticipants_() {
    const names = new Set();
    const domNames = extractParticipantsFromDom_();
    domNames.forEach(function (name) { names.add(name); });

    const shouldDeepScan = (Date.now() - lastDeepScanAt) >= CONFIG.deepScanIntervalMs;
    const countHintBeforePanel = getParticipantCountHint_();
    const forcePanelScan = countHintBeforePanel > names.size;
    const panelNames = extractParticipantsFromPeoplePanel_(shouldDeepScan || forcePanelScan);
    panelNames.forEach(function (name) { names.add(name); });

    if (!state.meta.capture) {
      state.meta.capture = {
        domCount: 0,
        panelCount: 0,
        mergedCount: 0,
        lastDeepScanAt: '',
      };
    }
    state.meta.capture.domCount = domNames.size;
    state.meta.capture.panelCount = panelNames.size;
    state.meta.capture.mergedCount = names.size;
    if (shouldDeepScan) {
      state.meta.capture.lastDeepScanAt = new Date().toISOString();
    }

    updateParticipantHintOnly_(names);

    return names;
  }

  function updateParticipantHintOnly_(names) {
    const hint = getParticipantCountHint_();
    if (!state.meta.capture) state.meta.capture = {};
    state.meta.capture.participantCountHint = hint;
    state.meta.capture.afterFallbackCount = names ? names.size : 0;
  }

  function getParticipantCountHint_() {
    let best = 0;
    const nodes = document.querySelectorAll('button[aria-label], div[role="button"][aria-label]');
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const label = String(node.getAttribute('aria-label') || '');
      const lower = label.toLowerCase();
      if (
        lower.indexOf('participant') === -1 &&
        lower.indexOf('everyone') === -1 &&
        lower.indexOf('show everyone') === -1 &&
        lower.indexOf('people') === -1
      ) {
        continue;
      }

      const fromLabel = label.match(/(\d+)\s*participants?/i);
      if (fromLabel) {
        best = Math.max(best, Number(fromLabel[1] || 0));
      }

      const txt = normalizeSpacing_(node.textContent || '');
      if (/^\d{1,3}$/.test(txt)) {
        best = Math.max(best, Number(txt));
      } else {
        const fromText = txt.match(/(\d+)\s*participants?/i);
        if (fromText) {
          best = Math.max(best, Number(fromText[1] || 0));
        }
      }
    }

    // Fallback: some Meet UI variants show a plain numeric badge near top-right
    // without useful aria-label text (e.g., small "2" participant chip).
    if (best <= 0) {
      const numeric = document.querySelectorAll('span,div');
      for (let i = 0; i < numeric.length; i++) {
        const el = numeric[i];
        if (!el) continue;
        const txt = normalizeSpacing_(el.textContent || '');
        if (!/^\d{1,3}$/.test(txt)) continue;
        const n = Number(txt || 0);
        if (!n || n > 250) continue;
        const rect = el.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) continue;
        if (rect.top < 0 || rect.top > 220) continue;
        if (rect.left < (window.innerWidth * 0.72)) continue;
        best = Math.max(best, n);
      }
    }
    return best;
  }

  function extractParticipantsFromDom_() {
    const names = new Set();
    const selectors = [
      '[data-participant-id] [dir="auto"]',
      'div[aria-label*="(You)"]',
      '[aria-label*="more actions for"]',
      '[aria-label*="More actions for"]',
      '[aria-label*="more options for"]',
      '[aria-label*="More options for"]',
    ];

    for (let i = 0; i < selectors.length; i++) {
      const nodes = document.querySelectorAll(selectors[i]);
      for (let j = 0; j < nodes.length; j++) {
        const text = extractNameFromNode_(nodes[j]);
        if (isLikelyParticipantName_(text)) {
          names.add(normalizeSpacing_(text));
        }
      }
    }

    const ariaNodes = document.querySelectorAll('[aria-label]');
    for (let i = 0; i < ariaNodes.length; i++) {
      const label = String(ariaNodes[i].getAttribute('aria-label') || '').trim();
      const fromMoreActions = label.match(/more (?:actions|options) for (.+)$/i);
      if (fromMoreActions && fromMoreActions[1] && isLikelyParticipantName_(fromMoreActions[1])) {
        names.add(normalizeSpacing_(fromMoreActions[1]));
      }
    }

    return names;
  }

  function extractParticipantsFromPeoplePanel_(allowDeepScan) {
    const names = new Set();
    if (!ensurePeoplePanelOpen_()) return names;

    const panelRoot = findPeoplePanelRoot_();
    if (!panelRoot) return names;

    collectParticipantNamesFromRoot_(panelRoot, names);
    if (!allowDeepScan) return names;

    const scroller = findScrollableContainer_(panelRoot);
    if (!scroller) return names;

    const originalTop = Number(scroller.scrollTop || 0);
    const maxTop = Math.max(0, Number(scroller.scrollHeight || 0) - Number(scroller.clientHeight || 0));
    const passes = Math.max(1, Number(CONFIG.panelScrollPasses || 1));
    const step = maxTop > 0 ? Math.max(1, Math.floor(maxTop / passes)) : 0;

    for (let pos = 0; pos <= maxTop; pos += step || maxTop || 1) {
      scroller.scrollTop = pos;
      collectParticipantNamesFromRoot_(panelRoot, names);
      if (maxTop === 0) break;
    }
    scroller.scrollTop = maxTop;
    collectParticipantNamesFromRoot_(panelRoot, names);
    scroller.scrollTop = originalTop;
    lastDeepScanAt = Date.now();
    return names;
  }

  function ensurePeoplePanelOpen_() {
    if (findPeoplePanelRoot_()) return true;
    if (!CONFIG.autoOpenPeoplePanel) return false;

    const now = Date.now();
    if (now - lastPanelOpenAttemptAt < Number(CONFIG.panelOpenAttemptCooldownMs || 60000)) {
      return false;
    }

    const btn = findPeoplePanelToggleButton_();
    if (!btn) return false;
    try {
      lastPanelOpenAttemptAt = now;
      btn.click();
      switchToPeopleTabIfNeeded_();
    } catch (error) {
      return false;
    }
    return !!findPeoplePanelRoot_();
  }

  function findPeoplePanelToggleButton_() {
    const direct = document.querySelectorAll(
      '[aria-label*="Show everyone"], [aria-label*="Everyone"], [aria-label*="People"], [aria-label*="show everyone"], [aria-label*="people"]'
    );
    for (let i = 0; i < direct.length; i++) {
      const n = direct[i];
      if (!n) continue;
      const clickable = n.closest('button,[role="button"],div[role="button"]') || n;
      if (clickable) return clickable;
    }

    const buttons = document.querySelectorAll('button[aria-label], div[role="button"][aria-label], span[aria-label]');
    for (let i = 0; i < buttons.length; i++) {
      const node = buttons[i];
      const label = String(node.getAttribute('aria-label') || '').toLowerCase();
      if (!label) continue;
      if (label.indexOf('add people') !== -1 || label.indexOf('invite people') !== -1) continue;
      if (label.indexOf('chat') !== -1 || label.indexOf('message') !== -1 || label.indexOf('activity') !== -1) {
        continue;
      }
      if (
        label.indexOf('show everyone') !== -1 ||
        label.indexOf('everyone') !== -1 ||
        label.indexOf('open people') !== -1 ||
        label === 'people'
      ) {
        return node.closest('button,[role="button"],div[role="button"]') || node;
      }
    }
    return null;
  }

  function switchToPeopleTabIfNeeded_() {
    const tabs = document.querySelectorAll('button, div[role="tab"], [role="button"]');
    for (let i = 0; i < tabs.length; i++) {
      const node = tabs[i];
      if (!node) continue;
      const txt = normalizeSpacing_(node.textContent || '').toLowerCase();
      const aria = String(node.getAttribute('aria-label') || '').toLowerCase();
      const label = txt || aria;
      if (!label) continue;
      if (label === 'people' || label.indexOf('show everyone') !== -1 || label.indexOf('everyone') !== -1) {
        try { node.click(); } catch (error) {}
      }
    }
  }

  function findPeoplePanelRoot_() {
    const selectors = [
      '[aria-label*="Everyone"][role="complementary"]',
      '[aria-label*="People"][role="complementary"]',
      '[role="complementary"] [data-participant-id]',
      'aside [data-participant-id]',
      '[role="dialog"] [data-participant-id]',
      '[role="complementary"] [aria-label*="Mute"][aria-label*="microphone"]',
      '[role="complementary"] [aria-label*="mute"][aria-label*="microphone"]',
      '[role="complementary"] [aria-label*="In the meeting"]',
      '[role="complementary"] [aria-label*="Contributors"]',
    ];
    for (let i = 0; i < selectors.length; i++) {
      const node = document.querySelector(selectors[i]);
      if (node) return node;
    }
    return null;
  }

  function findScrollableContainer_(root) {
    if (!root) return null;
    const candidates = root.querySelectorAll('div, section');
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (c.scrollHeight > c.clientHeight + 10) return c;
    }
    return root.scrollHeight > root.clientHeight + 10 ? root : null;
  }

  function collectParticipantNamesFromRoot_(root, outputSet) {
    if (!root || !outputSet) return;
    const selectors = [
      '[data-participant-id] [dir="auto"]',
      '[data-participant-id] span[dir="auto"]',
      '[role="listitem"] [dir="auto"]',
      '[role="listitem"] span',
      '[aria-label*="more actions for"]',
      '[aria-label*="More actions for"]',
      '[aria-label*="more options for"]',
      '[aria-label*="More options for"]',
      '[aria-label*="Mute"][aria-label*="microphone"]',
      '[aria-label*="mute"][aria-label*="microphone"]',
    ];
    for (let i = 0; i < selectors.length; i++) {
      const nodes = root.querySelectorAll(selectors[i]);
      for (let j = 0; j < nodes.length; j++) {
        const text = extractNameFromNode_(nodes[j]) || extractNameFromMuteLabel_(nodes[j]);
        if (isLikelyParticipantName_(text)) {
          outputSet.add(normalizeSpacing_(text));
        }
      }
    }
  }

  function extractNameFromNode_(node) {
    const txt = (node && (node.textContent || node.innerText)) ? String(node.textContent || node.innerText) : '';
    const trimmed = normalizeSpacing_(txt);
    if (!trimmed) return '';
    if (/more (actions|options) for /i.test(trimmed)) {
      return trimmed.replace(/more (actions|options) for /i, '').trim();
    }
    return trimmed;
  }

  function extractNameFromMuteLabel_(node) {
    if (!node || !node.getAttribute) return '';
    const label = String(node.getAttribute('aria-label') || '').trim();
    if (!label) return '';
    const m = label.match(/mute\s+(.+?)(?:'s)?\s+microphone/i);
    return m && m[1] ? normalizeSpacing_(m[1]) : '';
  }

  function isLikelyParticipantName_(value) {
    if (!value) return false;
    const cleaned = normalizeSpacing_(value);
    if (!cleaned) return false;
    if (cleaned.length < 2 || cleaned.length > 80) return false;
    if (/[@#<>|{}\[\]]/.test(cleaned)) return false;
    if (!/[a-z0-9]/i.test(cleaned)) return false;
    if (looksLikeRepeatedPhrase_(cleaned)) return false;
    for (let i = 0; i < NOISE_PATTERNS.length; i++) {
      if (NOISE_PATTERNS[i].test(cleaned)) return false;
    }
    const lowered = cleaned.toLowerCase();
    if (STOPWORDS.has(lowered)) return false;
    if (/^\d+$/.test(lowered)) return false;
    return true;
  }

  function looksLikeRepeatedPhrase_(value) {
    const t = normalizeSpacing_(value);
    if (t.length < 8 || t.length % 2 !== 0) return false;
    const half = t.length / 2;
    return t.slice(0, half) === t.slice(half);
  }

  function updateTrackingState_(currentNamesSet, nowIso) {
    const nowMs = Date.parse(nowIso) || Date.now();
    const activeKeys = new Set();
    const underCapturedNow = isUndercapturedByHint_(currentNamesSet);

    currentNamesSet.forEach(function (displayName) {
      const normalizedName = normalizeName_(displayName);
      if (!normalizedName) return;
      const key = normalizedName;
      activeKeys.add(key);

      if (!state.attendees[key]) {
        state.attendees[key] = {
          participantKey: key,
          name: displayName,
          normalizedName: normalizedName,
          firstJoinTime: nowIso,
          lastSeenTime: nowIso,
          lastLeaveTime: '',
          totalDurationSeconds: 0,
          joinCount: 1,
          exitCount: 0,
          isPresent: true,
          sessions: [
            {
              joinTime: nowIso,
              leaveTime: '',
              durationSeconds: 0,
            },
          ],
        };
        return;
      }

      const attendee = state.attendees[key];
      attendee.name = displayName;
      attendee.lastSeenTime = nowIso;

      if (!attendee.isPresent) {
        attendee.isPresent = true;
        attendee.joinCount = Number(attendee.joinCount || 0) + 1;
        attendee.sessions = Array.isArray(attendee.sessions) ? attendee.sessions : [];
        attendee.sessions.push({
          joinTime: nowIso,
          leaveTime: '',
          durationSeconds: 0,
        });
      }
    });

    const attendeeKeys = Object.keys(state.attendees);
    for (let i = 0; i < attendeeKeys.length; i++) {
      const key = attendeeKeys[i];
      const attendee = state.attendees[key];
      if (!attendee) continue;
      if (activeKeys.has(key)) continue;

      // Recover from recent false "left" states while capture is incomplete.
      if (underCapturedNow && !attendee.isPresent) {
        const lastLeaveMs = Date.parse(String(attendee.lastLeaveTime || ''));
        const recoverWindowMs = Number(CONFIG.leaveGraceMs || 0) * 2;
        if (isFinite(lastLeaveMs) && recoverWindowMs > 0 && (nowMs - lastLeaveMs) <= recoverWindowMs) {
          attendee.isPresent = true;
          attendee.lastSeenTime = nowIso;
          attendee.lastLeaveTime = '';
          attendee.joinCount = Number(attendee.joinCount || 0) + 1;
          attendee.sessions = Array.isArray(attendee.sessions) ? attendee.sessions : [];
          attendee.sessions.push({
            joinTime: nowIso,
            leaveTime: '',
            durationSeconds: 0,
          });
        }
      }

      if (!attendee.isPresent) continue;
      // Do not mark people as left while we know capture is incomplete.
      if (underCapturedNow) continue;
      const lastSeenMs = Date.parse(String(attendee.lastSeenTime || ''));
      if (isFinite(lastSeenMs) && (nowMs - lastSeenMs) < Number(CONFIG.leaveGraceMs || 0)) continue;

      attendee.isPresent = false;
      attendee.lastLeaveTime = nowIso;
      attendee.exitCount = Number(attendee.exitCount || 0) + 1;

      const sessions = Array.isArray(attendee.sessions) ? attendee.sessions : [];
      if (sessions.length > 0) {
        const lastSession = sessions[sessions.length - 1];
        if (lastSession && !lastSession.leaveTime) {
          lastSession.leaveTime = nowIso;
          lastSession.durationSeconds = calcDurationSeconds_(lastSession.joinTime, lastSession.leaveTime);
        }
      }
    }

    recomputeAllDurations_(nowIso);
  }

  function isUndercapturedByHint_(currentNamesSet) {
    const captured = currentNamesSet && typeof currentNamesSet.size === 'number' ? currentNamesSet.size : 0;
    const hint = Number(state && state.meta && state.meta.capture && state.meta.capture.participantCountHint || 0);
    return hint > 0 && hint > captured;
  }

  function purgeSyntheticAttendees_() {
    const attendees = state && state.attendees ? state.attendees : {};
    const keys = Object.keys(attendees);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const attendee = attendees[key];
      if (!attendee) continue;
      if (isSyntheticParticipant_(attendee, key)) {
        delete attendees[key];
      }
    }
  }

  function isSyntheticParticipant_(attendee, key) {
    const rawKey = normalizeSpacing_(String(key || '')).toLowerCase();
    const name = normalizeSpacing_(String(attendee && attendee.name || '')).toLowerCase();
    const normalizedName = normalizeSpacing_(String(attendee && attendee.normalizedName || '')).toLowerCase();
    const participantKey = normalizeSpacing_(String(attendee && attendee.participantKey || '')).toLowerCase();
    return (
      /^external participant #?\d+$/.test(name) ||
      /^external participant #?\d+$/.test(normalizedName) ||
      /^external participant #?\d+$/.test(participantKey) ||
      /^external participant #?\d+$/.test(rawKey)
    );
  }

  function recomputeAllDurations_(nowIso) {
    const keys = Object.keys(state.attendees);
    for (let i = 0; i < keys.length; i++) {
      const attendee = state.attendees[keys[i]];
      if (!attendee) continue;
      attendee.totalDurationSeconds = calculateTotalDuration_(attendee, nowIso);
    }
  }

  function calculateTotalDuration_(attendee, nowIso) {
    const sessions = Array.isArray(attendee.sessions) ? attendee.sessions : [];
    let total = 0;
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      if (!s || !s.joinTime) continue;
      const end = s.leaveTime || nowIso;
      total += calcDurationSeconds_(s.joinTime, end);
    }
    return Math.max(0, Math.floor(total));
  }

  function calcDurationSeconds_(startIso, endIso) {
    const a = Date.parse(startIso);
    const b = Date.parse(endIso);
    if (!isFinite(a) || !isFinite(b) || b < a) return 0;
    return Math.floor((b - a) / 1000);
  }

  function buildPayload_(isFinal, reason) {
    const nowIso = new Date().toISOString();
    if (isFinal) {
      closeOpenSessions_(nowIso);
      recomputeAllDurations_(nowIso);
      saveState_();
    }

    const attendees = [];
    const keys = Object.keys(state.attendees);
    for (let i = 0; i < keys.length; i++) {
      const attendee = state.attendees[keys[i]];
      if (!attendee) continue;
      attendees.push({
        participantKey: attendee.participantKey,
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

    return {
      action: 'syncMeetAttendance',
      extensionSecret: CONFIG.sharedSecret,
      source: CONFIG.source,
      payloadVersion: 1,
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
      },
    };
  }

  function closeOpenSessions_(nowIso) {
    const keys = Object.keys(state.attendees);
    for (let i = 0; i < keys.length; i++) {
      const attendee = state.attendees[keys[i]];
      if (!attendee || !attendee.isPresent) continue;

      attendee.isPresent = false;
      attendee.lastLeaveTime = nowIso;
      attendee.exitCount = Number(attendee.exitCount || 0) + 1;

      const sessions = Array.isArray(attendee.sessions) ? attendee.sessions : [];
      if (!sessions.length) continue;
      const last = sessions[sessions.length - 1];
      if (last && !last.leaveTime) {
        last.leaveTime = nowIso;
        last.durationSeconds = calcDurationSeconds_(last.joinTime, nowIso);
      }
    }
  }

  function shouldSync_(payload, force) {
    if (force) return true;
    const now = Date.now();
    if (now - lastSyncAt < CONFIG.minSyncGapMs) return false;
    const fp = JSON.stringify(
      (payload.attendees || []).map(function (a) {
        return [
          a.participantKey,
          a.isPresent ? 1 : 0,
          a.totalDurationSeconds,
          a.joinCount,
          a.exitCount,
        ];
      })
    );
    if (fp === lastFingerprint) return false;
    lastFingerprint = fp;
    return true;
  }

  function sync_(isFinal, reason) {
    if (disposed) return;
    if (!trackingEnabled && !isFinal) return;
    if (!CONFIG.backendUrl || !/^https:\/\/script\.google\.com\/macros\/s\//.test(CONFIG.backendUrl)) {
      return;
    }
    if (!CONFIG.sharedSecret) {
      return;
    }

    const payload = buildPayload_(!!isFinal, reason);
    if (!shouldSync_(payload, !!isFinal)) return;

    lastSyncAt = Date.now();
    state.meta.syncCount = Number(state.meta.syncCount || 0) + 1;
    saveState_();

    sendSyncToBackground_(payload, !!isFinal, reason || '');
  }

  function detectMeetingEnded_() {
    const leftText = document.body ? document.body.innerText : '';
    if (!leftText) return;
    if (/you left the meeting/i.test(leftText) || /rejoin/i.test(leftText)) {
      finalizeAndSync_('meeting_end_detected');
    }
  }

  function finalizeAndSync_(reason) {
    if (disposed) return;
    disposed = true;

    if (scanTimer) clearInterval(scanTimer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (mutationObserver) {
      try {
        mutationObserver.disconnect();
      } catch (error) {
        log_('Observer disconnect failed', error);
      }
    }

    sync_(true, reason || 'finalize');
    setTrackerStatus_({ active: false, meetingId: '' });
    updateTrackerBadge_('OFF');
    clearMeetingLocalState_();
  }

  function extractMeetingId_(url) {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
      return match ? match[1].toLowerCase() : '';
    } catch (error) {
      return '';
    }
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
    } catch (error) {
      // Ignore listener registration failures when extension context is reloading.
    }
  }

  function setTrackerStatus_(stateUpdate) {
    if (!isExtensionContextAlive_()) return;
    const payload = {};
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
    const patch = {};
    patch[STORAGE_KEYS.liveCount] = Number(metrics && metrics.liveCount || 0);
    patch[STORAGE_KEYS.seenCount] = Number(metrics && metrics.seenCount || 0);
    patch[STORAGE_KEYS.captureCount] = Number(metrics && metrics.captureCount || 0);
    safeChromeStorageSet_(patch);
  }

  function sendSyncToBackground_(payload, isFinal, reason) {
    if (!isExtensionContextAlive_()) {
      sendSyncDirect_(payload, isFinal, reason);
      return;
    }

    const outgoing = Object.assign({}, payload, { backendUrl: CONFIG.backendUrl });
    safeRuntimeSendMessage_({ type: 'YSP_MEET_SYNC', payload: outgoing }, function (resp, hasRuntimeError) {
      if (hasRuntimeError) {
        sendSyncDirect_(payload, isFinal, reason);
        return;
      }
      if (!resp || !resp.ok) {
        sendSyncDirect_(payload, isFinal, reason);
        return;
      }
      const data = resp.data || {};
      const origin = String(resp.meetingOrigin || data.meetingOrigin || '');
      state.meta.lastServerAckAt = new Date().toISOString();
      state.meta.lastServerMeetingOrigin = origin;
      saveState_();

      const storagePatch = {};
      storagePatch[STORAGE_KEYS.lastSyncAt] = state.meta.lastServerAckAt;
      storagePatch[STORAGE_KEYS.lastSyncOk] = true;
      storagePatch[STORAGE_KEYS.lastSyncError] = '';
      if (origin) storagePatch[STORAGE_KEYS.lastMeetingOrigin] = origin;
      safeChromeStorageSet_(storagePatch);

      log_('Meet attendance synced', {
        final: !!isFinal,
        reason: reason || '',
        meetingOrigin: state.meta.lastServerMeetingOrigin || '',
      });
    });
  }

  function sendSyncDirect_(payload, isFinal, reason) {
    fetch(CONFIG.backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: 'omit',
      mode: 'cors',
    })
      .then(function (res) {
        return res.text();
      })
      .then(function (text) {
        let parsed = null;
        try {
          parsed = JSON.parse(String(text || '{}'));
        } catch (error) {
          parsed = null;
        }

        if (parsed && parsed.success) {
          const origin =
            parsed.meetingOrigin ||
            (parsed.data && parsed.data.meetingOrigin) ||
            '';
          state.meta.lastServerAckAt = new Date().toISOString();
          state.meta.lastServerMeetingOrigin = String(origin || '');
          saveState_();
        }

        if (isExtensionContextAlive_()) {
          const ok = !!(parsed && parsed.success);
          const patch = {};
          patch[STORAGE_KEYS.lastSyncAt] = new Date().toISOString();
          patch[STORAGE_KEYS.lastSyncOk] = ok;
          patch[STORAGE_KEYS.lastSyncError] = ok ? '' : 'Direct sync response not OK';
          if (state.meta.lastServerMeetingOrigin) {
            patch[STORAGE_KEYS.lastMeetingOrigin] = state.meta.lastServerMeetingOrigin;
          }
          safeChromeStorageSet_(patch);
        }

        log_('Meet attendance synced (direct)', {
          final: !!isFinal,
          reason: reason || '',
          meetingOrigin: state.meta.lastServerMeetingOrigin || '',
        });
      })
      .catch(function (error) {
        if (isExtensionContextAlive_()) {
          const patch = {};
          patch[STORAGE_KEYS.lastSyncAt] = new Date().toISOString();
          patch[STORAGE_KEYS.lastSyncOk] = false;
          patch[STORAGE_KEYS.lastSyncError] = String(error && (error.message || error.toString()) || error);
          safeChromeStorageSet_(patch);
        }
        log_('Sync failed', error);
      });
  }

  function isExtensionContextAlive_() {
    if (!CHROME_OK) return false;
    try {
      return !!(chrome.runtime && chrome.runtime.id);
    } catch (error) {
      return false;
    }
  }

  function safeChromeStorageSet_(payload) {
    if (!isExtensionContextAlive_()) return;
    try {
      chrome.storage.local.set(payload, function () {
        try {
          // Access to swallow runtime invalidated errors.
          void chrome.runtime.lastError;
        } catch (error) {
          // Ignore.
        }
      });
    } catch (error) {
      // Ignore context invalidation during extension reload.
    }
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
        } catch (error) {
          if (typeof callback === 'function') callback(defaults || {});
          return;
        }
        if (typeof callback === 'function') callback(items || defaults || {});
      });
    } catch (error) {
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
        let hasRuntimeError = false;
        try {
          hasRuntimeError = !!chrome.runtime.lastError;
        } catch (error) {
          hasRuntimeError = true;
        }
        if (typeof callback === 'function') callback(resp || null, hasRuntimeError);
      });
    } catch (error) {
      if (typeof callback === 'function') callback(null, true);
    }
  }

  function computeTrackerMetrics_() {
    const keys = Object.keys(state.attendees || {});
    let liveCount = 0;
    for (let i = 0; i < keys.length; i++) {
      const attendee = state.attendees[keys[i]];
      if (attendee && attendee.isPresent) liveCount++;
    }
    const captureCount = Number(state && state.meta && state.meta.capture && state.meta.capture.mergedCount || 0);
    return {
      liveCount: liveCount,
      seenCount: captureCount,
      captureCount: captureCount,
    };
  }

  function updateTrackerBadge_(label, metrics) {
    const details = metrics
      ? (' | Live ' + Number(metrics.liveCount || 0) + ' | Seen ' + Number(metrics.seenCount || 0))
      : '';
    const text = 'YSP Tracker: ' + label + details;
    if (trackerBadgeEl || !document.body) {
      if (trackerBadgeEl) {
        trackerBadgeEl.textContent = text;
        trackerBadgeEl.style.background = label === 'ON' ? '#16a34a' : '#b91c1c';
      }
      return;
    }

    trackerBadgeEl = document.createElement('div');
    trackerBadgeEl.textContent = text;
    trackerBadgeEl.style.position = 'fixed';
    trackerBadgeEl.style.bottom = '14px';
    trackerBadgeEl.style.right = '14px';
    trackerBadgeEl.style.zIndex = '2147483647';
    trackerBadgeEl.style.padding = '6px 10px';
    trackerBadgeEl.style.borderRadius = '999px';
    trackerBadgeEl.style.fontSize = '12px';
    trackerBadgeEl.style.fontWeight = '700';
    trackerBadgeEl.style.color = '#ffffff';
    trackerBadgeEl.style.background = label === 'ON' ? '#16a34a' : '#b91c1c';
    trackerBadgeEl.style.boxShadow = '0 8px 20px rgba(0,0,0,0.25)';
    document.body.appendChild(trackerBadgeEl);
  }

  function log_() {
    if (!CONFIG.debug) return;
    const args = Array.prototype.slice.call(arguments);
    args.unshift('[YSP Meet Tracker]');
    console.log.apply(console, args);
  }
})();
