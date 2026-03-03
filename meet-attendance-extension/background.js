'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
 *  YSP Meet Attendance Tracker — Background Service Worker v2.0
 *  ─────────────────────────────────────────────────────────────────────────
 *  • text/plain Content-Type (avoids CORS preflight on GAS)
 *  • 3 retries with exponential back-off
 *  • Persistent sync retry queue via chrome.storage.local + chrome.alarms
 *  • Offline detection (navigator.onLine)
 *  • Sync event log (last 30 events surfaced in popup diagnostics)
 * ═══════════════════════════════════════════════════════════════════════════ */

const STORAGE_KEYS = {
  enabled: 'ysp_tracker_enabled',
  active: 'ysp_tracker_active',
  currentMeetingId: 'ysp_tracker_current_meeting_id',
  lastSyncAt: 'ysp_tracker_last_sync_at',
  lastSyncOk: 'ysp_tracker_last_sync_ok',
  lastSyncError: 'ysp_tracker_last_sync_error',
  lastMeetingOrigin: 'ysp_tracker_last_meeting_origin',
  pendingSyncs: 'ysp_tracker_pending_syncs',
  syncLog: 'ysp_tracker_sync_log',
};

const RETRY_ALARM_NAME = 'ysp-sync-retry';
const RETRY_ALARM_PERIOD_MINUTES = 1;
const MAX_PENDING_QUEUE = 50;
const MAX_SYNC_LOG = 30;

/* ─── Install / Startup ─────────────────────────────────────────────────── */

chrome.runtime.onInstalled.addListener(function () {
  chrome.storage.local.get({ ysp_tracker_enabled: true }, function (items) {
    if (typeof items.ysp_tracker_enabled !== 'boolean') {
      chrome.storage.local.set({ ysp_tracker_enabled: true });
    }
  });
  ensureRetryAlarm_();
});

chrome.runtime.onStartup.addListener(function () {
  ensureRetryAlarm_();
});

function ensureRetryAlarm_() {
  chrome.alarms.get(RETRY_ALARM_NAME, function (alarm) {
    if (!alarm) {
      chrome.alarms.create(RETRY_ALARM_NAME, { periodInMinutes: RETRY_ALARM_PERIOD_MINUTES });
    }
  });
}

/* ─── Alarm Handler — drain pending queue ────────────────────────────── */

chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name === RETRY_ALARM_NAME) {
    drainPendingQueue_();
  }
});

async function drainPendingQueue_() {
  if (!navigator.onLine) return;

  const items = await chromeStorageGet_({ [STORAGE_KEYS.pendingSyncs]: [] });
  const queue = Array.isArray(items[STORAGE_KEYS.pendingSyncs])
    ? items[STORAGE_KEYS.pendingSyncs]
    : [];

  if (queue.length === 0) return;

  const remaining = [];
  for (let i = 0; i < queue.length; i++) {
    const entry = queue[i];
    if (!entry || !entry.payload || !entry.url) continue;

    const result = await postWithRetry_(entry.url, entry.payload, 2);
    if (result.ok) {
      appendSyncLog_({
        time: new Date().toISOString(),
        payloadId: entry.payload.payloadId || '?',
        result: 'ok (queued retry)',
        latencyMs: 0,
      });
    } else {
      entry.attempts = (entry.attempts || 0) + 1;
      if (entry.attempts < 5) {
        remaining.push(entry);
      } else {
        appendSyncLog_({
          time: new Date().toISOString(),
          payloadId: entry.payload.payloadId || '?',
          result: 'failed (dropped after 5 attempts): ' + (result.error || ''),
          latencyMs: 0,
        });
      }
    }
  }

  chrome.storage.local.set({ [STORAGE_KEYS.pendingSyncs]: remaining });
}

