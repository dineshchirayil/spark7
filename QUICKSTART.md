# Sarva Quick Start

## Prerequisites
- Node.js 18+
- npm 9+
- MongoDB (local or Atlas)

## 1) Configure Environment
Create `.env` in project root:

```env
DATABASE_URL=your_mongodb_connection_string
JWT_SECRET=your_secret_key
PORT=3000
```

## 2) Start Application

### Option A: Windows one-command launcher (`app-control.bat`)

Start with default ports:

```bat
app-control.bat start
```

Start with custom ports:

```bat
app-control.bat start 3000 5173
```

Stop listeners on configured ports:

```bat
app-control.bat stop 3000 5173
```

Restart:

```bat
app-control.bat restart 3000 5173
```

### Option B: Manual (all OS)

Terminal 1:

```bash
npm run dev:server
```

Terminal 2:

```bash
npm run dev:client
```

App URLs:
- API: `http://localhost:3000`
- UI: `http://localhost:5173`

## 3) Project File Structure (For Understanding)

Primary code is under `src/`.

```text
POSOPENAI/
├─ app-control.bat                # Start/stop helper for server+client and port cleanup
├─ QUICKSTART.md                  # This guide
├─ package.json                   # Scripts and dependencies
├─ .env                           # Runtime environment variables
├─ src/
│  ├─ client/                     # React + Vite frontend
│  │  ├─ App.tsx                  # Main app routes and auth/session flow
│  │  ├─ components/              # Shared UI parts (Navbar, modals, etc.)
│  │  ├─ pages/                   # Feature pages (Sales, Reports, Accounting, etc.)
│  │  ├─ hooks/                   # Reusable frontend hooks
│  │  ├─ utils/                   # API helpers, print/export helpers, settings utilities
│  │  └─ styles/                  # Page/style files
│  ├─ server/                     # Express + MongoDB backend
│  │  ├─ app.ts                   # API bootstrap, middleware, route registration
│  │  ├─ routes/                  # API endpoints by module
│  │  ├─ models/                  # Mongoose schemas/models
│  │  ├─ services/                # Business logic services
│  │  ├─ middleware/              # Auth, role/page permissions
│  │  └─ utils/                   # Server utility helpers
│  ├─ shared/                     # Shared types/RBAC constants used by client+server
│  └─ desktop/                    # Electron shell entry (desktop mode)
└─ dist/                          # Build output
```

Important routing map:
- Frontend page routes are defined in `src/client/App.tsx`.
- Backend API routes are mounted in `src/server/app.ts`.
- Each API module lives in `src/server/routes/*.ts`.

Note:
- There are some legacy/helper files at repo root and inside `src/server` (old TSX helpers). Current app behavior is driven by `src/client/*` and `src/server/routes/*`.

## 4) Authentication (Runnable)

Register:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@example.com\",\"password\":\"Password123\",\"firstName\":\"Admin\",\"lastName\":\"User\"}"
```

Login:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@example.com\",\"password\":\"Password123\"}"
```

Use token on protected APIs:

```bash
-H "Authorization: Bearer YOUR_TOKEN"
```

Logout (now audited):

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 5) New Audit Logs (Latest Update)

Audit logs now include:
- Login/logout
- Sales
- Refunds/returns
- Price changes (discount/override/approval)
- Day-end closing
- Settings changes

Audit log guarantees:
- Immutable (cannot update/delete audit entries)
- Store-scoped
- Admin-viewable only (`admin`/`super_admin`)

Audit logs API:
- `GET /api/reports/audit-logs` (admin only, store-scoped)

Settings change audit API:
- `POST /api/settings/audit-change` (called from Settings page on Save)

## 6) Quick Audit Smoke Test (PowerShell, Copy/Paste)

```powershell
$BASE = "http://localhost:3000"
$EMAIL = "admin@example.com"
$PASSWORD = "Password123"

# Register once (ignore if already exists)
try {
  Invoke-RestMethod -Method Post -Uri "$BASE/api/auth/register" -ContentType "application/json" -Body (@{
    email = $EMAIL
    password = $PASSWORD
    firstName = "Admin"
    lastName = "User"
  } | ConvertTo-Json)
} catch {}

# Login (creates login audit)
$login = Invoke-RestMethod -Method Post -Uri "$BASE/api/auth/login" -ContentType "application/json" -Body (@{
  email = $EMAIL
  password = $PASSWORD
} | ConvertTo-Json)
$token = $login.token
$authHeaders = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

# Settings change audit
Invoke-RestMethod -Method Post -Uri "$BASE/api/settings/audit-change" -Headers $authHeaders -Body (@{
  before = @{ invoice = @{ prefix = "INV-" }; printing = @{ profile = "a4" } }
  after  = @{ invoice = @{ prefix = "NEW-" }; printing = @{ profile = "thermal80" } }
} | ConvertTo-Json -Depth 10)

# Logout (creates logout audit)
Invoke-RestMethod -Method Post -Uri "$BASE/api/auth/logout" -Headers @{ Authorization = "Bearer $token" }

# Login again and fetch latest audit logs
$login2 = Invoke-RestMethod -Method Post -Uri "$BASE/api/auth/login" -ContentType "application/json" -Body (@{
  email = $EMAIL
  password = $PASSWORD
} | ConvertTo-Json)
$token2 = $login2.token
Invoke-RestMethod -Method Get -Uri "$BASE/api/reports/audit-logs?limit=20" -Headers @{ Authorization = "Bearer $token2" }
```

