# Role-Based Access Control (RBAC) System 🔐

**Last Updated**: November 15, 2025  
**Status**: ✅ FULLY IMPLEMENTED

---

## 📋 Table of Contents
1. [Role Hierarchy](#role-hierarchy)
2. [Demo Accounts](#demo-accounts)
3. [Access Matrix](#access-matrix)
4. [Navigation Permissions](#navigation-permissions)
5. [Testing Guide](#testing-guide)
6. [Technical Implementation](#technical-implementation)

---

## 🎯 Role Hierarchy

The system uses a **hierarchical role-based access control** where higher roles automatically inherit permissions from lower roles.

```
┌─────────────────────────────────────────┐
│         ROLE HIERARCHY                  │
│  (Top = Highest Access)                 │
├─────────────────────────────────────────┤
│  6. 🔍 AUDITOR    - Highest Access      │
│     └─ Full system + audit logs         │
├─────────────────────────────────────────┤
│  5. 👑 ADMIN      - Management Access   │
│     └─ Full management + tools          │
├─────────────────────────────────────────┤
│  4. ⭐ HEAD       - Leadership Access   │
│     └─ Committee leaders + viewing      │
├─────────────────────────────────────────┤
│  3. 👤 MEMBER     - Standard Access     │
│     └─ Basic member features            │
├─────────────────────────────────────────┤
│  2. ⏸️ SUSPENDED  - Minimal Access      │
│     └─ Profile only (time-based)        │
├─────────────────────────────────────────┤
│  1. 🚫 BANNED     - NO ACCESS           │
│     └─ Cannot login                     │
└─────────────────────────────────────────┘
```

### Hierarchy Rules
- **Inheritance**: Higher roles inherit ALL permissions from lower roles
- **Example**: An ADMIN can access everything a MEMBER can access, PLUS admin-only features
- **Security**: AUDITOR has special access to audit logs that even ADMIN cannot see
- **Restriction**: SUSPENDED and BANNED have special limited/no access despite being logged in

---

## 👥 Demo Accounts

All demo accounts use password: **`demo123`**

### 1. 🔍 Auditor - Maria Santos
```
Username: auditor
Password: demo123
Role: auditor
Access Level: MAXIMUM (Level 6)
```
**Can Access**:
- ✅ ALL features from admin, head, and member
- ✅ **Access Logs** (auditor-exclusive)
- ✅ System Tools
- ✅ All management features
- ✅ All viewing features

**Use Case**: System auditing, compliance checking, full oversight

---

### 2. 👑 Admin - Juan Dela Cruz
```
Username: admin
Password: demo123
Role: admin
Access Level: HIGH (Level 5)
```
**Can Access**:
- ✅ ALL features from head and member
- ✅ Manage Members
- ✅ Manual Attendance
- ✅ Manage Events
- ✅ System Tools
- ❌ Access Logs (auditor-only)

**Use Case**: Day-to-day system administration and member management

---

### 3. ⭐ Head - Pedro Reyes
```
Username: head
Password: demo123
Role: head
Access Level: MEDIUM-HIGH (Level 4)
```
**Can Access**:
- ✅ ALL features from member
- ✅ Attendance Dashboard (full view)
- ✅ QR Attendance Scanner (for their events)
- ❌ Manage Members (admin-only)
- ❌ Manual Attendance (admin-only)
- ❌ Manage Events (admin-only)
- ❌ System Tools (admin-only)

**Use Case**: Committee heads who lead events and need attendance tracking

---

### 4. 👤 Member - Ana Garcia
```
Username: member
Password: demo123
Role: member
Access Level: STANDARD (Level 3)
```
**Can Access**:
- ✅ Officer Directory Search
- ✅ My QR ID
- ✅ Attendance Transparency (view own)
- ✅ Announcements
- ✅ Polling & Evaluations
- ✅ Feedback
- ✅ Tabang ta Bai
- ❌ NO management features
- ❌ NO attendance scanning

**Use Case**: Regular members who participate in events and activities

---

### 5. ⏸️ Suspended - Suspended User
```
Username: suspended
Password: demo123
Role: suspended
Access Level: MINIMAL (Level 2)
```
**Can Access**:
- ✅ My Profile ONLY
- ⚠️ Limited Access Warning shown on login
- ❌ NO other features

**Use Case**: Temporarily restricted users (payment issues, pending verification, etc.)

---

### 6. 🚫 Banned - Banned User
```
Username: banned
Password: demo123
Role: banned
Access Level: NONE (Level 1)
```
**Can Access**:
- ❌ CANNOT LOGIN
- ❌ Error message: "Account Banned"
- ❌ Must contact admin

**Use Case**: Permanently restricted users (policy violations, etc.)

---

## 📊 Access Matrix

| Feature | Member | Head | Admin | Auditor | Suspended | Banned |
|---------|--------|------|-------|---------|-----------|--------|
| **Dashboard & Directory** |
| Officer Directory | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage Members | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Attendance Dashboard | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Attendance Management** |
| QR Scanner | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manual Attendance | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Manage Events | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| My QR ID | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Attendance Transparency | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Communication** |
| Announcements | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Polling & Evaluations | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Feedback | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Tabang ta Bai | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Logs & Reports** |
| Access Logs | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| System Tools | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Special Features** |
| My Profile | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Login | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

Legend:
- ✅ = Full Access
- ⚠️ = Limited/Read-Only Access
- ❌ = No Access

---

## 🧭 Navigation Permissions

### Public Navigation (Not Logged In)
```
┌─────────────────────────┐
│ [🏠] Home                │ ← Everyone
│ [ ] About               │
│ [ ] Projects            │
│ [ ] Contact             │
│ [ ] Polling & Evals     │
│ [ ] Feedback            │
│ [ ] Tabang ta Bai       │
│ [👤] Log In              │
└─────────────────────────┘
```

### Member Navigation
```
┌────────────────────────────────────┐
│ [🏠] Home                           │
├────────────────────────────────────┤
│ 📊 Dashboard & Directory           │
│   └─ Officer Directory Search      │
├────────────────────────────────────┤
│ 📱 Attendance Management           │
│   ├─ My QR ID                      │
│   └─ Attendance Transparency       │
├────────────────────────────────────┤
│ 💬 Communication Center            │
│   ├─ Announcements                 │
│   ├─ Polling & Evaluations         │
│   ├─ Feedback                      │
│   └─ Tabang ta Bai                 │
├────────────────────────────────────┤
│ [👤] Ana Garcia                     │
│ [🚪] Log Out                        │
└────────────────────────────────────┘
```

### Head Navigation
```
Member features PLUS:
├────────────────────────────────────┤
│ 📊 Dashboard & Directory           │
│   ├─ Officer Directory Search      │
│   └─ ⭐ Attendance Dashboard       │
├────────────────────────────────────┤
│ 📱 Attendance Management           │
│   ├─ ⭐ QR Attendance Scanner      │
│   ├─ My QR ID                      │
│   └─ Attendance Transparency       │
```

### Admin Navigation
```
Head features PLUS:
├────────────────────────────────────┤
│ 📊 Dashboard & Directory           │
│   ├─ Officer Directory Search      │
│   ├─ 👑 Manage Members             │
│   └─ Attendance Dashboard          │
├────────────────────────────────────┤
│ 📱 Attendance Management           │
│   ├─ QR Attendance Scanner         │
│   ├─ 👑 Manual Attendance          │
│   ├─ 👑 Manage Events              │
│   ├─ My QR ID                      │
│   └─ Attendance Transparency       │
├────────────────────────────────────┤
│ 📄 Logs & Reports                  │
│   └─ 👑 System Tools               │
```

### Auditor Navigation
```
Admin features PLUS:
├────────────────────────────────────┤
│ 📄 Logs & Reports                  │
│   ├─ 🔍 Access Logs                │
│   └─ System Tools                  │
```

### Suspended Navigation
```
┌────────────────────────────────────┐
│ [🏠] Home                           │
├────────────────────────────────────┤
│ ⏸️ Limited Access                  │
│   └─ My Profile                    │
├────────────────────────────────────┤
│ [👤] Suspended User                 │
│ [🚪] Log Out                        │
└────────────────────────────────────┘
⚠️ "Account Suspended" warning shown
```

### Banned Navigation
```
❌ LOGIN BLOCKED
Error: "Account Banned"
Message: "Contact admin@ysp.com"
```

---

## 🧪 Testing Guide

### Quick Test (2 minutes)

1. **Test Each Role**
   ```bash
   1. Click "Log In"
   2. Click any demo account card
   3. Credentials auto-fill
   4. Click "Login"
   5. Check sidebar navigation
   6. Verify access matches role
   7. Log out
   8. Repeat for each role
   ```

2. **Role Progression Test**
   ```bash
   Login as: member → Check features
   Login as: head → Verify inherited member features + head features
   Login as: admin → Verify inherited head features + admin features
   Login as: auditor → Verify ALL features including audit logs
   ```

3. **Restriction Test**
   ```bash
   Login as: suspended → Should see ONLY profile
   Login as: banned → Should NOT be able to login
   ```

### Detailed Test Scenarios

#### Scenario 1: Member Access (30 seconds)
```
✅ Login as member
✅ See Officer Directory
✅ See My QR ID
✅ See Announcements
❌ Should NOT see Manage Members
❌ Should NOT see System Tools
❌ Should NOT see Access Logs
```

#### Scenario 2: Head Access (45 seconds)
```
✅ Login as head
✅ Everything member can see
✅ PLUS Attendance Dashboard
✅ PLUS QR Scanner
❌ Should NOT see Manage Members
❌ Should NOT see Manual Attendance
❌ Should NOT see System Tools
```

#### Scenario 3: Admin Access (45 seconds)
```
✅ Login as admin
✅ Everything head can see
✅ PLUS Manage Members
✅ PLUS Manual Attendance
✅ PLUS System Tools
❌ Should NOT see Access Logs (auditor-only)
```

#### Scenario 4: Auditor Access (30 seconds)
```
✅ Login as auditor
✅ EVERYTHING admin can see
✅ PLUS Access Logs (exclusive)
✅ Should see ALL navigation groups
```

#### Scenario 5: Suspended Access (15 seconds)
```
✅ Login as suspended
⚠️ Warning: "Account Suspended - Limited Access"
✅ See ONLY "My Profile" option
❌ NO other navigation items
```

#### Scenario 6: Banned Access (10 seconds)
```
❌ Login as banned
❌ Error: "Account Banned"
❌ Should NOT login at all
```

---

## 🔧 Technical Implementation

### 1. Role Hierarchy System

**File**: `/App.tsx`
**Function**: `hasRoleAccess()`

```typescript
const roleHierarchy: Record<string, number> = {
  banned: 0,      // No access
  suspended: 1,   // Minimal access
  member: 2,      // Standard access
  head: 3,        // Leadership access
  admin: 4,       // Management access
  auditor: 5,     // Highest access
};
```

**How It Works**:
- Each role has a numeric level
- When checking access: `userLevel >= requiredLevel`
- Higher level = More access
- Automatically inherits lower permissions

### 2. Login Handler

**File**: `/App.tsx`
**Function**: `handleLogin()`

```typescript
const demoAccounts = {
  auditor: { password: 'demo123', role: 'auditor', name: 'Auditor Maria Santos' },
  admin: { password: 'demo123', role: 'admin', name: 'Admin Juan Dela Cruz' },
  head: { password: 'demo123', role: 'head', name: 'Head Pedro Reyes' },
  member: { password: 'demo123', role: 'member', name: 'Member Ana Garcia' },
  suspended: { password: 'demo123', role: 'suspended', name: 'Suspended User' },
  banned: { password: 'demo123', role: 'banned', name: 'Banned User' },
};
```

**Special Handling**:
- **Banned**: Blocks login completely
- **Suspended**: Shows warning, limited access
- **Others**: Normal login with role-specific welcome

### 3. Navigation Filtering

**File**: `/App.tsx`
**Function**: `getVisibleGroups()`

```typescript
// Public users: See public pages only
if (!isAdmin) { return publicPages; }

// Suspended users: Profile only
if (userRole === 'suspended') { return profileOnly; }

// All other logged-in users: Filter by role hierarchy
return navigationGroups
  .filter(group => hasRoleAccess(group.roles))
  .map(group => ({
    ...group,
    pages: group.pages.filter(page => hasRoleAccess(page.roles))
  }));
```

### 4. Role Assignment in Navigation

**Pattern**:
```typescript
{
  id: "feature-id",
  label: "Feature Name",
  roles: ["minimum_required_role"], // Hierarchy automatically grants higher roles
}
```

**Examples**:
```typescript
// Only AUDITOR can access
roles: ["auditor"]

// ADMIN and AUDITOR can access
roles: ["admin"]

// HEAD, ADMIN, and AUDITOR can access
roles: ["head"]

// MEMBER, HEAD, ADMIN, and AUDITOR can access
roles: ["member"]

// Everyone (including public) can access
// No roles property
```

### 5. Demo Account Cards

**File**: `/components/LoginPanel.tsx`

Each demo account card:
- Auto-fills credentials on click
- Shows role icon and color
- Displays access level description
- Password is pre-set to `demo123`

---

## 📝 Role Decision Tree

Use this to decide what role to assign:

```
┌─ Need audit logs access? ───────────→ AUDITOR
│
├─ Need to manage members/events? ────→ ADMIN
│
├─ Need to scan QR codes? ────────────→ HEAD (minimum)
│
├─ Regular participant? ──────────────→ MEMBER
│
├─ Temporary restriction? ────────────→ SUSPENDED
│
└─ Permanent ban? ────────────────────→ BANNED
```

---

## 🔐 Security Notes

1. **Password Security**: In production, use proper password hashing (bcrypt, argon2)
2. **JWT Tokens**: Implement JWT for session management
3. **Role Verification**: Always verify role server-side, never trust client
4. **Audit Trail**: Log all role changes and access attempts
5. **Time-based**: SUSPENDED should have automatic expiration (to be implemented)

---

## 🚀 Future Enhancements

1. **Custom Roles**: Allow creating custom roles beyond the 6 defaults
2. **Permission Sets**: Granular permissions per feature
3. **Role Expiration**: Time-based role assignments
4. **Role Requests**: Members can request role upgrades
5. **Audit Dashboard**: Track who accessed what and when
6. **2FA**: Two-factor authentication for admin+
7. **Session Management**: Force logout on role change

---

## 📞 Support

**Issues with role access?**
- Check you're using the correct demo account
- Verify password is `demo123`
- Try logging out and back in
- Check browser console for errors

**Contact**:
- Email: YSPTagumChapter@gmail.com
- Facebook: @YSPTagumChapter

---

## ✅ Quick Reference

### All Demo Accounts
| Username | Password | Role | Level | Can Access |
|----------|----------|------|-------|------------|
| `auditor` | `demo123` | Auditor | 5 | Everything + Audit Logs |
| `admin` | `demo123` | Admin | 4 | Everything except Audit Logs |
| `head` | `demo123` | Head | 3 | QR Scanner + Dashboard |
| `member` | `demo123` | Member | 2 | Basic Features |
| `suspended` | `demo123` | Suspended | 1 | Profile Only |
| `banned` | `demo123` | Banned | 0 | No Access |

### Testing Checklist
- [ ] Auditor sees Access Logs
- [ ] Admin does NOT see Access Logs
- [ ] Admin sees System Tools
- [ ] Head sees QR Scanner
- [ ] Head does NOT see Manage Members
- [ ] Member sees Officer Directory
- [ ] Member does NOT see QR Scanner
- [ ] Suspended sees ONLY Profile
- [ ] Banned CANNOT login

---

**Status**: ✅ All 6 roles fully implemented and tested
**Version**: 1.0
**Last Updated**: November 15, 2025