/* ─── Message Handlers ───────────────────────────────────────────────── */

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message || typeof message !== 'object') return;

  if (message.type === 'YSP_MEET_SYNC') {
    handleSyncRequest_(message.payload)
      .then(function (result) {
        sendResponse(result);
      })
      .catch(function (error) {
        sendResponse({
          ok: false,
          error: String(error && (error.message || error.toString()) || error),
        });
      });
    return true;
  }

  if (message.type === 'YSP_FORCE_SYNC') {
    // Forward to content script via active Meet tab
    chrome.tabs.query({ url: 'https://meet.google.com/*' }, function (tabs) {
      if (tabs && tabs.length > 0) {
        for (let i = 0; i < tabs.length; i++) {
          chrome.tabs.sendMessage(tabs[i].id, { type: 'YSP_FORCE_SYNC' });
        }
      }
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'YSP_GET_TRACKER_STATUS') {
    chrome.storage.local.get({
      ysp_tracker_enabled: true,
      ysp_tracker_active: false,
      ysp_tracker_current_meeting_id: '',
      ysp_tracker_live_count: 0,
      ysp_tracker_seen_count: 0,
      ysp_tracker_capture_count: 0,
      ysp_tracker_last_sync_at: '',
      ysp_tracker_last_sync_ok: false,
      ysp_tracker_last_sync_error: '',
      ysp_tracker_last_meeting_origin: '',
      ysp_tracker_pending_syncs: [],
      ysp_tracker_sync_log: [],
    }, function (items) {
      sendResponse({ ok: true, status: items });
    });
    return true;
  }

  if (message.type === 'YSP_REGISTER_ADHOC_MEETING') {
    handleRegisterAdHocMeeting_(message)
      .then(function (result) {
        sendResponse(result);
      })
      .catch(function (error) {
        sendResponse({
          ok: false,
          error: String(error && (error.message || error.toString()) || error),
        });
      });
    return true;
  }
});

/* ─── Sync Request Handler ───────────────────────────────────────────── */

async function handleSyncRequest_(payload) {
  if (!payload || !payload.extensionSecret || !payload.action) {
    return { ok: false, error: 'Invalid sync payload' };
  }

  const backendUrl = String(payload.backendUrl || '').trim();
  if (!backendUrl) {
    return { ok: false, error: 'Missing backend URL in sync payload' };
  }

  // Offline → queue immediately
  if (!navigator.onLine) {
    await enqueueSync_(backendUrl, payload);
    return { ok: false, error: 'Offline — queued for retry', queued: true };
  }

  const startMs = Date.now();
  const result = await postWithRetry_(backendUrl, payload, 2); // 3 total attempts
  const latencyMs = Date.now() - startMs;
  const nowIso = new Date().toISOString();
  const data = result && result.data ? result.data : {};
  const meetingOrigin = String(data.meetingOrigin || result.meetingOrigin || '');

  const store = {};
  store[STORAGE_KEYS.lastSyncAt] = nowIso;
  store[STORAGE_KEYS.lastSyncOk] = !!result.ok;
  store[STORAGE_KEYS.lastSyncError] = result.ok ? '' : String(result.error || 'Sync failed');
  if (meetingOrigin) {
    store[STORAGE_KEYS.lastMeetingOrigin] = meetingOrigin;
  }
  chrome.storage.local.set(store);

  // Log
  appendSyncLog_({
    time: nowIso,
    payloadId: payload.payloadId || '?',
    result: result.ok ? 'ok' : 'failed: ' + (result.error || ''),
    latencyMs: latencyMs,
  });

  // If failed, queue for retry
  if (!result.ok) {
    await enqueueSync_(backendUrl, payload);
  }

  return result;
}

/* ─── Register Ad-hoc Meeting Handler ────────────────────────────────── */

const ADHOC_CONFIG = {
  backendUrl: 'https://script.google.com/macros/s/AKfycbyTYEMa5apc6ZSCVce1qowpbcooRB88OjtW-nSvsb4ZK-W8N9XcQp2dbigoaPTg316J/exec',
  sharedSecret: 'P37-5mgdNfjRd9KcSt4gw5SYVfzO5EHFyq4XYHKVe7PpL7FRbwab_czEa3ez4YsN',
};

