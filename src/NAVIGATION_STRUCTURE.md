# YSP NAVIGATION STRUCTURE - MASTER REFERENCE

**CRITICAL: READ THIS BEFORE MAKING ANY NAVIGATION CHANGES**

---

## ✅ CORRECT NAVIGATION STRUCTURE

### **LOGGED OUT (Public Users)**

#### Top Bar Navigation (Desktop Only):
- Home
- About  
- Projects
- Contact
- Feedback
- Tabang ta Bai
- **[Login Button]** ← STANDALONE BUTTON (not in tabs)

#### Sidebar Navigation (Mobile):
- Home
- About
- Projects
- Contact
- Feedback
- Tabang ta Bai
- Login

---

### **LOGGED IN (Members/Admins)**

#### Top Bar Navigation (Desktop Only):
- Pill navigation for: Home, About, Projects, Contact

#### Sidebar Navigation Groups:

**1. Home Group** (Dropdown)
   - About
   - Projects
   - Contact
   - Feedback
   - Tabang ta Bai

**2. Dashboard & Directory** (Dropdown - Members & Admins)
   - Officer Directory Search
   - Attendance Dashboard

**3. Attendance Management** (Dropdown - Members & Admins)
   - QR Attendance Scanner
   - My QR ID
   - Manual Attendance Entry
   - Attendance Transparency
   - Manage Events

**4. Communication Center** (Dropdown - Admins Only)
   - Announcements

**5. Logs & Reports** (Dropdown - Admins Only)
   - Access Logs
   - System Tools

**6. My Profile** (Single Item - Members & Admins)

**7. Logout** (Single Item - Members & Admins)

---

## 🚨 CRITICAL RULES - NEVER VIOLATE THESE

### 1. **Navigation Consistency**
   - ✅ Top Bar tabs = Sidebar pages (logged out state)
   - ✅ ALL public pages MUST appear in BOTH places
   - ❌ NEVER add "Login" to navigation tabs
   - ❌ NEVER add "Org Chart" to top bar tabs when logged out

### 2. **Login Button Placement**
   - ✅ Login is a STANDALONE button in Top Bar (next to dark mode toggle)
   - ✅ Login appears as regular item in Sidebar
   - ❌ NEVER put Login in the expandable tabs navigation

### 3. **Logged-In Navigation**
   - ✅ Home dropdown MUST include: About, Projects, Contact, Feedback, Tabang ta Bai
   - ✅ All 5 items are REQUIRED in the Home group
   - ❌ NEVER remove any of these 5 items from Home group

### 4. **Mobile Behavior**
   - ✅ Mobile: Show ONLY hamburger menu + logo + theme toggle
   - ✅ Mobile: Navigation tabs completely hidden
   - ❌ NEVER show expandable tabs on mobile

### 5. **Role-Based Visibility**
   - ✅ Guest: See public pages only
   - ✅ Member: See Dashboard, Attendance, My Profile
   - ✅ Admin: See EVERYTHING including Communication Center, Logs & Reports

---

## 📋 MANDATORY CHECKLIST BEFORE EVERY COMMIT

- [ ] Top Bar navigation matches Sidebar (logged out)
- [ ] Home group has ALL 5 items (About, Projects, Contact, Feedback, Tabang ta Bai)
- [ ] Login is a standalone button, not in tabs
- [ ] Mobile hides navigation tabs completely
- [ ] Role-based filtering is working correctly
- [ ] All modals/pages open correctly from both Top Bar and Sidebar

---

## 🔧 CODE LOCATIONS

### Top Bar Component
**File:** `/components/design-system/TopBar.tsx`
**Lines:** 60-71 (navigationTabs array)

### Sidebar Navigation Groups
**File:** `/App.tsx`
**Lines:** 239-441 (navigationGroups array)

### Public Pages (Logged Out)
**File:** `/App.tsx`
**Lines:** 446-522 (getVisibleGroups function - public pages section)

---

## ⚠️ COMMON MISTAKES TO AVOID

1. ❌ Adding Login to `navigationTabs` array in TopBar
2. ❌ Removing items from Home group when logged in
3. ❌ Forgetting to close dropdowns after clicking
4. ❌ Not matching Top Bar and Sidebar navigation
5. ❌ Showing navigation tabs on mobile screens

---

## ✨ WHAT WAS CLEANED UP

### Deleted Unused Files:
- `/components/NavigationSystem.tsx` - Old navigation component (2,313 lines, completely unused)
- `/components/design-system/Button.tsx` - Duplicate button component (unused)
- `/components/design-system/DESIGN_TOKENS_REFERENCE.md` - Documentation file

### Total Lines Removed: ~2,500 lines

---

**Last Updated:** November 15, 2025
**Status:** ✅ CORRECT AND VERIFIED