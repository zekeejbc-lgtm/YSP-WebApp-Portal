# Youth Service Philippines - Tagum Chapter Web Application

A comprehensive web application for YSP Tagum Chapter featuring community campaigns, feedback system, and donation management.

## 🎨 Design System

### Brand Colors
- **Primary Red**: `#f6421f`
- **Secondary Orange**: `#ee8724`
- **Accent Yellow**: `#fbcb29`

### Typography
- **Headings**: Lexend (400, 500, 600, 700)
- **Body**: Roboto (400, 500, 700)

## 🚀 Features

### 1. **Main Website**
- Responsive homepage with hero section
- About Us, Mission, Vision sections
- Advocacy Pillars showcase
- Projects portfolio with modal details
- Organizational Chart featuring founder Juanquine Carlo R. Castro (Wacky Racho)
- Contact section with Google Forms integration
- Dark/Light mode support

### 2. **Tabang ta Bai Campaigns** 
A comprehensive donation campaign system featuring:
- **Campaign Cards** with progress tracking
- **Multiple Payment Methods**: GCash, Maya, GoTyme QR codes
- **Donation Form** with receipt upload
- **Admin Dashboard** for donation management:
  - Acknowledge → Sends thank you email + shows in donor history
  - Invalid Receipt → Requests more proof
  - Reject → Sends refund notification
- **Donor History** (only shows acknowledged donations)
- **Social Sharing** to Facebook, Messenger, Instagram
- Fully responsive design

### 3. **Feedback Center**
- 5-star rating system
- Category-based feedback (General, Website, Event, Suggestions, Complaint, Other)
- Admin review and status management
- Average rating and feedback statistics
- Email collection for follow-up

### 4. **Admin Panel**
- Secure login system
- Donation verification and management
- Feedback review and status updates
- Real-time dashboard

## 🔐 Admin Access

**Demo Credentials:**
- Username: `admin`
- Password: `admin123`

⚠️ **Important**: Change these credentials in production!

## 📱 Responsive Design

The application is fully responsive and optimized for:
- 📱 Mobile (320px - 768px)
- 📱 Tablet (768px - 1024px)
- 💻 Desktop (1024px+)

## 🎯 Tech Stack

- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS v4.0
- **Icons**: Lucide React
- **Notifications**: Sonner
- **Image Handling**: Custom ImageWithFallback component
- **Design Pattern**: Glassmorphism with liquid glass effects

## 🛠️ Key Components

### `/App.tsx`
Main application component with routing logic for all pages.

### `/components/TabangTaBaiPage.tsx`
Complete campaign management system with donation tracking.

### `/components/FeedbackPage.tsx`
Feedback collection and management interface.

### `/components/DonationPage.tsx`
General donation page (legacy - being replaced by Tabang ta Bai).

### `/components/LoginPanel.tsx`
Admin authentication panel with glassmorphism design.

### `/components/figma/ImageWithFallback.tsx`
Image component with automatic fallback handling.

### `/components/utils/clipboard.ts`
Cross-browser clipboard utility with fallback support.

## 🎨 Styling Notes

### Custom Classes
- `.ysp-card` - Glassmorphism card component
- Dark mode support via `.dark` class

### Important Rules
- **No font size/weight classes** unless specifically changing typography
- Use CSS custom properties for consistent theming
- Maintain glassmorphism effects with backdrop-filter
- Preserve all Tailwind utilities from Figma imports

## 📋 Features Implementation Status

✅ **Completed:**
- Homepage with all sections
- Tabang ta Bai campaigns system
- Feedback center
- Admin panel
- Dark/Light mode support
- Responsive design
- Clipboard functionality with fallback
- Social media sharing
- Email notifications (simulated)
- Receipt upload and verification
- Donor history tracking

## 🔄 Browser Compatibility

### Clipboard API
The app includes fallback support for the Clipboard API:
- Modern browsers: Uses `navigator.clipboard.writeText()`
- Legacy/Restricted contexts: Falls back to `document.execCommand('copy')`
- Works in sandboxed iframes and strict permission policies

## 📦 File Structure

```
├── App.tsx                          # Main application
├── components/
│   ├── TabangTaBaiPage.tsx         # Campaigns system
│   ├── FeedbackPage.tsx            # Feedback center
│   ├── DonationPage.tsx            # Donation page
│   ├── LoginPanel.tsx              # Admin login
│   ├── figma/
│   │   └── ImageWithFallback.tsx   # Image handler
│   └── utils/
│       └── clipboard.ts            # Clipboard utility
├── styles/
│   └── globals.css                 # Global styles + animations
└── public/                         # Static assets
```

## 🚀 Getting Started

1. **Clone the repository**
2. **Install dependencies** (if applicable)
3. **Run the application**
4. **Access admin panel** with demo credentials
5. **Customize** brand colors, content, and payment details

## 🔧 Customization Guide

### Update Payment QR Codes
Edit the `qrCodes` object in `/components/TabangTaBaiPage.tsx`:
```typescript
qrCodes: {
  gcash: 'your-qr-image-url',
  maya: 'your-qr-image-url',
  gotyme: 'your-qr-image-url'
}
```

### Update Account Numbers
Update the `copyToClipboard` function calls to use your real account numbers.

### Change Admin Credentials
Update the `handleLogin` function in `/App.tsx`:
```typescript
if (username === 'your-username' && password === 'your-password') {
  // ...
}
```

### Add Campaigns
Add new campaign objects to the `campaigns` state in `/components/TabangTaBaiPage.tsx`.

## 📧 Email Integration

Currently, emails are simulated via console.log. To integrate real email:
1. Set up a backend API (e.g., Node.js, Firebase Functions)
2. Use email service (SendGrid, AWS SES, etc.)
3. Replace `console.log` calls with API requests

## 🎯 Next Steps for Production

1. **Backend Integration**
   - Set up database (MongoDB, PostgreSQL, etc.)
   - Create API endpoints for CRUD operations
   - Implement real authentication (JWT, OAuth)

2. **Email Service**
   - Configure SMTP or email API
   - Set up email templates
   - Implement notification system

3. **File Upload**
   - Configure cloud storage (AWS S3, Cloudinary)
   - Implement secure file upload
   - Add file validation and scanning

4. **Security**
   - Change default admin credentials
   - Implement proper authentication
   - Add rate limiting
   - Set up HTTPS
   - Implement CSRF protection

5. **Analytics**
   - Add Google Analytics or similar
   - Track donation conversions
   - Monitor user engagement

## 📝 License

Copyright © 2025 Youth Service Philippines - Tagum Chapter. All rights reserved.

## 👥 Credits

- **Founder**: Juanquine Carlo R. Castro (Wacky Racho)
- **Development**: Custom web application built with React & Tailwind CSS
- **Design System**: YSP brand guidelines with glassmorphism effects

---

**Note**: This is a demo application. For production use, ensure proper backend integration, security measures, and compliance with data protection regulations.
