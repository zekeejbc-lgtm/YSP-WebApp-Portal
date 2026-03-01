'use strict';

/* ── Element references ─────────────────────────────────────────────── */
const elEnabled    = document.getElementById('enabled');
const elActive     = document.getElementById('active');
const elMeeting    = document.getElementById('meeting');
const elOrigin     = document.getElementById('origin');
const elCoverage   = document.getElementById('coverage');
const elSync       = document.getElementById('sync');
const elPending    = document.getElementById('pending');
const elError      = document.getElementById('error');
const elRefresh    = document.getElementById('refresh');
const elForceSync  = document.getElementById('forceSync');
const elHealth     = document.getElementById('health');
const elSyncLog    = document.getElementById('syncLog');
const elDiagEmpty  = document.getElementById('diagEmpty');

/* ── Storage keys ───────────────────────────────────────────────────── */
const KEYS = {
  enabled:      'ysp_tracker_enabled',
  active:       'ysp_tracker_active',
  meeting:      'ysp_tracker_current_meeting_id',
  origin:       'ysp_tracker_last_meeting_origin',
  syncAt:       'ysp_tracker_last_sync_at',
  syncOk:       'ysp_tracker_last_sync_ok',
  syncErr:      'ysp_tracker_last_sync_error',
  liveCount:    'ysp_tracker_live_count',
  seenCount:    'ysp_tracker_seen_count',
  captureCount: 'ysp_tracker_capture_count',
  syncLog:      'ysp_tracker_sync_log',
  pendingSyncs: 'ysp_tracker_pending_syncs',
};

/* ── Init ───────────────────────────────────────────────────────────── */
init_();

function init_() {
  elEnabled.addEventListener('change', function () {
    chrome.storage.local.set({ [KEYS.enabled]: !!elEnabled.checked });
  });
  elRefresh.addEventListener('click', refresh_);
  elForceSync.addEventListener('click', forceSync_);
  refresh_();
}

/* ── Refresh status ─────────────────────────────────────────────────── */
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
  const defaults = {};
  defaults[KEYS.enabled]      = true;
  defaults[KEYS.active]       = false;
  defaults[KEYS.meeting]      = '';
  defaults[KEYS.origin]       = '';
  defaults[KEYS.liveCount]    = 0;
  defaults[KEYS.seenCount]    = 0;
  defaults[KEYS.captureCount] = 0;
  defaults[KEYS.syncAt]       = '';
  defaults[KEYS.syncOk]       = false;
  defaults[KEYS.syncErr]      = 'Unable to contact background service worker';
  defaults[KEYS.syncLog]      = '[]';
  defaults[KEYS.pendingSyncs] = '[]';

  chrome.storage.local.get(defaults, function (status) {
    renderStatus_(status || {});
  });
}

/* ── Force Sync ─────────────────────────────────────────────────────── */
function forceSync_() {
  elForceSync.disabled = true;
  elForceSync.textContent = 'Syncing…';

  chrome.runtime.sendMessage({ type: 'YSP_FORCE_SYNC' }, function () {
    setTimeout(function () {
      elForceSync.disabled = false;
      elForceSync.textContent = 'Force Sync';
      refresh_();
    }, 1500);
  });
}

/* ── Render ──────────────────────────────────────────────────────────── */
function renderStatus_(status) {
  const enabled      = !!status[KEYS.enabled];
  const active       = !!status[KEYS.active];
  const meeting      = String(status[KEYS.meeting] || '');
  const origin       = String(status[KEYS.origin] || '');
  const syncAt       = String(status[KEYS.syncAt] || '');
  const syncOk       = !!status[KEYS.syncOk];
  const syncErr      = String(status[KEYS.syncErr] || '');
  const liveCount    = Number(status[KEYS.liveCount] || 0);
  const seenCount    = Number(status[KEYS.seenCount] || 0);
  const captureCount = Number(status[KEYS.captureCount] || 0);
  const syncLabel    = syncAt ? (formatManilaDateTime_(syncAt) + (syncOk ? ' ✓' : ' ✗')) : '-';

  elEnabled.checked      = enabled;
  elActive.textContent   = 'Active: ' + (active ? 'Yes' : 'No');
  elMeeting.textContent  = 'Meeting: ' + (meeting || '-');
  elOrigin.textContent   = 'Origin: ' + (origin || '-');
  elCoverage.textContent = 'Coverage: Live ' + liveCount + ' | Seen ' + seenCount + ' | Capture ' + captureCount;
  elSync.textContent     = 'Last Sync: ' + syncLabel;
  elError.textContent    = syncErr || '';

  // Health dot
  if (elHealth) {
    elHealth.className = 'health-dot';
    if (!enabled)      elHealth.classList.add('warn');
    else if (syncOk)   elHealth.classList.add('ok');
    else if (syncErr)  elHealth.classList.add('err');
  }

  // Pending queue count
  renderPendingCount_(status[KEYS.pendingSyncs]);

  // Sync diagnostics log
  renderSyncLog_(status[KEYS.syncLog]);
}

function renderPendingCount_(raw) {
  if (!elPending) return;
  let count = 0;
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    count = Array.isArray(arr) ? arr.length : 0;
  } catch (e) { count = 0; }
  elPending.textContent = 'Pending Queue: ' + count;
  elPending.style.color = count > 0 ? '#b45309' : '';
}

function renderSyncLog_(raw) {
  if (!elSyncLog) return;
  let entries = [];
  try {
    entries = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(entries)) entries = [];
  } catch (e) { entries = []; }

  elSyncLog.innerHTML = '';
  if (elDiagEmpty) elDiagEmpty.style.display = entries.length ? 'none' : 'block';

  // Show most recent first, max 20
  const toShow = entries.slice(-20).reverse();
  for (let i = 0; i < toShow.length; i++) {
    const entry = toShow[i];
    const li = document.createElement('li');
    const time = entry.ts ? formatShortTime_(entry.ts) : '?';
    const ok = !!entry.ok;
    li.className = ok ? 'ok' : 'fail';
    li.textContent = time + ' · ' + (entry.reason || 'sync') + ' · ' + (ok ? 'OK' : entry.err || 'Failed');
    elSyncLog.appendChild(li);
  }
}

/* ── Formatting helpers ──────────────────────────────────────────────── */
function formatManilaDateTime_(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value || '-');
  try {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: true,
    }).format(d) + ' (Manila)';
  } catch (error) {
    return d.toLocaleString();
  }
}

function formatShortTime_(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '?';
  try {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).format(d);
  } catch (e) {
    return d.toLocaleTimeString();
  }
}
