# Yard Inventory Report System

A comprehensive inventory management application for tracking yard stock levels with real-time Firebase integration.

## Features

- **Admin & Setup**: Manage yards, configure dealer types, set inventory thresholds
- **Data Entry**: Input weekly inventory data with real-time status updates
- **Analytics & Trends**: Visualize stock trends, generate reports, and critical alerts
- **Email Reports**: Automated weekly email reports with PDF attachments via EmailJS
- **PDF Export**: Generate and download comprehensive inventory reports

## Technology Stack

- **Frontend**: React.js, Tailwind CSS
- **Backend**: Firebase Realtime Database
- **Build Tool**: Vite
- **Email Service**: EmailJS
- **PDF Generation**: jsPDF, html2canvas

## Deployment on Render.com

### Method 1: Using render.yaml (Recommended)
1. Upload this project to your Git repository
2. Connect your repository to Render.com
3. Render will automatically detect the `render.yaml` file and deploy

### Method 2: Manual Setup
1. Create a new Web Service on Render.com
2. Connect your Git repository
3. Set the following build settings:
   - **Build Command**: `pnpm install && pnpm run build`
   - **Start Command**: `pnpm run start`
   - **Environment**: Node.js
   - **Node Version**: 18+

## Environment Variables

Set up the following environment variables in Render.com dashboard:

### Firebase Configuration
Add these to your environment variables or update `src/firebase/config.js`:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

## Local Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev

# Build for production
pnpm run build

# Preview production build
pnpm run preview
```

## EmailJS Setup

1. Create account at [emailjs.com](https://www.emailjs.com/)
2. Create an Email Service (Gmail recommended)
3. Create Email Template with variables: `to_email`, `report_date`, `pdf_attachment`
4. Configure in Admin Setup page with your Service ID, Template ID, and Public Key

## Firebase Setup

1. Create Firebase project at [firebase.google.com](https://firebase.google.com/)
2. Enable Realtime Database
3. Set up authentication (optional)
4. Update configuration in `src/firebase/config.js`

## Project Structure

```
src/
├── components/
│   ├── AdminSetup.jsx      # Yard management and email configuration
│   ├── Analytics.jsx       # Data visualization and reporting
│   ├── DataEntry.jsx       # Weekly inventory data input
│   └── Navigation.jsx      # App navigation
├── firebase/
│   ├── config.js          # Firebase configuration
│   └── database.js        # Database operations
└── main.jsx               # App entry point
```

## License

Private - All rights reserved