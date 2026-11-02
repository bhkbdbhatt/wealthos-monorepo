# Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js (TypeScript), NestJS, Clean Architecture + DDD |
| Web Frontend | Next.js (App Router), Tailwind CSS, shadcn/ui |
| Mobile | React Native (Expo) |
| Database | PostgreSQL (Prisma ORM) |
| Cache / Queue | Redis, BullMQ |
| Auth | JWT + RBAC |
| Encryption | AES-256-GCM for PII/documents |
| Infra | Docker Compose |

# Directory Blueprint
   wealthos-monorepo/
├── apps/
│ ├── backend-api/ # NestJS core FinTech engine
│ ├── partner-dashboard/ # Next.js MFD/Advisor portal
│ ├── investor-portal/ # Next.js Client portal
│ └── mobile-app/ # React Native unified app
├── packages/
│ ├── database/ # Prisma schema, migrations, seeds
│ ├── shared-types/ # Unified TypeScript interfaces
│ └── ui-core/ # Shared Tailwind/shadcn component library
└── docker-compose.yml

# Module A: Core Multi-Asset FinTech Engine (Backend)

## A1. Database Schema (Prisma)
- `User` — enum roles: `ADMIN`, `ADVISOR`, `CLIENT`
- `Asset` — types: `MUTUAL_FUND`, `EQUITY`, `BOND`, `FIXED_DEPOSIT`, `INSURANCE`
- `Transaction` — types: `BUY`, `SELL`, `SIP`, `SWITCH`; linked to Asset + User
- `Portfolio` — holdings, AUM calculation (current value, invested value, gain/loss)
- `Commission` — upfront vs. trail logic, linked to Transaction + Advisor

## A2. KYC & Onboarding Service
- Digital KYC pipeline with states: `INITIATED → PAN_VALIDATED → DIGILOCKER_SYNCED → AADHAAR_ESIGNED → VIDEO_KYC_PENDING → COMPLETED`
- Mockable adapters for: PAN validation API, DigiLocker webhook, Aadhaar e-Sign, Video KYC
- Webhook endpoints for async status updates

## A3. Transaction & SIP Engine
- Single and bulk asset execution
- Multi-day SIP logic: split monthly mandate into configurable intervals (e.g., 3x/month)
- Automated recurring debit via BullMQ cron jobs
- Idempotency keys on all transaction endpoints

## A4. CAS Tracker & Parser Engine
- Upload endpoint accepting CAS PDFs (CAMS/Karvy format)
- Parser extracts: fund name, units, NAV, buy/sell date, transaction type
- Populates historical `Portfolio` and `Transaction` records
- Deduplication logic for re-uploads

# Module B: B2B Partner Desk (Frontend)

## B1. Business Analytics Dashboard
- Total AUM, Live SIP count, MRR, Commission tracking
- Time-series charts (monthly AUM growth, SIP inflow/outflow)
- Filterable by date range, asset class, client segment

## B2. Dynamic Client Segmenter
- Multi-conditional filtering UI (AND/OR logic)
- Example: `AUM > ₹5,00,000 AND Pending KYC = true`
- Saved segments with export (CSV)

## B3. White-Label Webpage Generator
- Advisor fills profile form (name, photo, bio, specialties, contact)
- Renders public landing page at `/partners/[username]`
- Custom lead capture widget (form → backend → notification to advisor)

# Module C: B2C Investor Portal & Smart Tracking

## C1. Unified Portfolio Viewer
- Pie chart: asset allocation by class
- Performance metrics: XIRR, Absolute Return %, Current Value vs. Invested Value
- Per-asset drill-down with NAV history

## C2. Thematic Baskets & Goal Mapper
- "Wealth Baskets": group multiple mutual funds into a single purchase item
- Goal Mapper: target amount + timeline → recommended monthly investment
- Progress tracking against goal milestones

# Key Algorithms

## XIRR
- Newton-Raphson iterative solver for IRR with irregular cash flows
- Input: array of `{ date, amount }` (negative = outflow, positive = inflow)
- Convergence: tolerance 1e-7, max 100 iterations, initial guess 0.1

## AUM Calculation
- `AUM = Σ (current_units × current_NAV)` across all holdings
- Recomputed on every NAV update (cron: daily 18:00 IST)

## Commission Calculation
- Upfront: `transaction_value × upfront_rate` (one-time, at purchase)
- Trail: `current_holding_value × trail_rate / 12` (monthly)
- Rates defined per asset class + advisor tier   