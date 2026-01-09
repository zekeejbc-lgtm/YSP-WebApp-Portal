# Email Verification System Implementation

## Overview
This document outlines the complete implementation of the OTP-based email verification system for the YSP Tagum WebApp.

## Changes Made

### 1. Backend (Google Apps Script)

#### File: `gas-backend/Loginpage_Main.gs`

**New Functions Added:**

1. **`setupEmailVerificationSheet()`** - Creates the OTP verification sheet
   - Run this function ONCE in Apps Script editor to create the `Email_Verification_OTPs` sheet
   - Creates headers: Username, Email, OTP_Code, Created_At, Expires_At, Verified

2. **`generateOTP()`** - Generates a random 6-digit OTP code

3. **`sendOTPVerificationEmail(email, name, otp)`** - Sends the OTP email
   - Uses the same beautiful HTML email design as other system emails
   - Shows OTP in a prominent box with expiry notice (15 minutes)

4. **`handleSendVerificationOTP(username, email)`** - API handler for sending OTP
   - Validates email format
   - Deletes any existing OTPs for the same username+email
   - Generates and stores new OTP
   - Sends email with OTP

5. **`handleVerifyOTP(username, email, otp)`** - API handler for verifying OTP
   - Checks if OTP exists and is not expired
   - Marks email as verified in the OTP sheet
   - Updates user profile with verification status

6. **`handleCheckEmailVerified(username, email)`** - Checks if email is already verified

7. **`updateVerifiedEmailInProfile(username, verifiedEmail)`** - Updates profile after verification

**API Routes Added to `doPost()`:**
- `sendVerificationOTP` - Send OTP to email
- `verifyOTP` - Verify entered OTP
- `checkEmailVerified` - Check verification status

**Protected Fields Updated:**
- Added `email` to protected fields (users can no longer edit their Account Email)

---

### 2. Frontend Service

#### File: `src/services/gasLoginService.ts`

**New Types:**
```typescript
export interface SendOTPResponse {
  success: boolean;
  message?: string;
  expiresInMinutes?: number;
  error?: string;
}

export interface VerifyOTPResponse {
  success: boolean;
  verified?: boolean;
  message?: string;
  error?: string;
}

export interface CheckEmailVerifiedResponse {
  success: boolean;
  verified?: boolean;
  verifiedEmail?: string;
  error?: string;
}
```

**New Functions:**
- `sendVerificationOTP(username, email)` - Send OTP request
- `verifyOTP(username, email, otp)` - Verify OTP request
- `checkEmailVerified(username, email)` - Check status request

---

### 3. Email Verification Modal

#### File: `src/components/EmailVerificationModal.tsx` (NEW)

**Features:**
- 6-digit OTP input fields with auto-focus and paste support
- 30-second countdown timer for resend button
- 15-minute expiry notice
- Success animation when verified
- Consistent design with other modals (ChangePasswordModal)
- Progress toast integration for send/verify operations

---

### 4. Profile Page Updates

#### File: `src/components/MyProfilePage.tsx`

**Changes:**
1. **Removed "Email (Account)" field** from Personal Information section
2. **Enhanced Personal Email field** with:
   - Verification status indicator (Verified ✓ / Not verified ⚠)
   - "Verify" button when email is not verified
   - Green border when email is verified
3. **Email change detection** - If user changes email, verification status resets
4. **Auto-check verification status** on profile load

**New State Variables:**
```typescript
const [showEmailVerificationModal, setShowEmailVerificationModal] = useState(false);
const [isEmailVerified, setIsEmailVerified] = useState(false);
const [verifiedEmail, setVerifiedEmail] = useState<string>('');
const [isCheckingVerification, setIsCheckingVerification] = useState(false);
```

---

## Setup Instructions

### Step 1: Create OTP Sheet (ONE TIME)
1. Go to your Google Apps Script project
2. Select `setupEmailVerificationSheet` from the function dropdown
3. Click **Run**
4. The sheet `Email_Verification_OTPs` will be created

### Step 2: Grant Permissions
1. If prompted, grant email permissions
2. Run `forcePermissions` to test all permissions

### Step 3: Deploy Web App
1. Go to **Deploy > Manage deployments**
2. Click the **Edit** (pencil) icon
3. Select **New version** from the dropdown
4. Click **Deploy**

---

## OTP Sheet Structure

| Column | Name | Description |
|--------|------|-------------|
| A | Username | The user requesting verification |
| B | Email | Email address being verified |
| C | OTP_Code | 6-digit verification code |
| D | Created_At | When OTP was generated |
| E | Expires_At | When OTP expires (15 min from creation) |
| F | Verified | TRUE if verified, FALSE otherwise |

---

## 🔒 Security Features (NEW)

### 1. Auto-Cleanup
- **Used OTPs**: Automatically deleted immediately after successful verification
- **Expired OTPs**: Automatically cleaned up during any verification operation
- **Duplicate Prevention**: Old OTPs for same user+email deleted when new one requested

### 2. Rate Limiting
- **Maximum Requests**: 5 OTP requests per hour per user
- **HTTP 429 Response**: Returns "Too Many Requests" when limit exceeded
- **Reset Time**: Limit resets after 1 hour from first request

### 3. Failed Attempt Tracking
- **Maximum Attempts**: 5 failed verification attempts allowed
- **Account Lockout**: User locked out for 30 minutes after max failures
- **HTTP 423 Response**: Returns "Locked" status when account is locked
- **Auto-Reset**: Failed attempt counter resets after successful verification

### 4. Additional Security
- **OTP Expiry**: 15 minutes from generation
- **Single Use**: OTP deleted immediately after use (can't be reused)
- **Email Validation**: Strict regex validation for email format
- **Protected Fields**: Account email cannot be edited by users

### Security Configuration Constants
```javascript
const MAX_OTP_REQUESTS_PER_HOUR = 5;  // Rate limiting
const MAX_FAILED_ATTEMPTS = 5;         // Max wrong OTP entries
const LOCKOUT_MINUTES = 30;            // Lockout duration
```

### New Sheet Created: `OTP_Failed_Attempts`
| Column | Name | Description |
|--------|------|-------------|
| A | Username | The username |
| B | Email | Email address |
| C | Failed_Attempts | Count of failed OTP entries |
| D | Last_Attempt | Timestamp of last failed attempt |
| E | Locked_Until | When lockout expires (if locked) |

---

## User Flow

1. User goes to My Profile
2. User enters/updates their Personal Email
3. User clicks **Verify** button
4. Modal opens explaining the process
5. User clicks **Send Verification Code**
6. System sends OTP email (expires in 15 minutes)
7. Modal shows 6-digit input fields
8. User enters the code from their email
9. System verifies and shows success
10. Email field shows "Verified ✓" status
11. If user changes email, verification resets

---

## Design Consistency

All components use:
- `DESIGN_TOKENS` for spacing, colors, typography
- Orange gradient buttons (`#f6421f` to `#ee8724`)
- Same modal structure as ChangePasswordModal
- Same toast integration for progress feedback
- Same email template design (YSP branding, Lexend/Roboto fonts)
