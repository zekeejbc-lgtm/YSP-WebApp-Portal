# Attendance Taking Guide (QR and Manual)

## Purpose
How admins/heads record attendance for events using the unified Attendance Recording page: QR scanning for fast check-ins and Manual Entry for edge cases.

## Where to start
- Open **Attendance Management > Record Attendance**.
- Flow is always 3 steps: **Select Event -> Choose Mode (QR or Manual) -> Record**.
- Event list shows only Active/Scheduled items; Completed/Cancelled are hidden from recording.

## Step 1: Select the event
1) Pick the event card. Details modal shows date, time, location, and geofence radius.
2) If prompted, allow **Location** so the app can validate geofence. Status shown as Inside/Outside with distance; you can tap **Force GPS Refresh** if needed.
3) Click **Continue** to lock the event and proceed.

## Step 2: Choose the recording mode
- **QR Scanner**: fastest, uses camera; best for checkpoints.
- **Manual Entry**: search-and-select a member and set a status; use for edge cases or corrections.

## Step 3A: QR Scanner flow
1) Camera permission: allow access; back camera is used. If denied, scanner stops.
2) Scanner auto-starts; a 280x280 box appears. Hold the member’s **My QR ID** to the camera.
3) On scan:
   - Member is looked up (cached, then backend if needed).
   - The selected **Time Type** controls action:
     - **Time In**: records `Present` with geolocation if available.
     - **Time Out**: records checkout; requires an existing Time In.
4) Success opens a verification modal (shows member, event, time). Closing it resumes scanning.
5) Safety rails:
   - Same QR within ~0.8s is ignored (cooldown).
   - If member already has a record, an overwrite warning appears before changing it.
   - Errors surfaced: "Member not found", "No Time In", "Already Timed Out", camera denied.

## Step 3B: Manual Entry flow
1) Search member by name, committee, or ID; pick from dropdown.
2) Choose **Status**:
   - Time In supports `Present`, `Late`, `Excused`, `Absent`.
   - Time Out only allows present/late; Absent/Excused cannot time-out.
3) Set **Time Type** (In/Out).
4) Submit:
   - If a record exists, you see an overwrite warning showing the prior stamp before confirming.
   - Otherwise it records immediately (geolocation sent when available).
5) A verification modal confirms success; close it to continue.

## Overwrites and validations
- Existing record check runs before saving. Overwrite requires explicit confirmation and logs the update.
- Manual Absent/Excused uses the manual endpoint; Present/Late Time In uses the standard Time In API.
- Time Out validates prior Time In and blocks double check-outs.

## Permissions and geofence
- **Location**: requested when viewing event details; used to mark inside/outside radius and include lat/lng on submissions.
- **Camera**: required only for QR mode; deny = scanner stops and QR mode cannot continue until re-granted.

## Tips
- If GPS seems off: go outdoors, wait a few seconds, tap **Force GPS Refresh**.
- If scanning pauses after a modal, it auto-resumes shortly; you can also tap **Start Scanning**.
- Keep member QR codes handy via **My QR ID** page for fastest processing.

## Related components
- Recording UX and logic: [src/components/AttendanceRecordingPage.tsx](src/components/AttendanceRecordingPage.tsx)
- Member QR source: [src/components/MyQRIDPage.tsx](src/components/MyQRIDPage.tsx)
- Dashboards/exports: [src/components/AttendanceDashboardPage.tsx](src/components/AttendanceDashboardPage.tsx)
