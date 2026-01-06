# Developer & Founder Modal Editing Guide

## Quick Access

1. **Open Homepage** (log out if needed)
2. **Scroll to bottom** of homepage
3. **Click Developer or Founder name/image** in the footer
4. **Log in as Admin or Auditor** to see Edit button

---

## Developer Modal Edit Mode

### To Enable Edit Mode:
- Must be logged in as **Admin** or **Auditor**
- Click the **Edit icon** (pencil) in modal header
- Edit icon becomes **Save icon** (checkmark) in green

### Editable Sections:

#### 1. Profile Image
```
[Upload Image] button appears
- Click to select image file
- Max 5MB
- Accepts: PNG, JPEG, JPG
- Shows success/error toast
```

#### 2. Basic Info
- Name (text input)
- Title (text input)
- Position (text input)
- Organization (text input)

#### 3. Social Links
```
5 URL inputs appear:
- GitHub URL
- Facebook URL
- LinkedIn URL
- Twitter URL
- Website URL
```

#### 4. Text Areas
- About (large textarea)
- Background (large textarea)
- Project Highlights (large textarea)
- Development Philosophy (textarea)

#### 5. Technical Expertise
```
For each skill:
- Edit skill name inline
- Click [Trash] icon to remove

Bottom of section:
- Click [+ Add Skill] to add new
```

#### 6. Technology Stack
```
For each tech:
- Edit tech name
- Edit category
- Click [Trash] icon to remove

Bottom of section:
- Click [+ Add Tech] to add new
```

#### 7. Contact Information
```
3 inputs:
- Email (email validation)
- Phone (tel validation)
- Location (text input)
```

### To Save Changes:
- Click **Save icon** (green checkmark) in header
- Shows success toast
- Returns to view mode

---

## Founder Modal Edit Mode

### To Enable Edit Mode:
- Must be logged in as **Admin** or **Auditor**
- Click the **Edit icon** (pencil) in modal header
- Edit icon becomes **Save icon** (checkmark) in green

### Editable Sections:

#### 1. Profile Image
```
[Upload Image] button appears (YSP red color)
- Click to select image file
- Max 5MB
- Accepts: PNG, JPEG, JPG
- Shows success/error toast
```

#### 2. Basic Info
- Name (text input)
- Nickname (text input)
- Title (text input)

#### 3. Social Links
```
5 URL inputs appear:
- Facebook URL
- Instagram URL
- Twitter URL
- LinkedIn URL
- Website URL
```

#### 4. Text Areas
- About (large textarea)
- Background & Journey (large textarea)
- Organizational Impact (large textarea)
- Leadership Philosophy (textarea)

#### 5. Key Achievements
```
For each achievement:
- Edit achievement text inline
- Click [Trash] icon to remove

Bottom of section:
- Click [+ Add Achievement] to add new
```

#### 6. Contact Information
```
3 inputs:
- Email (email validation)
- Phone (tel validation)
- Office Location (text input)
```

### To Save Changes:
- Click **Save icon** (green checkmark) in header
- Shows success toast
- Returns to view mode

---

## Color Coding

### Developer Modal:
- **Primary Color:** Blue (#3b82f6)
- **Upload Button:** Blue
- **Add Buttons:** Blue
- **Profile Border:** Blue

### Founder Modal:
- **Primary Color:** YSP Red (#f6421f)
- **Upload Button:** Red to Orange gradient
- **Add Buttons:** Red
- **Profile Border:** Red

---

## Keyboard Shortcuts

- **ESC:** Close modal
- **TAB:** Navigate between fields (in edit mode)
- **ENTER:** (in single-line inputs) moves to next field

---

## Notes for Admins

1. **All changes are local** - In production, this would save to backend
2. **Image previews** work immediately after upload
3. **No confirmation needed** - Changes save directly
4. **Toast notifications** confirm all actions
5. **Empty social links** won't show icons in view mode
6. **All arrays** (skills, tech, achievements) can be reordered by editing

---

## Testing Checklist

### Before Editing:
- [ ] Modal opens correctly
- [ ] All content displays properly
- [ ] Social icons show for non-empty links
- [ ] Dark mode styling correct

### During Editing:
- [ ] Edit button appears (admins only)
- [ ] Click edit button → fields become editable
- [ ] Upload button appears
- [ ] Can select image file
- [ ] File size validation works (try >5MB)
- [ ] Can add new items (skills/tech/achievements)
- [ ] Can edit existing items
- [ ] Can delete items
- [ ] All URL fields accept URLs
- [ ] Email/phone validation works

### After Saving:
- [ ] Save button changes to edit button
- [ ] Success toast appears
- [ ] All changes persist in view mode
- [ ] New items show correctly
- [ ] Deleted items are gone
- [ ] Images display if uploaded

---

## Troubleshooting

### Edit button not showing?
- Make sure you're logged in as Admin or Auditor
- Check userRole state in App.tsx

### Image won't upload?
- Check file size (must be <5MB)
- Check file type (PNG, JPEG, JPG only)
- Check browser console for errors

### Changes not saving?
- Check browser console for errors
- Verify handleSave() is being called
- In production, implement backend save logic

### Dark mode issues?
- Check if isDark prop is being passed correctly
- Verify dark: classes on new elements

---

## Future Enhancements

Potential improvements for production:
1. **Backend Integration**
   - Save to database/API
   - Real-time sync
   - Version history

2. **Image Optimization**
   - Compress images on upload
   - Generate thumbnails
   - Cloud storage integration

3. **Advanced Editing**
   - Rich text editor for long text
   - Drag-and-drop reordering
   - Bulk operations

4. **Validation**
   - URL format checking
   - Required field enforcement
   - Character limits

5. **Audit Trail**
   - Track who edited what
   - Timestamp changes
   - Approval workflow
