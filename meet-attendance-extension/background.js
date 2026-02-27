'use strict';

const STORAGE_KEYS = {
  enabled: 'ysp_tracker_enabled',
  active: 'ysp_tracker_active',
  currentMeetingId: 'ysp_tracker_current_meeting_id',
  lastSyncAt: 'ysp_tracker_last_sync_at',
  lastSyncOk: 'ysp_tracker_last_sync_ok',
  lastSyncError: 'ysp_tracker_last_sync_error',
  lastMeetingOrigin: 'ysp_tracker_last_meeting_origin',
};

chrome.runtime.onInstalled.addListener(function () {
  chrome.storage.local.get({ ysp_tracker_enabled: true }, function (items) {
    if (typeof items.ysp_tracker_enabled !== 'boolean') {
      chrome.storage.local.set({ ysp_tracker_enabled: true });
    }
  });
});

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
    }, function (items) {
      sendResponse({ ok: true, status: items });
    });
    return true;
  }
});

async function handleSyncRequest_(payload) {
  if (!payload || !payload.extensionSecret || !payload.action) {
    return { ok: false, error: 'Invalid sync payload' };
  }

  const backendUrl = String(payload.backendUrl || '').trim();
  if (!backendUrl) {
    return { ok: false, error: 'Missing backend URL in sync payload' };
  }

  const result = await postWithRetry_(backendUrl, payload, 1);
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
  return result;
}

async function postWithRetry_(url, payload, retries) {
  let lastError = '';
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        lastError = 'HTTP ' + res.status + ': ' + (text || '');
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
