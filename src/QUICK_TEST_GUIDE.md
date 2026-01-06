# 🚀 QUICK TEST GUIDE - Manage Members

## How to Test in 60 Seconds

### Step 1: Login
1. Click **Login** button on homepage
2. Enter any credentials (mock login)
3. You're now logged in as **Admin**

### Step 2: Open Manage Members
1. Click **hamburger menu** (☰) in top-left
2. Find **"Dashboard & Directory"** section
3. Click **"Manage Members"**

### Step 3: Explore Main Page
- See **3 stat cards** (Total: 4, Active: 4, Pending: 2)
- **Search bar** - Type "Juan" to filter
- **Filter dropdowns** - Try "Admin" role
- **Members table** - 4 members listed
- **Action buttons** at top-right

### Step 4: View Pending Applications
1. Click **"Pendings (2)"** button at top-right
2. Modal opens with **2 pending applications**
3. Click **"View Application"** on Jose Martinez

### Step 5: Explore Resume Panel
- See **profile picture** (or initial "J")
- **Contact info** displayed prominently
- **Action buttons** on the right side
- Scroll to see:
  - ✅ Basic info cards (Gender, Age, etc.)
  - ✅ Skills section
  - ✅ Education section
  - ✅ Reason for joining
  - ✅ Personal statement
  - ✅ Emergency contact
  - ✅ Social media
  - ✅ Attachments (ID, Resume)
  - ✅ Admin notes field

### Step 6: Test Actions
1. Click **Approve** - Green success toast
2. Close and reopen another application
3. Click **Reject** - Red error toast
4. Click **Send Email** - Info toast
5. Click **Download PDF** - Coming soon toast
6. Click **X** to close

### Step 7: Test Other Features
1. Click **Export** button - Export toast
2. Click **Add Member** - Coming soon toast
3. Toggle **Dark Mode** - Everything adjusts
4. Close page with **X** in top-right

---

## 🎯 What You Should See

### Main Page:
- Clean glassmorphism cards
- Responsive table with hover effects
- Color-coded role badges (Red=Admin, Orange=Officer, Green=Member)
- Active status badges (Green=Active)
- Working search and filters

### Pendings Modal:
- List of 2 applications
- Committee badges (blue)
- Date applied badges (yellow)
- Hover effects on cards

### Application Panel:
- Professional resume layout
- Large profile area
- Organized sections
- Smooth scrolling
- Color-coded action buttons
- All text clearly visible in both light/dark mode

---

## ✅ Expected Behavior

| Action | Expected Result |
|--------|----------------|
| Search "Juan" | Shows 1 member (Juan Dela Cruz) |
| Filter Role = Admin | Shows 1 member (Admin only) |
| Filter Committee = Executive Board | Shows 1 member |
| Clear filters | Shows all 4 members |
| Click Pendings | Opens modal with 2 applications |
| View Application | Opens full resume panel |
| Approve | Success toast + panel closes |
| Reject | Error toast + panel closes |
| Send Email | Info toast shown |
| Toggle Dark Mode | All elements adjust colors |

---

## 🐛 If Something Doesn't Work

**If you can't find "Manage Members":**
- Make sure you're logged in as Admin
- Check the "Dashboard & Directory" dropdown

**If the page is blank:**
- Check browser console for errors
- Try refreshing the page

**If buttons don't respond:**
- They should all show toast notifications
- Approve/Reject close the panel
- Email/Download show info messages

---

## 📱 Mobile Testing

1. Resize browser to mobile width
2. Hamburger menu should work
3. Table scrolls horizontally
4. Modals/panels are responsive
5. Cards stack vertically

---

## 🎨 Design Check

✅ YSP red (#f6421f) - Headings, gradients
✅ YSP orange (#ee8724) - Subheadings, badges
✅ Lexend font - All headings
✅ Roboto font - All body text
✅ Glassmorphism - All cards
✅ Dark mode - Full support
✅ Smooth animations - Hovers, transitions

---

**Everything should work perfectly! Enjoy testing! 🎉**
