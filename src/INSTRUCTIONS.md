# YSP Tagum Chapter - Complete Technical Instructions

## 📋 Table of Contents
1. [Design System](#design-system)
2. [Color Palette](#color-palette)
3. [Typography System](#typography-system)
4. [Layout System](#layout-system)
5. [Animation System](#animation-system)
6. [Component Architecture](#component-architecture)
7. [Page Breakdown](#page-breakdown)
8. [State Management](#state-management)
9. [User Flows](#user-flows)
10. [Admin Flows](#admin-flows)
11. [Utility Functions](#utility-functions)
12. [Styling Patterns](#styling-patterns)

---

## 🎨 Design System

### Core Design Philosophy
- **Glassmorphism Design**: Transparent cards with backdrop blur effects
- **Liquid Glass Effect**: Floating top bar with blur and transparency
- **Dark/Light Mode**: Full dual-theme support throughout the application
- **Responsive First**: Mobile-first approach with breakpoints at 640px, 768px, 1024px, 1280px

### Visual Hierarchy
1. **Primary Actions**: Orange gradient buttons (#f6421f → #ee8724)
2. **Secondary Actions**: Transparent with orange borders
3. **Text Hierarchy**: Bold headers (Lexend) → Regular body (Roboto)
4. **Spacing Scale**: 4px base unit (0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64)

---

## 🎨 Color Palette

### Brand Colors (YSP Identity)
```css
Primary Red:     #f6421f (rgb(246, 66, 31))
Secondary Orange: #ee8724 (rgb(238, 135, 36))
Accent Yellow:   #fbcb29 (rgb(251, 203, 41))
```

### Dark Mode Colors
```css
Background Primary:   #0f172a (slate-900)
Background Secondary: #1e293b (slate-800)
Surface:             rgba(30, 41, 59, 0.95)
Text Primary:        #ffffff
Text Secondary:      #d1d5db (gray-300)
Text Tertiary:       #9ca3af (gray-400)
Border:              rgba(238, 135, 36, 0.2)
Hover Surface:       rgba(238, 135, 36, 0.15)
```

### Light Mode Colors
```css
Background Primary:   #f8fafc (slate-50)
Background Secondary: #ffffff
Surface:             rgba(255, 255, 255, 0.95)
Text Primary:        #1e293b (slate-800)
Text Secondary:      #475569 (slate-600)
Text Tertiary:       #64748b (slate-500)
Border:              rgba(238, 135, 36, 0.3)
Hover Surface:       rgba(238, 135, 36, 0.1)
```

### Gradient Combinations
```css
Primary Gradient:    linear-gradient(135deg, #f6421f 0%, #ee8724 100%)
Hero Gradient:       linear-gradient(135deg, rgba(246, 66, 31, 0.15) 0%, rgba(238, 135, 36, 0.15) 50%, rgba(251, 203, 41, 0.15) 100%)
Card Gradient Dark:  linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)
Card Gradient Light: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.98) 100%)
Progress Bar:        linear-gradient(90deg, #f6421f 0%, #ee8724 50%, #fbcb29 100%)
```

### Semantic Colors
```css
Success:   #10b981 (green-500)
Error:     #ef4444 (red-500)
Warning:   #f59e0b (amber-500)
Info:      #3b82f6 (blue-500)
```

### Shadow System
```css
Dark Mode Shadow:    0 8px 24px rgba(0, 0, 0, 0.4)
Light Mode Shadow:   0 8px 24px rgba(0, 0, 0, 0.1)
Button Shadow:       0 4px 12px rgba(246, 66, 31, 0.4)
Hover Shadow:        0 12px 32px rgba(0, 0, 0, 0.5)
```

---

## ✍️ Typography System

### Font Families
```css
--font-headings: 'Lexend', system-ui, -apple-system, sans-serif;
--font-body: 'Roboto', system-ui, -apple-system, sans-serif;
```

### Font Weights
```css
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

### Type Scale
```css
H1 (Hero):       clamp(2.5rem, 5vw, 4rem)    - 40-64px
H2 (Section):    clamp(1.75rem, 4vw, 2.5rem) - 28-40px
H3 (Card Title): clamp(1.25rem, 3vw, 1.5rem) - 20-24px
H4 (Subtitle):   1.25rem                      - 20px
Body Large:      1rem (16px)
Body Regular:    0.875rem (14px)
Body Small:      0.75rem (12px)
Caption:         0.625rem (10px)
```

### Typography Rules
- **Headings**: Always use Lexend font with fontWeight 700 (bold)
- **Body Text**: Use Roboto with fontWeight 400 (normal) or 500 (medium)
- **Letter Spacing**: Use `-0.02em` for large headings
- **Line Height**: 1.5 for body, 1.2 for headings
- **NO Tailwind Font Classes**: Don't use `text-2xl`, `font-bold`, `leading-none` unless specifically changing typography

---

## 📐 Layout System

### Container Widths
```css
max-w-7xl:  1280px (Main content)
max-w-5xl:  1024px (Forms, feedback)
max-w-4xl:  896px  (Narrow content)
max-w-2xl:  672px  (Text content)
```

### Padding System
```css
Mobile:  px-4 sm:px-6    (16px / 24px)
Desktop: px-6 lg:px-8    (24px / 32px)
Vertical: py-8 sm:py-12  (32px / 48px)
```

### Grid System
```css
1 Column:  grid-cols-1                    (Mobile)
2 Columns: md:grid-cols-2                 (Tablet+)
3 Columns: lg:grid-cols-3                 (Desktop)
4 Columns: xl:grid-cols-4                 (Wide screens)

Gap: gap-4 (16px), gap-6 (24px), gap-8 (32px)
```

### Border Radius Scale
```css
sm:  0.375rem (6px)   - Small elements
md:  0.5rem (8px)     - Default
lg:  0.75rem (12px)   - Cards
xl:  1rem (16px)      - Large cards
2xl: 1.5rem (24px)    - Hero sections
3xl: 2rem (32px)      - Extra large cards
full: 9999px          - Pills, badges
```

---

## 🎬 Animation System

### Transition Durations
```css
Fast:     150ms  - Hovers, small state changes
Default:  300ms  - Most interactions
Slow:     500ms  - Page transitions, large movements
```

### Easing Functions
```css
ease-in:     cubic-bezier(0.4, 0, 1, 1)
ease-out:    cubic-bezier(0, 0, 0.2, 1)
ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)
```

### Standard Animations

#### Hover Scale
```css
.hover-scale {
  transition: transform 300ms ease-in-out;
}
.hover-scale:hover {
  transform: scale(1.05);
}
```

#### Active Press
```css
.active-press:active {
  transform: scale(0.95);
}
```

#### Fade In Up
```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

#### Liquid Motion (Top Bar)
```css
@keyframes liquid {
  0%, 100% {
    border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
  }
  50% {
    border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%;
  }
}
```

#### Pulse Glow
```css
@keyframes pulse-glow {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 10px rgba(238, 135, 36, 0.5);
  }
  50% {
    opacity: 0.8;
    box-shadow: 0 0 20px rgba(238, 135, 36, 0.8);
  }
}
```

#### Progress Bar Fill
```css
.progress-fill {
  transition: width 500ms ease-out;
}
```

### Interactive States
```css
/* Button States */
Default → Hover (scale: 1.05, shadow increase)
Hover → Active (scale: 0.95)
Active → Default (300ms transition)

/* Card States */
Default → Hover (scale: 1.02, shadow increase)
Hover → Default (300ms transition)

/* Input Focus */
Default → Focus (border color change, glow)
Focus → Default (300ms transition)
```

---

## 🏗️ Component Architecture

### App.tsx (Main Component)

#### State Management
```typescript
const [isDark, setIsDark] = useState(false);              // Theme toggle
const [isMenuOpen, setIsMenuOpen] = useState(false);      // Mobile menu
const [modalProject, setModalProject] = useState<Project | null>(null);
const [isAdmin, setIsAdmin] = useState(false);            // Admin status
const [logoError, setLogoError] = useState(false);        // Logo fallback
const [showDonationPage, setShowDonationPage] = useState(false);
const [showLoginPanel, setShowLoginPanel] = useState(false);
const [showTabangTaBaiPage, setShowTabangTaBaiPage] = useState(false);
const [showFeedbackPage, setShowFeedbackPage] = useState(false);
const [donations, setDonations] = useState<Donation[]>([...]); // Mock data
```

#### Navigation Structure
```
Header (Sticky)
├── Logo + Brand
├── Navigation Links (Desktop)
├── Action Buttons (Login, Donate)
└── Mobile Menu Toggle

Sidebar (Mobile)
├── Close Button
├── Navigation Links
└── Dark Mode Toggle

Main Content
├── Hero Section
├── About Us
├── Mission & Vision
├── Advocacy Pillars
├── Projects
├── Organizational Chart
├── Get in Touch
└── Footer
```

---

## 📄 Page Breakdown

### 1. Homepage (App.tsx)

#### Hero Section
```typescript
Layout: Full width, centered content
Height: 90vh minimum
Background: Gradient overlay on pattern
Elements:
  - Main heading: clamp(2.5rem, 5vw, 4rem)
  - Subheading: 1rem
  - CTA Buttons: "Log In" (orange gradient) + "Be a Member!" (outlined)
Animation: Fade in up on load
```

#### About Us Section
```typescript
Layout: max-w-4xl centered
Background: Glassmorphism card
Content:
  - Section title (H2)
  - Paragraph text (body-large)
  - Stats cards (3 columns on desktop)
Hover: Card subtle lift (scale: 1.02)
```

#### Mission & Vision Section
```typescript
Layout: 2-column grid (stacks on mobile)
Cards: Glassmorphism with icon
Icons: Target (Mission), Eye (Vision)
Animation: Stagger fade in on scroll
```

#### Advocacy Pillars Section
```typescript
Layout: 3-column grid → 1 column mobile
Cards: 
  - Image top (rounded-xl overflow)
  - Title + description
  - Gradient border on hover
Icons: Heart, Users, Lightbulb, GraduationCap, etc.
Hover: Scale 1.05 + shadow increase
```

#### Projects Section
```typescript
Layout: Masonry grid (3-2-1 columns)
Cards:
  - Project thumbnail
  - Title overlay with gradient
  - Click → Modal with full details
Modal:
  - Large image
  - Title, description, date
  - Working links (underlined, orange)
  - Close button (X icon)
Animation: Modal fade in + scale from 0.95
```

#### Organizational Chart
```typescript
Layout: Hierarchical tree
Founder Card:
  - Photo (circular, 120px)
  - Name: "Juanquine Carlo R. Castro"
  - Alias: "a.k.a Wacky Racho"
  - Role: Founder
  - Special styling: Orange gradient border
Team Cards:
  - Grid layout below founder
  - Photo + Name + Role
  - Glassmorphism cards
```

#### Get in Touch Section
```typescript
Layout: Centered content
Elements:
  - Heading + description
  - "Partner with Us" button
  - Links to Google Form
Contact Info:
  - Email, Phone, Location
  - Social media icons
Background: Gradient card
```

---

### 2. Tabang Ta Bai Page (TabangTaBaiPage.tsx)

#### Header
```typescript
Position: sticky top-0, z-50
Background: rgba(15, 23, 42, 0.95) dark / rgba(255, 255, 255, 0.95) light
Blur: backdrop-filter: blur(20px)
Elements:
  - Back button (left)
  - Logo + Title (center)
  - Empty spacer (right, for balance)
Border: Bottom border with orange tint
```

#### Logo Styling
```typescript
Logo Properties:
  - Size: w-12 h-12 sm:w-14 sm:h-14
  - object-contain
  - background: transparent
  - mixBlendMode: isDark ? 'normal' : 'multiply'
  - filter: isDark ? 'brightness(1.1)' : 'none'
Purpose: Makes logo blend naturally without white box background
```

#### Hero Section
```typescript
Layout: Full width with padding
Background: Gradient overlay (red → orange → yellow, 15% opacity)
Icon: Heart (w-16 h-16)
Content:
  - "Together, We Make a Difference"
  - Description text
  - "Tabang ta bai" tagline (orange accent)
Pattern: Radial gradient circles in background
```

#### Campaign Cards
```typescript
Layout: Grid 3-2-1 columns
Structure:
  Campaign Image (h-48)
    └── Goal Badge (top-right corner)
  
  Card Content (p-5)
    ├── Title (H3)
    ├── Description (line-clamp-3)
    ├── Progress Bar
    │   ├── Progress % (top-right)
    │   ├── Filled bar (gradient)
    │   └── Current / Goal amounts
    ├── Stats (2 columns)
    │   ├── Donors count
    │   └── Funded percentage
    └── Action Buttons
        ├── "Donate Now" (gradient, primary)
        └── "View Details" (outlined, secondary)

Progress Bar Animation:
  - Width transition: 500ms ease-out
  - Glow effect: 0 0 10px rgba(238, 135, 36, 0.5)
  
Card Hover:
  - transform: scale(1.05)
  - transition: 300ms
  - shadow increase
```

#### Donation Modal
```typescript
Trigger: Click "Donate Now" button
Layout: Fixed overlay, centered modal
Background: Dark overlay (rgba(0, 0, 0, 0.7))

Modal Structure:
  Header
    ├── Campaign title
    └── Close button
  
  Payment Methods (Tabs)
    ├── GCash Tab
    ├── Maya Tab
    └── GoTyme Tab
  
  QR Code Display
    ├── QR Code image (200x200)
    ├── Account number
    └── Copy button
  
  Donation Form
    ├── Name input (required)
    ├── Email input (required)
    ├── Amount input (required, number)
    ├── Receipt upload (required)
    │   └── Image preview after upload
    └── Submit button

Validation:
  - All fields required
  - Amount > 0
  - Email format validation
  - Receipt image required

Success Flow:
  1. Show success toast
  2. Add to donations list (status: pending)
  3. Close modal
  4. Reset form
```

#### Copy to Clipboard Function
```typescript
Location: components/utils/clipboard.ts

Function: copyToClipboard(text: string): Promise<boolean>

Implementation:
  1. Try navigator.clipboard.writeText() (modern browsers)
  2. If fails, fallback to document.execCommand('copy')
  3. Create temporary textarea, select, copy, remove
  4. Return success boolean

Usage in component:
  const success = await copyToClipboard(accountNumber);
  if (success) {
    setCopiedQR(paymentMethod);
    toast.success('Copied!');
    setTimeout(() => setCopiedQR(null), 2000);
  }

Visual Feedback:
  - Icon changes: Copy → Check (2 seconds)
  - Green checkmark animation
  - Toast notification
```

#### Social Sharing
```typescript
Share Buttons:
  - Facebook
  - Messenger  
  - Instagram

Share Data:
  title: campaign.title
  text: campaign.description
  url: window.location.href

Implementation:
  if (navigator.share) {
    // Use Web Share API
    await navigator.share({ title, text, url });
  } else {
    // Fallback to opening social media share URLs
    window.open(shareUrl, '_blank');
  }

Share URLs:
  Facebook:  https://www.facebook.com/sharer/sharer.php?u={url}
  Messenger: https://www.facebook.com/dialog/send?link={url}
  Instagram: Copy link + toast message
```

#### Admin Dashboard (isAdmin = true)
```typescript
Additional Features:
  - Donation status badges
  - Action buttons per donation
  
Donation Card (Admin View):
  ├── Donor info (name, email, amount)
  ├── Receipt thumbnail (clickable → full view)
  ├── Status badge (pending/acknowledged/invalid/rejected)
  └── Action buttons
      ├── Acknowledge (green) → status: 'acknowledged'
      ├── Mark Invalid (yellow) → status: 'invalid'
      └── Reject (red) → status: 'rejected'

Status Color Coding:
  pending:      orange (#ee8724)
  acknowledged: green (#10b981)
  invalid:      yellow (#f59e0b)
  rejected:     red (#ef4444)

Admin Actions:
  handleAcknowledge(donationId, campaignId):
    1. Update donation status to 'acknowledged'
    2. Add amount to campaign.currentAmount
    3. Add to donor history
    4. Send thank you email (console.log)
    5. Show success toast
  
  handleInvalid(donationId):
    1. Update status to 'invalid'
    2. Request more proof (console.log email)
    3. Show warning toast
  
  handleReject(donationId, reason):
    1. Update status to 'rejected'
    2. Add rejection reason
    3. Send refund notification (console.log)
    4. Show error toast
```

#### Donor History Section
```typescript
Display: Only shows acknowledged donations
Layout: Card list with avatar placeholders
Card Structure:
  ├── Avatar circle (gradient background)
  ├── Donor name
  ├── Amount (₱{amount})
  └── Date

Empty State:
  - "No donors yet" message
  - Heart icon
  - Encouraging text

Animation:
  - Fade in when donations acknowledged
  - Stagger animation for multiple items
```

---

### 3. Feedback Page (FeedbackPage.tsx)

#### Header
```typescript
Same structure as Tabang Ta Bai header
Icon: MessageSquare
Title: "Feedback Center"
Subtitle: "We value your input"
```

#### Hero Section
```typescript
Icon: ThumbsUp (w-16 h-16)
Title: "Your Voice Matters"
Description: Help us improve message

Stats Display (if feedbacks exist):
  ├── Average Rating (large number)
  └── Total Feedback count

Background: Same gradient pattern as Tabang Ta Bai
```

#### Feedback Form
```typescript
Layout: 2-column grid (form left, feedbacks right)

Form Fields:
  1. Name Input
     - Type: text
     - Required: yes
     - Placeholder: "Enter your name"
  
  2. Email Input
     - Type: email
     - Required: yes
     - Placeholder: "your.email@example.com"
  
  3. Rating (Star System)
     - Interactive stars (1-5)
     - Hover effect: fills stars
     - Click: sets rating
     - Required: yes
     
  4. Category Select
     - Options: General, Website, Event, Suggestions, Complaint, Other
     - Default: General
     - Styled dropdown
  
  5. Message Textarea
     - Rows: 4
     - Required: yes
     - Placeholder: "Share your thoughts..."
  
  6. Submit Button
     - Gradient background
     - Disabled if form incomplete
     - Loading state during submit

Star Rating Component:
  State: rating (0-5)
  Hover State: hoverRating (0-5)
  
  Render Logic:
    for (i = 1; i <= 5; i++) {
      filled = i <= (hoverRating || rating)
      render <Star fill={filled ? 'orange' : 'none'} />
    }
  
  Events:
    onMouseEnter: setHoverRating(i)
    onMouseLeave: setHoverRating(0)
    onClick: setRating(i)
```

#### Feedback Display
```typescript
Layout: Scrollable list
Sort: Newest first

Feedback Card:
  Header
    ├── Name (bold)
    ├── Date (gray, small)
    └── Category badge
  
  Rating Display
    └── 5 stars (filled based on rating)
  
  Message
    └── Feedback text
  
  Status Badge (bottom)
    └── Pending / Reviewed / Resolved

Color Coding:
  pending:  orange
  reviewed: blue
  resolved: green

Admin Actions (if isAdmin):
  - Change Status dropdown
  - Update button
  - Email indicator
```

#### Admin Features
```typescript
Status Management:
  updateFeedbackStatus(id, status):
    - Update feedback status
    - Show toast confirmation
    - Visual update immediate

Filter Options:
  - All
  - Pending only
  - Reviewed only
  - Resolved only

Feedback Stats:
  - Total count
  - Average rating
  - Status breakdown
  - Recent trends
```

---

### 4. Donation Page (DonationPage.tsx)

#### Layout
```typescript
Structure: Full page overlay
Background: Blurred dark overlay
Container: Centered card with glassmorphism

Header:
  ├── Title: "Support Our Mission"
  ├── Subtitle: Donation message
  └── Close button (X)

Content Sections:
  1. Payment Method Selection
     └── Tabs: GCash / Maya / GoTyme
  
  2. QR Code Display
     ├── Large QR image
     ├── Account number
     └── Copy button
  
  3. Donation Form
     ├── Name
     ├── Email
     ├── Amount
     ├── Receipt upload
     └── Submit
  
  4. Donation History (if isAdmin)
     └── List of all donations with actions
```

#### Donation Flow
```typescript
User Journey:
  1. Click "Donate" button (header or CTA)
  2. Page overlays appear
  3. Select payment method
  4. View QR code
  5. Copy account number
  6. Make payment externally
  7. Fill form
  8. Upload receipt
  9. Submit
  10. See success message
  11. (Admin) Verify and acknowledge

Admin Verification:
  1. View pending donations
  2. Click to view receipt
  3. Verify payment
  4. Acknowledge → adds to total
  5. Or reject → sends refund notice
```

---

### 5. Login Panel (LoginPanel.tsx)

#### Design
```typescript
Position: Fixed bottom-right
Size: 400px × auto (mobile: full width)
Background: Glassmorphism
Blur: backdrop-filter: blur(20px)
Animation: Slide in from right

Structure:
  Header
    ├── Lock icon
    ├── "Admin Login" title
    └── Close button
  
  Form
    ├── Username input
    │   └── User icon prefix
    ├── Password input
    │   └── Lock icon prefix
    │   └── Eye toggle (show/hide)
    └── Login button
  
  Footer
    └── Demo credentials hint
```

#### Authentication Logic
```typescript
Demo Credentials:
  username: "admin"
  password: "admin123"

handleLogin():
  1. Check credentials
  2. If valid:
     - setIsAdmin(true)
     - Close panel
     - Show success toast
     - Unlock admin features
  3. If invalid:
     - Show error toast
     - Clear password field
     - Shake animation

Security Note:
  - This is demo only
  - Production needs real auth (JWT, OAuth, etc.)
  - Never hardcode credentials
  - Use environment variables
```

#### Admin Features Unlocked
```typescript
When isAdmin = true:
  - Donation management buttons appear
  - Feedback status controls appear
  - Campaign admin panel visible
  - Extra statistics visible
  - Delete/Edit options appear
```

---

## 🔄 State Management

### Global State (App.tsx)
```typescript
Theme State:
  isDark: boolean
  - Persists across page navigation
  - Affects all child components
  - Toggleable via button in header/sidebar

Navigation State:
  isMenuOpen: boolean
  - Controls mobile sidebar
  - Auto-closes on route change
  - Closes on overlay click

Admin State:
  isAdmin: boolean
  - Controls admin feature visibility
  - Set by login success
  - Resets on logout

Page State:
  showDonationPage: boolean
  showTabangTaBaiPage: boolean
  showFeedbackPage: boolean
  showLoginPanel: boolean
  - One page active at a time
  - Overlay prevents body scroll

Modal State:
  modalProject: Project | null
  - Stores selected project
  - null = modal closed
  - Project object = modal open
```

### Component-Level State

#### TabangTaBaiPage State
```typescript
selectedCampaign: Campaign | null
  - Stores campaign for donation
  - Used in modal

showDonationForm: boolean
  - Controls modal visibility

receiptImage: string | null
  - Base64 encoded image
  - Preview in form

donorName: string
donorEmail: string
donationAmount: string
  - Form field values

copiedQR: string | null
  - Tracks which QR was copied
  - Auto-resets after 2s

campaigns: Campaign[]
  - Array of all campaigns
  - Mock data (replace with API)

donations: CampaignDonation[]
  - All donation records
  - Filtered by campaign for display
```

#### FeedbackPage State
```typescript
name: string
email: string
rating: number (0-5)
category: string
message: string
  - Form field values

feedbacks: Feedback[]
  - All feedback records
  - Sorted by date (newest first)

hoverRating: number (0-5)
  - Temporary state for star hover
```

#### DonationPage State
```typescript
Similar to TabangTaBaiPage
Plus:
  donationHistory: Donation[]
    - Global donations (all campaigns)
```

---

## 👤 User Flows

### Flow 1: Browse and Donate to Campaign
```
1. User lands on homepage
2. Scrolls to Projects or clicks "Tabang ta Bai" in nav
3. Sees campaign cards with progress bars
4. Clicks "Donate Now" on desired campaign
5. Modal opens with payment options
6. Selects payment method (GCash/Maya/GoTyme)
7. Views QR code
8. Clicks "Copy" on account number
9. Opens banking app (external)
10. Scans QR or enters account number
11. Makes payment
12. Takes screenshot of receipt
13. Returns to website
14. Fills donation form
15. Uploads receipt screenshot
16. Clicks "Submit Donation"
17. Sees success message
18. Donation appears as "Pending"
19. (Wait for admin approval)
20. Once approved, appears in donor history
```

### Flow 2: Submit Feedback
```
1. User clicks "Feedback" in navigation
2. Feedback page loads
3. User sees feedback form
4. Fills in name and email
5. Selects rating (clicks stars)
6. Chooses category from dropdown
7. Types message
8. Clicks "Submit Feedback"
9. Success toast appears
10. Form resets
11. Feedback appears in list (Pending status)
12. User can browse other feedbacks
13. Admin reviews and updates status later
```

### Flow 3: View Project Details
```
1. User scrolls to Projects section
2. Sees project grid with thumbnails
3. Hovers over project (card lifts)
4. Clicks on project card
5. Modal opens with full details
6. Views large image, description, date
7. Clicks on working links if interested
8. Links open in new tabs
9. Closes modal with X button
10. Modal fades out
11. Returns to projects grid
```

### Flow 4: Partner with Organization
```
1. User scrolls to "Get in Touch" section
2. Reads partnership information
3. Clicks "Partner with Us" button
4. Google Form opens in new tab
5. User fills partnership form (external)
6. Submits form
7. Organization receives notification
8. Follow-up via email
```

### Flow 5: Dark Mode Toggle
```
1. User sees sun/moon icon in header
2. Clicks toggle button
3. isDark state flips
4. All components re-render with new theme
5. Background changes (smooth transition)
6. Text colors invert
7. Card backgrounds adjust
8. Shadows adjust
9. Border colors change
10. Icons update colors
11. (Theme persists during session)
```

---

## 👨‍💼 Admin Flows

### Flow 1: Admin Login
```
1. Admin clicks "Log In" button in header
2. Login panel slides in from right
3. Enters username: "admin"
4. Enters password: "admin123"
5. Clicks "Login" button
6. Credentials validated
7. Success toast appears
8. Panel closes
9. isAdmin = true
10. Admin features now visible throughout app
```

### Flow 2: Acknowledge Donation
```
1. Admin navigates to Tabang Ta Bai page
2. Sees campaign cards
3. Clicks "View Details" on campaign
4. Scrolls to admin section (visible because isAdmin = true)
5. Sees pending donations list
6. Reviews donation details:
   - Donor name
   - Amount
   - Date submitted
7. Clicks receipt thumbnail to view full size
8. Verifies payment in bank account (external)
9. Payment confirmed valid
10. Clicks "Acknowledge" button (green)
11. Confirmation toast appears
12. Donation status → "acknowledged"
13. Amount added to campaign.currentAmount
14. Progress bar updates automatically
15. Donor added to donor history
16. Thank you email sent (console.log)
17. Card color changes to green
```

### Flow 3: Reject Invalid Donation
```
1. Admin reviews donation
2. Clicks receipt to enlarge
3. Notices receipt is:
   - Unclear/blurry
   - Wrong amount
   - Duplicate
   - Photoshopped
   - Wrong account
4. Clicks "Reject" button (red)
5. Rejection reason modal appears
6. Admin types reason: "Unclear receipt, please resubmit"
7. Clicks "Confirm Rejection"
8. Donation status → "rejected"
9. Rejection reason stored
10. Refund notification email sent (console.log)
11. User notified via email
12. Card color changes to red
13. Admin can add notes for follow-up
```

### Flow 4: Mark Donation as Invalid (Needs Review)
```
1. Admin reviews donation
2. Receipt seems questionable but not clearly fake
3. Clicks "Mark as Invalid" button (yellow)
4. Status → "invalid"
5. Email sent requesting more proof
6. User receives email: "Please provide additional proof"
7. User resubmits with better proof
8. Admin re-reviews
9. Either acknowledges or rejects
```

### Flow 5: Manage Feedback
```
1. Admin navigates to Feedback page
2. Sees all feedback submissions
3. Filters by status (Pending/Reviewed/Resolved)
4. Clicks on feedback to expand
5. Reads feedback details
6. Assesses the feedback
7. Changes status dropdown:
   - Pending → Reviewed (read and noted)
   - Reviewed → Resolved (action taken)
8. Clicks "Update Status"
9. Status changes immediately
10. Badge color updates
11. If email provided, sends confirmation
12. Can respond to user via email (external)
```

### Flow 6: Monitor Campaign Progress
```
1. Admin views Tabang Ta Bai page
2. Sees all active campaigns
3. Reviews metrics:
   - Current amount raised
   - Goal amount
   - Progress percentage
   - Number of donors
   - Pending donations count
4. Analyzes performance
5. Makes decisions:
   - Extend campaign if close to goal
   - Promote underperforming campaigns
   - Thank high contributors
6. Updates campaign details (future feature)
```

---

## 🛠️ Utility Functions

### Clipboard Utility (components/utils/clipboard.ts)
```typescript
export async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern Clipboard API first
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('Clipboard API failed, trying fallback:', err);
    }
  }
  
  // Fallback for older browsers or restricted contexts
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    textArea.remove();
    
    return successful;
  } catch (err) {
    console.error('Fallback copy failed:', err);
    return false;
  }
}

Usage:
  const success = await copyToClipboard('09123456789');
  if (success) {
    toast.success('Copied to clipboard!');
  } else {
    toast.error('Failed to copy');
  }
```

### Image Upload Handler
```typescript
const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    toast.error('Please upload an image file');
    return;
  }
  
  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    toast.error('Image too large (max 5MB)');
    return;
  }
  
  // Read as base64
  const reader = new FileReader();
  reader.onloadend = () => {
    setReceiptImage(reader.result as string);
  };
  reader.readAsDataURL(file);
};
```

### Progress Calculator
```typescript
const getProgress = (campaign: Campaign): number => {
  return (campaign.currentAmount / campaign.goalAmount) * 100;
};

// Ensure doesn't exceed 100%
const clampedProgress = Math.min(getProgress(campaign), 100);
```

### Date Formatter
```typescript
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
};

// Output: "November 9, 2025"
```

### Currency Formatter
```typescript
const formatCurrency = (amount: number): string => {
  return `₱${amount.toLocaleString('en-PH')}`;
};

// Output: "₱1,500"
```

### Email Validator
```typescript
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
```

---

## 🎨 Styling Patterns

### Glassmorphism Card Pattern
```css
.glass-card {
  background: linear-gradient(
    135deg,
    rgba(30, 41, 59, 0.95) 0%,
    rgba(15, 23, 42, 0.98) 100%
  );
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 2px solid rgba(238, 135, 36, 0.2);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  border-radius: 1.5rem;
}
```

### Button Variants

#### Primary Button (Gradient)
```css
.btn-primary {
  background: linear-gradient(135deg, #f6421f 0%, #ee8724 100%);
  color: white;
  font-weight: 700;
  padding: 0.75rem 1.5rem;
  border-radius: 0.75rem;
  box-shadow: 0 4px 12px rgba(246, 66, 31, 0.4);
  transition: all 300ms ease;
}

.btn-primary:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(246, 66, 31, 0.6);
}

.btn-primary:active {
  transform: scale(0.95);
}
```

#### Secondary Button (Outlined)
```css
.btn-secondary {
  background: rgba(238, 135, 36, 0.15);
  border: 2px solid rgba(238, 135, 36, 0.3);
  color: #ee8724;
  font-weight: 600;
  padding: 0.75rem 1.5rem;
  border-radius: 0.75rem;
  transition: all 300ms ease;
}

.btn-secondary:hover {
  background: rgba(238, 135, 36, 0.25);
  border-color: rgba(238, 135, 36, 0.5);
  transform: scale(1.05);
}
```

### Input Styling
```css
.input-field {
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(238, 135, 36, 0.3);
  color: white;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  transition: all 300ms ease;
}

.input-field:focus {
  outline: none;
  border-color: #ee8724;
  box-shadow: 0 0 0 3px rgba(238, 135, 36, 0.1);
}

.input-field::placeholder {
  color: rgba(255, 255, 255, 0.5);
}
```

### Status Badge Pattern
```css
.badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.badge-pending {
  background: rgba(238, 135, 36, 0.2);
  color: #ee8724;
  border: 1px solid rgba(238, 135, 36, 0.3);
}

.badge-success {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.badge-error {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}
```

### Card Hover Effect
```css
.card-hover {
  transition: all 300ms ease;
  cursor: pointer;
}

.card-hover:hover {
  transform: scale(1.05);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
}
```

---

## 📱 Responsive Breakpoints

### Tailwind Breakpoints
```css
sm:  640px   - Small tablets
md:  768px   - Tablets
lg:  1024px  - Small desktops
xl:  1280px  - Desktops
2xl: 1536px  - Large desktops
```

### Responsive Patterns

#### Navigation
```
Mobile (< 768px):
  - Hamburger menu
  - Sidebar drawer
  - Stacked buttons

Desktop (>= 768px):
  - Horizontal nav
  - Inline buttons
  - Full header
```

#### Grid Layouts
```
Projects:
  mobile: 1 column
  tablet: 2 columns (md:)
  desktop: 3 columns (lg:)

Campaigns:
  mobile: 1 column
  tablet: 2 columns (md:)
  desktop: 3 columns (lg:)

Stats:
  mobile: 1 column
  tablet: 2 columns (sm:)
  desktop: 4 columns (lg:)
```

#### Typography
```
H1: clamp(2.5rem, 5vw, 4rem)    - Scales with viewport
H2: clamp(1.75rem, 4vw, 2.5rem)
H3: clamp(1.25rem, 3vw, 1.5rem)
```

#### Spacing
```
Container padding:
  mobile: px-4 (16px)
  tablet: sm:px-6 (24px)
  desktop: lg:px-8 (32px)

Section spacing:
  mobile: py-8 (32px)
  tablet: sm:py-12 (48px)
  desktop: lg:py-16 (64px)
```

---

## 🔔 Toast Notifications

### Toast Library: Sonner

#### Import
```typescript
import { toast } from 'sonner@2.0.3';
```

#### Usage Patterns

#### Success Toast
```typescript
toast.success('Donation submitted!', {
  description: 'Thank you for your generosity. We will review your donation shortly.',
  duration: 4000
});
```

#### Error Toast
```typescript
toast.error('Login failed', {
  description: 'Invalid username or password. Please try again.',
  duration: 4000
});
```

#### Info Toast
```typescript
toast.info('QR Code copied', {
  description: 'Account number copied to clipboard',
  duration: 2000
});
```

#### Warning Toast
```typescript
toast.warning('Invalid receipt', {
  description: 'Please upload a clearer image',
  duration: 4000
});
```

#### Loading Toast
```typescript
const toastId = toast.loading('Submitting...');
// ... async operation
toast.success('Success!', { id: toastId });
```

### Toast Placement
```typescript
Position: bottom-right (default)
Can be changed to: top-right, top-center, bottom-center, etc.
```

---

## 🎯 Best Practices

### Performance
1. Use `ImageWithFallback` for all images
2. Lazy load images below fold
3. Debounce search inputs
4. Throttle scroll events
5. Memoize expensive calculations
6. Use CSS transforms for animations (GPU accelerated)

### Accessibility
1. All buttons have `aria-label`
2. Form inputs have labels
3. Alt text for all images
4. Keyboard navigation supported
5. Focus visible states
6. Color contrast meets WCAG AA
7. Screen reader friendly

### Security
1. Never hardcode API keys
2. Validate all inputs
3. Sanitize user content
4. Use HTTPS in production
5. Implement rate limiting
6. Validate file uploads
7. Use environment variables

### Code Organization
1. One component per file
2. Group related functions
3. Use TypeScript interfaces
4. Comment complex logic
5. Extract reusable utilities
6. Keep components focused
7. Use meaningful names

---

## 🚀 Deployment Checklist

### Before Production
- [ ] Change admin credentials
- [ ] Set up real database
- [ ] Implement real authentication
- [ ] Connect email service
- [ ] Configure cloud storage for images
- [ ] Set up SSL certificate
- [ ] Add analytics
- [ ] Test all flows
- [ ] Optimize images
- [ ] Enable caching
- [ ] Set up error monitoring
- [ ] Create backup system
- [ ] Test on real devices
- [ ] Check accessibility
- [ ] Review security
- [ ] Add rate limiting
- [ ] Create admin documentation
- [ ] Train support staff

### Environment Variables Needed
```
VITE_API_URL=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SMTP_HOST=
VITE_SMTP_PORT=
VITE_SMTP_USER=
VITE_SMTP_PASS=
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_API_KEY=
VITE_GCASH_ACCOUNT=
VITE_MAYA_ACCOUNT=
VITE_GOTYME_ACCOUNT=
```

---

## 📝 Notes

### Mock Data Locations
```
App.tsx:
  - donations array (lines 61-100)
  - projects array (lines 101-150)

TabangTaBaiPage.tsx:
  - campaigns array (lines 49-100)
  - campaignDonations array (lines 101-130)

FeedbackPage.tsx:
  - feedbacks array (lines 50-90)
```

### Future Enhancements
1. Backend API integration
2. Real-time updates (WebSocket)
3. Push notifications
4. Mobile app version
5. Multi-language support
6. Advanced analytics dashboard
7. Automated email templates
8. SMS notifications
9. Social media integration
10. Payment gateway integration
11. Recurring donations
12. Donation certificates
13. Volunteer management
14. Event calendar
15. Member portal

---

## 🔗 External Integrations

### Google Forms
- Partner form: [Insert URL]
- Membership form: [Insert URL]

### Social Media
- Facebook: [Insert URL]
- Instagram: [Insert URL]
- Twitter: [Insert URL]

### Payment Providers
- GCash: Account [Insert Number]
- Maya: Account [Insert Number]
- GoTyme: Account [Insert Number]

---

## ⚙️ Technical Specifications

### Framework & Libraries
```json
{
  "react": "^18.x",
  "typescript": "^5.x",
  "tailwindcss": "^4.0",
  "lucide-react": "latest",
  "sonner": "^2.0.3",
  "react-hook-form": "^7.55.0"
}
```

### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Screen Support
- Mobile: 320px - 767px
- Tablet: 768px - 1023px
- Desktop: 1024px+

---

**Document Version:** 1.0  
**Last Updated:** November 9, 2025  
**Maintained by:** YSP Development Team
