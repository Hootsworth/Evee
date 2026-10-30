# Evee - AI B2B Prospecting & Outreach Platform

Evee is an autonomous, evidence-backed prospecting and outreach platform engineered for modern small businesses. It discovers local businesses, inspects their public web presence, identifies concrete automation opportunities, calculates deterministic qualification scores, and drafts personalized emails requiring explicit human review before controlled dispatch.

Built strictly according to [ARCHITECTURE.MD](file:///Users/adityadixit/Documents/antigravity/hopeful-bohr/ARCHITECTURE.MD) and the [DESIGN.md](file:///Users/adityadixit/Documents/antigravity/hopeful-bohr/DESIGN.md) Together AI visual system.

---

## 1. Quickstart & Local Setup

### Prerequisites
- Node.js 18+ (tested on v26.0.0)
- npm or pnpm
- Supabase project (Free tier supported)
- Google Cloud project (for Gmail sending)

### Installation
```bash
# Clone the repository and install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
```

### Environment Configuration
Edit `.env.local` with your credentials:
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Server Token Encryption (AES-256-GCM 32-byte key)
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Google OAuth & Gmail (Outreach dispatch)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Vercel Cron Secret
CRON_SECRET=your-cron-secret
```

### Database Migration & Seeding
1. Open your Supabase SQL Editor.
2. Run `supabase/migrations/20261030000000_initial_schema.sql` to establish tables, indexes, and Row Level Security.
3. (Optional for dev) Run `supabase/seed.sql` to populate labeled synthetic demo prospects.

### Running Development Server & Tests
```bash
# Run unit & integration tests
npm test

# Build production bundle
npm run build

# Start dev server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view Evee.

---

## 2. Key Architecture & Safety Features

- **Together AI Design System**: Alternating near-black hero bands (`#010120`) and white content bands, the orange-magenta-periwinkle gradient ribbon, uppercase monospace eyebrows (`JetBrains Mono`), and high-density technical cards.
- **Durable Database-backed Job Queue**: Asynchronous tasks (`discover_businesses`, `research_business`, `score_lead`, `generate_draft`, `send_email`) persisted in PostgreSQL with atomic `SKIP LOCKED` batch claiming.
- **Fail-Closed Approval Workflow**: Automated sending is disabled by default. Outreach messages can never be dispatched until both the workflow specification and the individual draft have received human operator approval.
- **Deterministic 100-pt Scoring Engine**: Fit (30 pts), Need/Evidence (35 pts), Contactability (15 pts), Service Match (20 pts), with hard caps for unverified business identity (max 30 pts) and uncertain evidence (max 60 pts).
- **Zero-Hallucination Copy**: The AI copywriter only incorporates evidence IDs verified during webpage inspection.
- **SSRF Connection Protection**: Bounded crawler rejects loopback, private RFC1918 subnets, and AWS/GCP cloud metadata endpoints before fetching.
- **Global Suppression Ledger**: Normalized email and phone opt-outs are validated across all campaigns immediately prior to every API send.
- **Token Security**: Google refresh tokens are AES-256-GCM encrypted at rest on the server; secrets are strictly excluded from client bundles.

---

## 3. Vercel & Production Deployment

1. Push this repository to GitHub.
2. Import project into Vercel.
3. Configure environment variables matching `.env.example`.
4. `vercel.json` automatically registers the cron trigger at `/api/cron/process-jobs` to run every 10 minutes.
5. In Google Cloud Console, add `https://your-domain.vercel.app/api/auth/google/callback` to Authorized Redirect URIs.