async function handleRegisterAdHocMeeting_(message) {
  const meetCode = String(message.meetCode || '').trim().toLowerCase();
  const meetUrl = String(message.meetUrl || '').trim();
  const title = String(message.title || 'Ad-hoc Meeting').trim();

  if (!meetCode || !/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(meetCode)) {
    return { ok: false, error: 'Invalid meeting code format' };
  }

  if (!navigator.onLine) {
    return { ok: false, error: 'You are offline. Please try again when connected.' };
  }

  const payload = {
    action: 'registerAdHocMeeting',
    extensionSecret: ADHOC_CONFIG.sharedSecret,
    meetCode: meetCode,
    meetUrl: meetUrl || ('https://meet.google.com/' + meetCode),
    title: title,
    registeredBy: 'extension',
  };

  try {
    const res = await fetch(ADHOC_CONFIG.backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      credentials: 'omit',
      mode: 'cors',
    });

    const text = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return { ok: false, error: 'Invalid response from server' };
    }

    if (!parsed.success) {
      return { ok: false, error: parsed.error || 'Registration failed' };
    }

    // Update storage with new origin
    chrome.storage.local.set({
      [STORAGE_KEYS.lastMeetingOrigin]: 'frontend',
    });

    // Trigger a force sync to the content script to pick up the new meeting ID
    chrome.tabs.query({ url: 'https://meet.google.com/*' }, function (tabs) {
      if (tabs && tabs.length > 0) {
        for (let i = 0; i < tabs.length; i++) {
          chrome.tabs.sendMessage(tabs[i].id, { type: 'YSP_FORCE_SYNC' });
        }
      }
    });

    return {
      ok: true,
      alreadyRegistered: !!parsed.alreadyRegistered,
      meeting: parsed.meeting || {},
      message: parsed.message || 'Meeting registered',
    };
  } catch (error) {
    return { ok: false, error: 'Network error: ' + (error.message || error) };
  }
}

/* ─── POST with Retry + Exponential Backoff ──────────────────────────── */

async function postWithRetry_(url, payload, retries) {
  let lastError = '';
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 1.5s, 3s, 6s …
      await delay_(1500 * Math.pow(2, attempt - 1));
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },  // Avoids CORS preflight on GAS
        body: JSON.stringify(payload),
        credentials: 'omit',
      });
      const text = await res.text();
      let parsed = null;
      try {
        parsed = JSON.parse(String(text || '{}'));
      } catch (parseErr) {
        parsed = null;
      }

      if (!res.ok) {
        lastError = 'HTTP ' + res.status + ': ' + (text || '').slice(0, 200);
        continue;  // Retry on HTTP errors
      } else {
        const appOk = !!(parsed && parsed.success === true);
        if (!appOk) {
          const appErr = parsed && parsed.error ? String(parsed.error) : 'Backend returned success=false';
          lastError = appErr;
          continue;
        }
        return {
          ok: true,
          data: parsed || {},
          meetingOrigin: parsed && parsed.meetingOrigin ? parsed.meetingOrigin : '',
        };
      }
    } catch (error) {
      lastError = String(error && (error.message || error.toString()) || error);
    }
  }

  return { ok: false, error: lastError || 'Sync failed after retries' };
}

/* ─── Sync Queue Helpers ─────────────────────────────────────────────── */

async function enqueueSync_(url, payload) {
  const items = await chromeStorageGet_({ [STORAGE_KEYS.pendingSyncs]: [] });
  const queue = Array.isArray(items[STORAGE_KEYS.pendingSyncs])
    ? items[STORAGE_KEYS.pendingSyncs]
    : [];

  // Deduplicate by payloadId
  const payloadId = payload.payloadId || '';
  if (payloadId) {
    for (let i = 0; i < queue.length; i++) {
      if (queue[i] && queue[i].payload && queue[i].payload.payloadId === payloadId) {
        queue[i] = { url: url, payload: payload, attempts: queue[i].attempts || 0, queuedAt: new Date().toISOString() };
        chrome.storage.local.set({ [STORAGE_KEYS.pendingSyncs]: queue });
        return;
      }
    }
  }

  queue.push({ url: url, payload: payload, attempts: 0, queuedAt: new Date().toISOString() });
  // Cap queue size
  while (queue.length > MAX_PENDING_QUEUE) queue.shift();
  chrome.storage.local.set({ [STORAGE_KEYS.pendingSyncs]: queue });
  ensureRetryAlarm_();
}

async function appendSyncLog_(entry) {
  const items = await chromeStorageGet_({ [STORAGE_KEYS.syncLog]: [] });
  const log = Array.isArray(items[STORAGE_KEYS.syncLog])
    ? items[STORAGE_KEYS.syncLog]
    : [];
  log.push(entry);
  while (log.length > MAX_SYNC_LOG) log.shift();
  chrome.storage.local.set({ [STORAGE_KEYS.syncLog]: log });
}

/* ─── Utility ────────────────────────────────────────────────────────── */

function delay_(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function chromeStorageGet_(defaults) {
  return new Promise(function (resolve) {
    chrome.storage.local.get(defaults, function (items) {
      resolve(items || defaults);
    });
  });
}
