# Feedback Page Mechanism Analysis

## 1. Overview
The `FeedbackPage` (`src/components/FeedbackPage.tsx`) is a comprehensive module serving as the central communication hub between users (Guests, Members) and the organization (Admins, Auditors). It handles feedback submission, tracking, management, and analytical reporting.

## 2. Architecture & Dependencies

### Core Component
*   **File**: `src/components/FeedbackPage.tsx`
*   **Type**: React Functional Component
*   **Props**: `FeedbackPageProps` (handles authentication context, visibility, and toast notifications).

### Key Services
*   **`gasFeedbackService`**: Handles CRUD operations (Get, Create, Update, Delete) and Image Uploads connecting to the backend (Google Apps Script).
*   **`gasSystemToolsService`**: Handles audit logging for actions (Create, Edit, Delete).

### Major Libraries
*   **`recharts`**: Renders interactive visualization charts (Pie, Bar, Donut) in the dashboard.
*   **`jspdf` & `jspdf-autotable`**: Powers the client-side PDF generation engine.
*   **`xlsx`**: Handles Excel spreadsheet exports.
*   **`lucide-react`**: UI iconography.

## 3. Data Flow & State Management

### Data Fetching
*   **Method**: Client-side fetching via `useEffect` triggering `fetchFeedbacks`.
*   **Storage**:
    *   **Members/Admins**: Data is fetched from the backend and stored in the `feedbacks` state array.
    *   **Guests**: Data is persisted in `sessionStorage` (`guestFeedbacks` key) to survive page reloads during a single session, as guests have no permanent account identity.

### State Containers
*   **`feedbacks`**: The master list of all fetched feedback items.
*   **`formData`**: Controlled state for the submission form (author, category, rating, images, etc.).
*   **`statistics`**: Memoized object (`useMemo`) that recalculates metrics (totals, averages, breakdowns) whenever `feedbacks` changes.
*   **`exportOptions`**: Configuration state for the PDF/Excel export engine (date ranges, visibility toggles).

## 4. Feature Mechanics by Role

### A. Guest User
*   **Mechanism**: "Session-based Identity".
*   **Submission**: Generates a unique "Feedback ID" (e.g., `YSPTFB-2024-ABCD`).
*   **Tracking**: Guests must save this ID. The system warns them that data persists only for the session.
*   **Visibility**: Can only see their *own* session-submitted feedbacks and *Public* feedbacks from others.

### B. Logged-in Member
*   **Mechanism**: "Account-based Identity".
*   **Submission**: Linked to their `username`/`authorId`.
*   **Tracking**: Permanent history available in "My Feedbacks".
*   **Visibility**: Sees their own private history + all Public feedbacks.

### C. Admin & Auditor
*   **Mechanism**: "Dashboard Mode".
*   **Access**: Toggled via `isAdmin` or `userRole === 'auditor'`.
*   **Capabilities**:
    *   **Management**: Edit Status (Pending -> Reviewed -> Resolved), Delete, Reply.
    *   **Analytics**: View computed statistics and charts.
    *   **Export**: Generate reports.

## 5. The Export Engine (PDF)

The PDF generation logic is a custom implementation designed for reporting standards.

### 1. Executive Summary Generation
*   **Logic**: It dynamically constructs a natural language paragraph based on the selected date range.
*   **Example Output**: *"From [Date] to [Date], we received 50 feedbacks. We resolved 40 issues (80% rate)..."*

### 2. Segmented Reporting
Instead of one massive table, the engine filters data to create distinct sections:
*   **Status Tables**: Separate tables for 'Pending', 'Resolved', etc.
*   **Category Tables**: Separate tables for 'Bug', 'Suggestion', etc.
*   **Behavior**: Tables can be optionally hidden if empty via `showEmptyTables` setting.

### 3. Vector-Based Charting
Unlike standard HTML-to-PDF converters that take blurry screenshots, this engine **draws** charts using PDF primitives:
*   **Bar Charts**: Calculated coordinate geometry draws rectangles (`doc.rect`) directly onto the PDF canvas.
*   **Benefit**: Charts remain crisp and scalable at any zoom level or print size.

### 4. Text Handling
*   **wrapping**: Uses `jspdf-autotable`'s overflow logic to wrap long feedback messages, ensuring no text is truncated (cut off) in the final report.

## 6. UI/UX Design System

*   **Glassmorphism**: Extensive use of `backdrop-filter: blur(20px)` and semi-transparent backgrounds to create a modern, layered feel compatible with both Light and Dark modes.
*   **Optimistic UI**: When a user submits or updates feedback, the UI updates *immediately* (`setFeedbacks`) before waiting for the backend response, creating a snappy experience.
*   **Smart Feedback**: Toast notifications (via `sonner`) provide real-time progress updates (e.g., "Uploading Image 1/3...", "Generating PDF...").
