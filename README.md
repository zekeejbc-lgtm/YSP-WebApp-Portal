# YSP Tagum WebApp Portal

Youth Service Philippines - Tagum Chapter Web Application Portal

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🌐 Deployment on Vercel

### Option 1: Deploy via Vercel Dashboard
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository: `zekeejbc-lgtm/YSP-WebApp-Portal`
4. Configure environment variables (see below)
5. Click "Deploy"

### Option 2: Deploy via Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Environment Variables

Add these environment variables in Vercel Dashboard → Settings → Environment Variables:

| Variable | Description |
|----------|-------------|
| `VITE_GAS_HOMEPAGE_API_URL` | Google Apps Script Homepage API URL |

## 📊 Google Apps Script Backend

This project uses Google Apps Script with Google Sheets as a backend.

### Sheets Structure

- **Homepage_Main**: Homepage content (headings, about, mission, vision, etc.)

See [gas-backend/README.md](gas-backend/README.md) for detailed setup instructions.

## 🔐 Demo Accounts

| Username | Password | Role | Access Level |
|----------|----------|------|--------------|
| `auditor` | `demo123` | Auditor | Full system access |
| `admin` | `demo123` | Admin | Management access |
| `head` | `demo123` | Head | Leadership access |
| `member` | `demo123` | Member | Standard access |

## 📁 Project Structure

```
├── src/
│   ├── components/      # React components
│   ├── services/        # API services (GAS integration)
│   ├── utils/           # Utility functions
│   └── styles/          # Global styles
├── gas-backend/         # Google Apps Script files
├── vercel.json          # Vercel configuration
└── vite.config.ts       # Vite configuration
```

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI, shadcn/ui
- **Backend**: Google Apps Script + Google Sheets
- **Hosting**: Vercel

## 📝 License

Private - All rights reserved