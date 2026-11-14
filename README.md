# PropLattice

PropLattice is a full-stack real estate operations platform for employee management, customer relationships, sales activity, property visits, and attendance tracking.

## Live Demo

[View the application](https://real-estate-management-system-rho-ten.vercel.app/)

## Technology Stack

**Frontend**
- React.js
- JavaScript
- Vite
- Tailwind CSS

**Backend**
- Node.js
- Express.js
- REST APIs
- JWT Authentication

**Database**
- PostgreSQL
- Prisma ORM

## User Roles

1. Admin
2. Executive
3. Inside Sales Employee
4. Outside Sales Employee

## Core Features

- Role-based authentication and authorization
- Employee management
- Customer management
- Customer assignment
- Customer calling and interest tracking
- Property visit scheduling
- Location-based attendance
- Audio recording and selfie uploads
- Dashboard and activity monitoring

## Mobile operational-security decision

The web visit workflow performs explicit, foreground location verification and
accepts validated evidence uploads. It does not claim to automatically record
in the background, prevent operating-system screenshots, or continuously block
an employee who leaves a geofence. The companion-app architecture and delivery
roadmap are in [documentation/mobile-operational-security.md](documentation/mobile-operational-security.md).

## Project Structure

```text
real-estate-management-system/
├── frontend/
├── backend/
├── documentation/
└── README.md
```

## Development Team

Full Stack Development Team

## Project Timeline

Development deadline: 15 November 2026.

## Project Status

Under Development.
