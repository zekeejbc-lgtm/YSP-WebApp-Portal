# YSP Google Meet Attendance Tracker (Chrome Extension)

## Setup
1. Open `meet-attendance-extension/content.js`.
2. Set:
   - `CONFIG.backendUrl` to your deployed GAS Web App URL.
   - `CONFIG.sharedSecret` to the same value as GAS Script Property `MEET_EXTENSION_SHARED_SECRET`.
3. Open `chrome://extensions`.
4. Enable **Developer mode**.
5. Click **Load unpacked** and select this `meet-attendance-extension` folder.

## Behavior
- Auto-runs on `https://meet.google.com/*`.
- Tracks participant join/leave sessions in real time.
- Counts rejoins/exits and total duration.
- Persists in `localStorage` per meeting code (survives refresh/reopen).
- Sends heartbeat syncs and a final sync when tab/page exits.

## Payload Action
- Sends `action: "syncMeetAttendance"` to GAS.
