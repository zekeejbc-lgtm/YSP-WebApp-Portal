'use strict';

const elEnabled = document.getElementById('enabled');
const elActive = document.getElementById('active');
const elMeeting = document.getElementById('meeting');
const elOrigin = document.getElementById('origin');
const elCoverage = document.getElementById('coverage');
const elSync = document.getElementById('sync');
const elError = document.getElementById('error');
const elRefresh = document.getElementById('refresh');

const KEYS = {
  enabled: 'ysp_tracker_enabled',
  active: 'ysp_tracker_active',
  meeting: 'ysp_tracker_current_meeting_id',
  origin: 'ysp_tracker_last_meeting_origin',
  syncAt: 'ysp_tracker_last_sync_at',
  syncOk: 'ysp_tracker_last_sync_ok',
  syncErr: 'ysp_tracker_last_sync_error',
  liveCount: 'ysp_tracker_live_count',
  seenCount: 'ysp_tracker_seen_count',
  captureCount: 'ysp_tracker_capture_count',
};

init_();

function init_() {
  elEnabled.addEventListener('change', function () {
    chrome.storage.local.set({ ysp_tracker_enabled: !!elEnabled.checked });
  });
  elRefresh.addEventListener('click', refresh_);
  refresh_();
}

function refresh_() {
  chrome.runtime.sendMessage({ type: 'YSP_GET_TRACKER_STATUS' }, function (resp) {
    if (chrome.runtime.lastError || !resp || !resp.ok) {
      loadFromStorageFallback_();
      return;
    }
    renderStatus_(resp.status || {});
  });
}

function loadFromStorageFallback_() {
  chrome.storage.local.get({
    ysp_tracker_enabled: true,
    ysp_tracker_active: false,
    ysp_tracker_current_meeting_id: '',
    ysp_tracker_last_meeting_origin: '',
    ysp_tracker_live_count: 0,
    ysp_tracker_seen_count: 0,
    ysp_tracker_capture_count: 0,
    ysp_tracker_last_sync_at: '',
    ysp_tracker_last_sync_ok: false,
    ysp_tracker_last_sync_error: 'Unable to contact background service worker',
  }, function (status) {
    renderStatus_(status || {});
  });
}

function renderStatus_(status) {
  const enabled = !!status[KEYS.enabled];
  const active = !!status[KEYS.active];
  const meeting = String(status[KEYS.meeting] || '');
  const origin = String(status[KEYS.origin] || '');
  const syncAt = String(status[KEYS.syncAt] || '');
  const syncOk = !!status[KEYS.syncOk];
  const syncErr = String(status[KEYS.syncErr] || '');
  const liveCount = Number(status[KEYS.liveCount] || 0);
  const seenCount = Number(status[KEYS.seenCount] || 0);
  const captureCount = Number(status[KEYS.captureCount] || 0);
  const syncLabel = syncAt ? (formatManilaDateTime_(syncAt) + (syncOk ? ' (OK)' : ' (Failed)')) : '-';

  elEnabled.checked = enabled;
  elActive.textContent = 'Active: ' + (active ? 'Yes' : 'No');
  elMeeting.textContent = 'Meeting: ' + (meeting || '-');
  elOrigin.textContent = 'Origin: ' + (origin || '-');
  elCoverage.textContent = 'Coverage: Live ' + liveCount + ' | Seen ' + seenCount + ' | Capture ' + captureCount;
  elSync.textContent = 'Last Sync: ' + syncLabel;
  elError.textContent = syncErr || '';
}

function formatManilaDateTime_(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value || '-');
  try {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(d) + ' (Manila)';
  } catch (error) {
    return d.toLocaleString();
  }
}