## 7) Core APIs (Current)

### Sales
- `POST /api/sales`
- `POST /api/sales/:id/post`
- `PUT /api/sales/:id`
- `DELETE /api/sales/:id`
- `POST /api/sales/:id/payments`
- `POST /api/sales/:id/approve-price-override`
- `GET /api/sales/customer/history`
- `GET /api/sales/:id/print?format=a4|thermal`

### Returns / Refunds
- `POST /api/returns`
- `PUT /api/returns/:id/approve`
- `PUT /api/returns/:id/reject`
- `DELETE /api/returns/:id`

### Credit Notes
- `POST /api/credit-notes`
- `POST /api/credit-notes/from-return/:returnId`
- `POST /api/credit-notes/:id/adjust`
- `POST /api/credit-notes/:id/refund`

### Settlements & Day-End
- `POST /api/settlements/receipts`
- `GET /api/settlements/collections/daily`
- `GET /api/settlements/collections/user-wise`
- `POST /api/settlements/day-end/close`
- `GET /api/settlements/day-end/report`

### Reports
- `GET /api/reports/daily-sales-summary`
- `GET /api/reports/item-wise-sales`
- `GET /api/reports/customer-wise-sales`
- `GET /api/reports/sales-returns`
- `GET /api/reports/gross-profit`
- `GET /api/reports/outstanding-receivables`
- `GET /api/reports/cash-vs-credit`
- `GET /api/reports/user-wise-sales`
- `GET /api/reports/tax-summary`
- `GET /api/reports/audit-logs`

## 8) Build / Validation

Client build:

```bash
npm run build:client
```

Note: `npm run build` / server type-check currently has existing project-level TypeScript config issues unrelated to runtime API behavior. For development/runtime, use:

```bash
npm run dev:server
```

## 9) Hostinger Deploy Folder (One Command)

Create/update a deploy-ready folder (`hostinger-ready`) with only required runtime files:

```bash
npm run prepare:hostinger
```

Output folder includes:
- `dist/server`
- `dist/client`
- `dist/shared`
- `package.json`
- `package-lock.json`
- `.env.example`
- `DEPLOY.txt`

Note:
- In generated `hostinger-ready/package.json`, build scripts are set to no-op because `dist` is prebuilt.
- This prevents Hostinger from failing with `src/server/app.ts not found` when it runs `npm run build`.

If you already built client and want faster sync without rebuilding:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/prepare-hostinger.ps1 -SkipClientBuild
```

## 10) Feature List (Current)

- Authentication and session:
  - Register, login, logout with JWT
  - Role and page-level access control (RBAC)

- Sales and invoicing:
  - Cash and credit invoice flow
  - Draft and posted invoice modes
  - Manual/auto invoice numbering
  - Bill-level discount (amount/%)
  - Round-off support
  - Invoice print support (A4/Thermal)
  - Edit posted invoice from sales history flow

- Returns, refunds, and credit notes:
  - Full/partial return handling
  - Return approval/rejection workflow
  - Credit note creation and adjustment flow

- Customers and receivables:
  - Customer-wise sales history
  - Outstanding tracking and settlements
  - Receipt posting and invoice payment updates

- Inventory and catalog:
  - Products and categories management
  - Inventory stock impact from sales/returns
  - Low stock visibility and inventory views

- People operations:
  - Employee master
  - Attendance register
  - Shift scheduling
  - Payroll and salary calculations

- Facilities and memberships:
  - Facility setup with images
  - Facility booking (individual/walk-in, single facility slot)
  - Event booking (corporate/organizer, supports multiple facilities in one event)
  - Event calendar with reminders, receipt, reschedule, cancellation/refund tracking
  - Membership plan management

- Accounting console:
  - Opening balances
  - Expenses and income entries
  - Vouchers (receipt/payment/journal patterns)
  - Cash/bank book and financial report tabs

- Reports:
  - Daily sales summary
  - Item-wise sales
  - Customer-wise sales
  - Sales return
  - Gross profit
  - Outstanding receivables
  - Cash vs credit sales
  - User-wise sales
  - Attendance report
  - Export to Excel/PDF from reports UI

- Admin and governance:
  - User management and roles
  - Super-admin backup and restore
  - Backup/restore history view
  - Store-scoped immutable audit logs
  - Audit coverage for login/logout, sales, refunds, price changes, day-end, and settings changes
