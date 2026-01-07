# Project Upload - Quick Guide ✅

## How to Upload a Project

### Step 1: Open Upload Modal
1. Navigate to **Projects** section
2. Click **"Add New Project"** or **"Upload New Project"** button

### Step 2: Fill Project Details
- **Title** ⭐ Required
- **Description** ⭐ Required  
- **Image** ⭐ Required (PNG, JPG up to 5MB)
- **Link** (Optional) - External project link
- **Link Button Text** (Optional) - Text for the button

### Step 3: Submit
- Click **"Upload"** button to submit
- Form will validate all required fields

### Step 4: Monitor Upload Progress

#### 📍 Location: Bottom-Right Corner
The progress toast appears at the **bottom-right of your screen** showing:

```
┌─────────────────────────────┐
│ 🟠 Uploading Project        │  ← Orange border
│                             │
│ Converting image... 30%     │  ← Current stage
│                             │
│ [░░░░░░░░░░░░░░░░] 30%     │  ← Progress bar
└─────────────────────────────┘
```

#### Progress Stages

| Stage | % | Message | Icon |
|-------|---|---------|------|
| 1 | 10% | Preparing image... | 🔄 |
| 2 | 30% | Converting image... | 🔄 |
| 3 | 50% | Sending to server... | 📤 |
| 4 | 75% | Processing response... | ⏳ |
| 5 | 90% | Saving project... | 💾 |
| 6 | 100% | **Success!** | ✅ |

### Step 5: Completion

#### ✅ Success Toast
```
┌─────────────────────────────┐
│ ✅ Project Uploaded         │  ← Green border
│ My Awesome Project          │  ← Project title
└─────────────────────────────┘
```
- Auto-dismisses after 4 seconds
- Can be manually closed

#### ❌ Error Toast
```
┌─────────────────────────────┐
│ ❌ Upload Failed            │  ← Red border
│ Failed to connect to server │  ← Error detail
└─────────────────────────────┘
```
- Shows specific error message
- Can be manually closed or retry

---

## Features

✅ **Real-time Progress** - See exactly what stage upload is at  
✅ **Percentage Display** - Know how much is complete  
✅ **Smooth Animations** - Progress bar animates smoothly  
✅ **Auto-dismiss** - Success messages disappear automatically  
✅ **Manual Control** - Close button to dismiss anytime  
✅ **Dark Mode** - Adapts to light/dark theme  
✅ **Non-blocking** - Doesn't interfere with other actions  

---

## Troubleshooting

### Upload Stuck?
- Check your internet connection
- Verify image is under 5MB
- Try refreshing the page

### Error Message?
- Read the specific error shown in the toast
- Common issues:
  - Image too large (max 5MB)
  - Missing required fields
  - Server connection issue

### Can't See Progress Toast?
- Check bottom-right corner of screen
- It's below other content
- Click the X button if it's covering something
- Try uploading again

---

## Tips & Tricks

💡 **Best Image Size:** 800x600px or larger for best quality  
💡 **File Format:** Use PNG for transparency, JPG for photos  
💡 **Title Length:** Keep under 50 characters for better display  
💡 **Description:** 2-3 sentences works best  
💡 **Links:** Full URL with https://  

---

**Version:** 1.0  
**Last Updated:** January 7, 2026  
**Status:** ✅ Fully Functional
