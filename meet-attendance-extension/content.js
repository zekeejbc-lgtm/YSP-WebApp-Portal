(function () {
  'use strict';

  const CONFIG = {
    backendUrl: 'https://script.google.com/macros/s/AKfycbyTYEMa5apc6ZSCVce1qowpbcooRB88OjtW-nSvsb4ZK-W8N9XcQp2dbigoaPTg316J/exec',
    sharedSecret: 'P37-5mgdNfjRd9KcSt4gw5SYVfzO5EHFyq4XYHKVe7PpL7FRbwab_czEa3ez4YsN',
    source: 'ysp-meet-extension-v1',
    scanIntervalMs: 2500,
    heartbeatIntervalMs: 30000,
    minSyncGapMs: 7000,
    debug: false,
  };

  const TRACKER_PREFIX = 'ysp_meet_tracker_state_';
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

  if (!/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i.test(location.href)) {
    return;
  }

  const meetingId = extractMeetingId_(location.href);
  if (!meetingId) return;

  const stateKey = TRACKER_PREFIX + meetingId;
  let state = loadState_() || createInitialState_();
  let disposed = false;
  let scanTimer = null;
  let heartbeatTimer = null;
  let mutationObserver = null;
  let scanQueued = false;
  let lastFingerprint = '';
  let lastSyncAt = 0;

  log_('Tracker started for meeting', meetingId);
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
    const nowIso = new Date().toISOString();
    state.lastScanAt = nowIso;

    const currentNames = extractParticipants_();
    updateTrackingState_(currentNames, nowIso);
    saveState_();
    sync_(false, 'participant_scan');
  }

  function extractParticipants_() {
    const names = new Set();
    const selectors = [
      '[data-participant-id] [dir="auto"]',
      '[data-participant-id] span',
      '[role="listitem"] [dir="auto"]',
      '[role="listitem"] span',
      'div[aria-label*="(You)"]',
      '[aria-label*="more actions for"]',
      '[aria-label*="More actions for"]',
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
      const fromMoreActions = label.match(/more actions for (.+)$/i);
      if (fromMoreActions && fromMoreActions[1] && isLikelyParticipantName_(fromMoreActions[1])) {
        names.add(normalizeSpacing_(fromMoreActions[1]));
      }
    }

    return names;
  }

  function extractNameFromNode_(node) {
    const txt = (node && (node.textContent || node.innerText)) ? String(node.textContent || node.innerText) : '';
    const trimmed = normalizeSpacing_(txt);
    if (!trimmed) return '';
    if (/more actions for /i.test(trimmed)) {
      return trimmed.replace(/more actions for /i, '').trim();
    }
    return trimmed;
  }

  function isLikelyParticipantName_(value) {
    if (!value) return false;
    const cleaned = normalizeSpacing_(value);
    if (!cleaned) return false;
    if (cleaned.length < 2 || cleaned.length > 80) return false;
    if (/[@#<>|{}\[\]]/.test(cleaned)) return false;
    const lowered = cleaned.toLowerCase();
    if (STOPWORDS.has(lowered)) return false;
    if (/^\d+$/.test(lowered)) return false;
    return true;
  }

  function updateTrackingState_(currentNamesSet, nowIso) {
    const activeKeys = new Set();

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
      if (!attendee.isPresent) continue;

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
        url: state.meetingUrl || location.href,
        date: state.meetingDate,
        startedAt: state.startedAt,
        lastTrackedAt: nowIso,
      },
      attendees: attendees,
      client: {
        isFinal: !!isFinal,
        reason: reason || '',
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
      .then(function () {
        log_('Meet attendance synced', { final: !!isFinal, reason: reason || '' });
      })
      .catch(function (error) {
        log_('Sync failed', error);
      });
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

  function log_() {
    if (!CONFIG.debug) return;
    const args = Array.prototype.slice.call(arguments);
    args.unshift('[YSP Meet Tracker]');
    console.log.apply(console, args);
  }
})();
