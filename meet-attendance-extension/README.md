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
- Sends `meeting.originHint: "meet_page_auto"` so backend can classify origin as:
  - `frontend` when the meet code matches a scheduled row created in app.
  - `manual_gmeet` when it is a direct/manual Google Meet.
- Includes extension popup UI:
  - Enable/disable tracker
  - Active state and current meeting code
  - Last sync status and backend origin
- Includes MV3 service worker (`background.js`) to execute sync POST calls outside page context.

## Payload Action
- Sends `action: "syncMeetAttendance"` to GAS.

## Important Limitation
- No extension can keep reading live Meet participants after the Meet tab is fully closed, because participant data comes from the page DOM.
- This extension records while the tab is open, and sends final sync when leaving.
- The service worker helps dispatch sync requests reliably, but it does not have access to live participant DOM data without an open Meet tab.
