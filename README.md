# 🏠 PropLattice — Real Estate Management System

> A full-stack real estate operations platform built for modern real estate teams.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit%20Now-brightgreen?style=for-the-badge)](https://real-estate-management-system-rho-ten.vercel.app/)
[![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-blue?style=for-the-badge)](https://vitejs.dev/)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-green?style=for-the-badge)](https://expressjs.com/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20Prisma-336791?style=for-the-badge)](https://www.prisma.io/)

---

## 🌐 Live Deployment

The project is **live and deployed**. You can access the application directly without any setup:

### 👉 [https://real-estate-management-system-rho-ten.vercel.app/](https://real-estate-management-system-rho-ten.vercel.app/)

---

## 📖 Project Description

**PropLattice** is a comprehensive real estate operations and workforce management platform designed to streamline the day-to-day operations of real estate companies. It bridges the gap between management, inside sales, and outside sales teams through a centralized, role-based digital workspace.

### What it does:

- **Manages employees** across multiple roles — from admins to field agents
- **Tracks customers** with full CRM capabilities including interest tracking and calling logs
- **Schedules and verifies property visits** with GPS location validation, selfie uploads, and audio recordings
- **Handles attendance** using location-based check-in with geofencing
- **Provides dashboards** for real-time monitoring of team activity, sales performance, and visit status
- **Sends WhatsApp notifications** to customers via Meta Cloud API integration

Whether you're managing a small brokerage or a large real estate firm, PropLattice gives every team member exactly the tools they need — no more, no less — based on their role.

---

## ✨ Core Features

| Feature | Description |
|---|---|
| 🔐 Role-Based Auth | Secure JWT-based login with 4 distinct user roles |
| 👥 Employee Management | Add, edit, deactivate, and assign employees |
| 🧑‍💼 Customer Management | Full CRM — track customers, interests, and call history |
| 📋 Customer Assignment | Assign customers to inside/outside sales reps |
| 📞 Call Logging | Log customer calls with interest level and notes |
| 🏡 Property Visits | Schedule, verify, and review field property visits |
| 📍 Location Attendance | GPS-based check-in with geofence validation |
| 📸 Evidence Uploads | Selfie + audio recording upload via Cloudinary |
| 📊 Dashboards | Role-specific activity and performance monitoring |
| 📢 Announcements | Admin broadcasts to the team |

---

## 👤 User Roles

| Role | Description |
|---|---|
| **Admin** | Full platform control — employees, customers, properties, reports |
| **Executive** | Oversee team performance, manage assignments, review visits |
| **Inside Sales Employee** | Handle inbound leads, calls, and customer follow-ups |
| **Outside Sales Employee** | Field visits, location check-ins, and site-level customer meetings |

---

## 🛠️ Technology Stack

### Frontend
- **React.js 19** — UI library
- **Vite 8** — Lightning-fast build tool
- **Tailwind CSS 4** — Utility-first styling
- **React Router 7** — Client-side routing
- **Lucide React** — Icon library

### Backend
- **Node.js** — Runtime environment
- **Express.js 5** — Web framework
- **JWT (jsonwebtoken)** — Authentication & authorization
- **Helmet** — Security headers
- **Multer** — File upload handling
- **bcryptjs** — Password hashing

### Database & ORM
- **PostgreSQL** — Relational database
- **Prisma ORM 7** — Type-safe database access

### Cloud & Integrations
- **Cloudinary** — Media storage (selfies & audio recordings)
- **Meta WhatsApp Cloud API** — Customer notifications
- **Vercel** — Frontend deployment

---

## 📁 Project Structure

```text
real-estate-management-system/
├── frontend/                   # React + Vite application
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/              # Route-level page components
│   │   └── ...
│   ├── package.json
│   └── vite.config.js
│
├── backend/                    # Node.js + Express API server
│   ├── src/
│   │   ├── controllers/        # Request handlers
│   │   ├── routes/             # API route definitions
│   │   ├── middlewares/        # Auth, validation, error handling
│   │   ├── integrations/       # Cloudinary, WhatsApp
│   │   ├── utils/              # Helper utilities
│   │   └── server.js           # App entry point
│   ├── prisma/                 # DB schema & migrations
│   ├── .env.example            # Environment variable template
│   └── package.json
│
├── documentation/              # Architecture & requirements docs
└── README.md
```

---

## 🚀 How to Run This Project Locally

Follow these steps to set up and run PropLattice on your local machine.

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/) (v18 or higher)
- [PostgreSQL](https://www.postgresql.org/download/) (v14 or higher)
- [Git](https://git-scm.com/)
- A [Cloudinary](https://cloudinary.com/) account (free tier works)

---

### Step 1 — Clone the Repository

```bash
git clone https://github.com/your-username/real-estate-management-system.git
cd real-estate-management-system
```

---

### Step 2 — Set Up the Backend

```bash
cd backend
```

**Install dependencies:**
```bash
npm install
```

**Configure environment variables:**
```bash
# Copy the example env file
cp .env.example .env
```

Now open `.env` and fill in the required values:

```env
# PostgreSQL connection string
DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/real_estate_db?schema=public"

# Admin account that gets created on first seed
ADMIN_NAME="System Administrator"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="your-secure-password"

# JWT config — use a long random string for JWT_SECRET
JWT_SECRET="your-random-secret-key"
JWT_EXPIRES_IN="1h"
JWT_ISSUER="real-estate-management-system"
JWT_AUDIENCE="real-estate-management-system-api"

# Allow requests from your frontend dev server
CORS_ORIGINS="http://localhost:5173"

# Cloudinary (for visit evidence uploads)
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
CLOUDINARY_EVIDENCE_FOLDER="visit-evidence"
```

**Set up the database:**
```bash
# Generate Prisma client
npx prisma generate

# Run migrations to create tables
npx prisma migrate deploy

# Seed the database with an admin account
npm run db:seed
```

**Start the backend server:**
```bash
# Development mode (with auto-reload)
npm run dev

# OR production mode
npm start
```

The backend API will be running at **http://localhost:3000**

---

### Step 3 — Set Up the Frontend

Open a **new terminal** and navigate to the frontend:

```bash
cd frontend
```

**Install dependencies:**
```bash
npm install
```

**Configure the API URL** (if your backend runs on a different port, update the base URL in the frontend config accordingly).

**Start the frontend dev server:**
```bash
npm run dev
```

The frontend will be running at **http://localhost:5173**

---

### Step 4 — Log In

Open your browser and go to **http://localhost:5173**

Use the admin credentials you set in the `.env` file to log in:
- **Email:** `admin@example.com` (or whatever you set)
- **Password:** the password you configured in `ADMIN_PASSWORD`

---

## 🧪 Running Tests

```bash
cd backend

# Run unit tests
npm test

# Run integration tests (requires separate test DB setup)
npm run test:integration
```

---

## 📦 Build for Production

**Frontend build:**
```bash
cd frontend
npm run build
# Output is in the dist/ folder — deploy to Vercel, Netlify, etc.
```

---

## 📚 Documentation

Additional documentation is available in the [`documentation/`](documentation/) folder:

- [`mobile-operational-security.md`](documentation/mobile-operational-security.md) — Mobile security architecture
- [`final-requirements-verification.md`](documentation/final-requirements-verification.md) — Requirements verification matrix

---

## 🤝 Development Team

Built with ❤️ by the **Edufy Tech** Full Stack Development Team.

---

## 📄 License

This project is proprietary software. All rights reserved.
