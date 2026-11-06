
# Real Estate Management System
## API Endpoint Documentation

### 1. Authentication – Section 1

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/auth/login | Authenticate employee |
| GET | /api/auth/me | Get logged-in employee details |

Login requirements:
- Accept login credentials.
- Validate employee credentials.
- Identify employee role.
- Generate JWT token.
- Return authentication result and role.

### 2. Executive Dashboard – Section 3

#### Employee Management

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/executive/employees | Add a new employee |
| GET | /api/executive/employees | View employees |

#### Customer Management

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/executive/customers | Add a new customer |
| GET | /api/executive/customers | View customers |

#### Customer Assignment

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/executive/assignments | Assign customer to inside sales employee |

### 3. Security Requirements

- JWT-based authentication.
- Role-based authorization.
- Validate incoming request data.
- Hash passwords before storing them.
- Protect executive endpoints from unauthorized users.

### 4. Pending Decisions

- Final database schema and field names.
- Exact request and response formats.
- Role names and permissions.
- Required employee and customer fields.
