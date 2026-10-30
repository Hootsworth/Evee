# Evee
## Implementation-Ready Technical Specification and Coding-Agent Build Prompt

**Version:** 2.0  
**Architecture:** Next.js + Supabase + Vercel  
**Deployment:** Vercel-hosted web application  
**Backend:** Supabase PostgreSQL, Auth, Row Level Security and server-side functions  
**Target:** 100 qualified new businesses per month  
**Initial operator:** One user  
**Budget objective:** ₹0 additional software cost where practical  
**Email mode:** Controlled automated sending after explicit workflow approval and recipient-level safety checks  
**Container requirement:** None. Do not use Docker.

---

# PART A: PRODUCT REQUIREMENTS

## 1. Product objective

Build a web application that automatically discovers suitable small businesses, researches their public business presence, identifies evidence-backed opportunities for automation, drafts personalized outreach emails and manages a controlled prospecting pipeline.

The initial business offers services such as:

- Mobile-friendly websites for small businesses.
- Digital and QR menus.
- Online enquiry, ordering and booking workflows.
- AI-powered FAQ and customer support tools.
- Administrative workflow automation.
- Other configurable software and automation services.

The application must optimize for qualified prospects and relevant business conversations rather than raw contact volume.

### Success criteria

1. Discover at least 100 unique qualified businesses per month when configured providers can supply sufficient eligible records.
2. Deduplicate businesses across discovery runs and sources.
3. Preserve evidence and source attribution for research findings.
4. Generate personalized drafts using verified observations.
5. Require explicit workflow approval before automated sending is enabled.
6. Check recipient eligibility, suppression, sending limits and duplicate-send protection before each send.
7. Track delivery attempts, replies, follow-ups, opt-outs and conversions.
8. Display API usage, quota information and estimated costs.
9. Remain usable when an AI or discovery provider is unavailable.
10. Avoid claiming that unverified observations are facts.

The system must report shortfalls honestly when there are insufficient eligible leads. It must never manufacture prospects to meet a monthly target.

## 2. Scope

### Included in v1

- Secure authentication for one initial owner.
- Campaign creation and management.
- Business discovery using permitted APIs and sources.
- Website inspection and evidence extraction.
- AI-assisted lead qualification and scoring.
- Personalized email drafting.
- Gmail OAuth integration.
- Workflow approvals and controlled sending.
- Follow-up scheduling.
- Suppression and opt-out management.
- Cost and quota monitoring.
- Audit logging and operational monitoring.
- CSV export of eligible application-owned records.
- Responsive web dashboard.

### Excluded from v1

- Docker or container-based development requirements.
- A separate FastAPI backend.
- Self-managed Redis or Celery.
- Unsolicited automated Instagram DMs.
- Unsolicited automated WhatsApp messages.
- Scraping login-protected websites or bypassing anti-bot systems.
- Unrestricted bulk extraction from third-party directories.
- Fully autonomous multichannel outreach.
- Multi-tenant SaaS billing.

Instagram and WhatsApp can be tracked as manually managed channels. Official integrations may be added later after validating permissions, messaging policies and pricing.

## 3. Primary workflow

1. The owner creates a campaign.
2. The owner configures geography, industry, search terms and services.
3. The discovery worker retrieves records from enabled permitted sources.
4. The normalization service deduplicates businesses.
5. The research worker inspects permitted public webpages.
6. The evidence engine records observations with source URLs and timestamps.
7. The qualification engine scores each lead.
8. Qualified leads enter the review queue.
9. The AI drafts personalized emails.
10. The owner approves the workflow and its configuration.
11. The sending worker checks all safety conditions immediately before sending.
12. Gmail sends the approved message.
13. The application records the outcome and schedules eligible follow-ups.
14. Replies, opt-outs, bounces and conversions update the lead timeline.
15. The dashboard reports performance and costs.

---

# PART B: TECHNOLOGY STACK

## 4. Required architecture

| Layer | Technology |
|---|---|
| Frontend | Next.js App Router, React, TypeScript |
| Styling | Tailwind CSS and reusable accessible components |
| Application backend | Next.js Route Handlers and server-side modules |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Authorization | PostgreSQL Row Level Security |
| Schema and migrations | Supabase CLI and SQL migrations |
| File storage | Supabase Storage only where necessary |
| Background job persistence | PostgreSQL job table |
| Job scheduling | Vercel Cron where available |
| Long-running or isolated work | Supabase Edge Functions or a suitable external worker if required |
| Website parsing | Lightweight TypeScript HTML parser |
| Browser automation | Optional isolated browser service, disabled by default |
| AI | Provider-neutral server-side adapter |
| Email | Gmail API and OAuth 2.0 |
| Hosting | Vercel |
| Testing | Vitest, React Testing Library and Playwright |
| Monitoring | Structured logs, Vercel logs and health endpoints |

Use currently supported package versions and document the tested version combinations.

### Architecture principle

Keep the application as a modular Next.js codebase. Use Supabase as the persistent backend and Vercel for the web application and short-running scheduled tasks.

Do not introduce a separate backend server, Redis, Celery or a container orchestration system.

All secrets and privileged operations must remain server-side.

## 5. High-level architecture

```text
                 User's Browser
                       |
                       v
                Vercel Deployment
                       |
              Next.js Application
                       |
           +-----------+-----------+
           |                       |
           v                       v
     Supabase Auth            Server Modules
           |                       |
           |              +--------+---------+
           |              |        |         |
           v              v        v         v
       PostgreSQL     Discovery  Research   Gmail
           |          Providers  Pipeline   API
           |
           +---- RLS-protected application data
           |
           +---- Durable job queue
           |
           +---- Evidence and audit records
           |
           +---- Usage and budget ledger

               Vercel Cron
                    |
                    v
          Authenticated job dispatcher
                    |
                    v
           Database-backed workers
```

### Responsibilities

**Vercel**

- Serve the web application.
- Execute server-side application logic.
- Handle OAuth callbacks.
- Execute short-running API operations.
- Trigger scheduled job processing.
- Store deployment secrets.

**Supabase**

- Authenticate users.
- Store application records.
- Enforce row-level access policies.
- Persist job states.
- Store evidence, campaigns and outreach history.
- Support database transactions and unique constraints.
- Store encrypted application data where appropriate.

**External providers**

- Discover businesses.
- Generate AI research and drafts.
- Send email through Gmail.
- Optionally verify contact details.

Provider failures must not corrupt the database or silently skip safety checks.

## 6. Repository structure

```text
Evee/
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── campaigns/
│   │   ├── leads/
│   │   ├── research/
│   │   ├── drafts/
│   │   ├── outreach/
│   │   ├── workflows/
│   │   ├── reports/
│   │   └── settings/
│   ├── api/
│   │   ├── auth/
│   │   ├── campaigns/
│   │   ├── discovery/
│   │   ├── research/
│   │   ├── drafts/
│   │   ├── workflows/
│   │   ├── outreach/
│   │   ├── gmail/
│   │   ├── cron/
│   │   └── health/
│   ├── layout.tsx
│   └── page.tsx
├── components/
├── lib/
│   ├── supabase/
│   ├── auth/
│   ├── providers/
│   │   ├── discovery/
│   │   ├── ai/
│   │   ├── email/
│   │   └── verification/
│   ├── research/
│   ├── scoring/
│   ├── outreach/
│   ├── compliance/
│   ├── budgets/
│   ├── jobs/
│   └── validation/
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── config.toml
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── public/
├── docs/
│   ├── architecture.md
│   ├── provider-setup.md
│   ├── security.md
│   └── deployment.md
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.ts
├── vercel.json
└── README.md
```

No Dockerfiles, Docker Compose configuration or container startup instructions are required.

---

# PART C: SUPABASE DATA MODEL

## 7. Database conventions

Use PostgreSQL UUID primary keys, foreign keys, UTC timestamps, check constraints and appropriate indexes.

Use SQL migrations committed to `supabase/migrations/`.

Do not rely on manual dashboard edits as the only way to reproduce the database schema.

Enable Row Level Security on every exposed application table.

### 7.1 profiles

Fields:

- `id`: UUID referencing `auth.users`.
- `display_name`.
- `role`: owner or operator.
- `is_active`.
- `created_at`.
- `updated_at`.

For v1, allow only explicitly authorized users. A single-user product should not automatically expose registration to the public.

### 7.2 businesses

Fields:

- `id`: UUID.
- `normalized_name`.
- `display_name`.
- `business_type`.
- `description`: nullable.
- `country_code`.
- `region`.
- `city`.
- `postal_code`: nullable.
- `official_website_url`: nullable.
- `public_business_phone`: nullable.
- `general_business_email`: nullable.
- `canonical_domain`: nullable.
- `identity_confidence`.
- `record_status`.
- `last_verified_at`.
- `created_at`.
- `updated_at`.

Use stable provider identifiers where permitted. Otherwise, use conservative identity matching based on domain, business name, location and other eligible identifiers.

Never merge two businesses solely because their names match.

### 7.3 business_sources

Fields:

- `id`.
- `business_id`.
- `provider_name`.
- `provider_record_id`: nullable.
- `source_url`: nullable.
- `source_type`.
- `retrieved_at`.
- `retention_policy_id`.
- `permitted_fields`: JSONB.
- `provider_metadata`: only when permitted.

Use unique constraints for stable provider identifiers within the provider's namespace.

### 7.4 campaigns

Fields:

- `id`.
- `name`.
- `target_geographies`: JSONB.
- `target_industries`: JSONB.
- `search_terms`: JSONB.
- `services_to_promote`: JSONB.
- `monthly_target`, default 100.
- `daily_discovery_limit`.
- `qualification_threshold`.
- `status`: draft, active, paused, completed.
- `created_by`.
- `created_at`.
- `updated_at`.

### 7.5 campaign_businesses

Fields:

- `campaign_id`.
- `business_id`.
- `discovery_status`.
- `qualification_score`.
- `qualification_status`.
- `added_at`.

Unique constraint: `(campaign_id, business_id)`.

### 7.6 research_runs

Fields:

- `id`.
- `business_id`.
- `campaign_id`: nullable.
- `status`: queued, running, completed, failed, blocked.
- `started_at`.
- `completed_at`.
- `pages_attempted`.
- `pages_successfully_read`.
- `error_code`: nullable.
- `error_summary`: nullable.
- `model_provider`: nullable.
- `model_name`: nullable.
- `estimated_cost`.
- `currency`.
- `created_at`.

### 7.7 evidence_items

Fields:

- `id`.
- `business_id`.
- `research_run_id`.
- `source_url`.
- `source_type`.
- `observed_at`.
- `finding_type`.
- `claim_text`.
- `supporting_excerpt`: nullable and subject to source permissions.
- `confidence`, from 0 to 1.
- `verification_status`: verified, uncertain, contradicted, expired.
- `expires_at`.
- `retention_policy_id`.
- `metadata`: JSONB.

Store minimal evidence rather than entire webpages.

### 7.8 contacts

Fields:

- `id`.
- `business_id`.
- `contact_name`: nullable.
- `job_title`: nullable.
- `email_address`: nullable.
- `email_normalized`: nullable.
- `contact_channel`.
- `contact_source_url`: nullable.
- `contact_type`.
- `verification_status`: unknown, syntax_valid, provider_verified, bounced, invalid.
- `contact_eligibility`: eligible, review_required, ineligible.
- `consent_status`: unknown, consented, not_required_confirmed, withdrawn, denied.
- `last_verified_at`.
- `created_at`.
- `updated_at`.

A valid email syntax does not prove that an address exists or that marketing is permitted.

### 7.9 lead_scores

Fields:

- `id`.
- `business_id`.
- `campaign_id`.
- `score_version`.
- `fit_score`.
- `need_score`.
- `contactability_score`.
- `service_match_score`.
- `evidence_confidence`.
- `final_score`.
- `reason_codes`: JSONB.
- `created_at`.

Keep score history.

### 7.10 email_drafts

Fields:

- `id`.
- `business_id`.
- `contact_id`.
- `campaign_id`.
- `subject`.
- `body_text`.
- `body_html`: nullable.
- `personalization_summary`.
- `evidence_item_ids`: UUID array or JSONB.
- `model_provider`.
- `model_name`.
- `prompt_version`.
- `validation_status`.
- `approval_status`: pending, approved, rejected, expired.
- `approved_by`: nullable.
- `approved_at`: nullable.
- `created_at`.
- `updated_at`.

### 7.11 outreach_workflows

Fields:

- `id`.
- `name`.
- `version`.
- `status`: draft, pending_approval, approved, paused, revoked.
- `configuration`: JSONB.
- `approved_by`.
- `approved_at`.
- `created_at`.
- `updated_at`.

Every material change must increment the workflow version and invalidate its previous approval.

### 7.12 outreach_messages

Fields:

- `id`.
- `business_id`.
- `contact_id`.
- `draft_id`.
- `workflow_id`.
- `workflow_version`.
- `channel`.
- `provider_message_id`: nullable.
- `idempotency_key`: unique.
- `status`: queued, sending, sent, failed, bounced, replied, cancelled, unknown_outcome.
- `scheduled_at`.
- `attempted_at`.
- `sent_at`.
- `failure_code`: nullable.
- `failure_detail`: nullable.
- `created_at`.
- `updated_at`.

### 7.13 suppression_entries

Fields:

- `id`.
- `normalized_email`: nullable.
- `normalized_phone`: nullable.
- `business_id`: nullable.
- `channel`: nullable.
- `reason`: opt_out, complaint, hard_bounce, manual_block, legal_restriction.
- `source`.
- `created_at`.

Suppression checks must work across campaigns.

### 7.14 follow_up_tasks

Fields:

- `id`.
- `business_id`.
- `contact_id`.
- `related_message_id`: nullable.
- `task_type`.
- `due_at`.
- `status`: pending, completed, cancelled.
- `created_at`.
- `updated_at`.

### 7.15 provider_usage

Fields:

- `id`.
- `provider_name`.
- `operation`.
- `campaign_id`: nullable.
- `request_count`.
- `input_tokens`: nullable.
- `output_tokens`: nullable.
- `estimated_cost`.
- `actual_cost`: nullable.
- `currency`.
- `billing_period`.
- `recorded_at`.
- `metadata`: sanitized JSONB.

### 7.16 audit_events

Fields:

- `id`.
- `actor_id`: nullable.
- `event_type`.
- `entity_type`.
- `entity_id`.
- `timestamp`.
- `request_id`.
- `details`: sanitized JSONB.

Do not log secrets, OAuth tokens or unnecessary personal data.

### 7.17 background_jobs

Fields:

- `id`.
- `job_type`.
- `payload`: validated JSONB.
- `status`: queued, running, succeeded, failed, cancelled, manual_review.
- `priority`.
- `attempt_count`.
- `max_attempts`.
- `scheduled_at`.
- `locked_at`: nullable.
- `locked_by`: nullable.
- `heartbeat_at`: nullable.
- `last_error_code`: nullable.
- `last_error_summary`: nullable.
- `idempotency_key`: unique.
- `created_at`.
- `updated_at`.

Use atomic database operations to claim jobs. Expired locks must be recoverable without creating duplicate sends.

---

# PART D: SUPABASE AUTHENTICATION AND ACCESS CONTROL

## 8. Supabase Auth

Use Supabase Auth for user authentication.

Requirements:

- Support the chosen sign-in method, preferably email-based authentication for the initial owner.
- Use the official Supabase SSR integration for Next.js.
- Implement separate browser and server Supabase clients.
- Validate sessions on the server.
- Protect dashboard routes.
- Provide sign-out and session-expiry handling.
- Avoid exposing privileged database operations to client-side code.

The service-role key must never appear in the browser bundle.

### Row Level Security

Enable RLS for all exposed tables.

Policies must:

- Restrict records to authorized users or workspaces.
- Deny anonymous access to business, contact and outreach data.
- Prevent users from changing their own role to owner.
- Prevent clients from directly modifying workflow approvals.
- Prevent clients from marking emails as sent.
- Restrict audit-log mutation.
- Keep secrets and OAuth credentials inaccessible to ordinary client queries.

Use server-side authorization checks in addition to RLS.

If the application uses the service-role key for privileged operations, perform explicit authorization in the server-side service layer before every operation. The service-role key bypasses ordinary RLS protections.

### Approval security

Do not permit the browser to approve its own message merely by updating an `approval_status` field.

Implement an authenticated server action or Route Handler that:

1. Validates the current user.
2. Verifies the user's authorization.
3. Validates the workflow version.
4. Checks required configuration.
5. Records an immutable approval event.
6. Updates the workflow state through a controlled database operation.

Use database transactions or a tightly scoped PostgreSQL function for multi-step approval changes.

---

# PART E: PROVIDER ADAPTERS AND DISCOVERY

## 9. Provider-neutral interfaces

Define TypeScript interfaces so that vendor-specific logic remains replaceable.

```typescript
export type DiscoveryQuery = {
  geography: string;
  categories: string[];
  keywords: string[];
  limit: number;
};

export type BusinessCandidate = {
  provider: string;
  providerId?: string;
  name: string;
  category?: string;
  city?: string;
  officialWebsite?: string;
  publicContact?: string;
  sourceUrl?: string;
  attribution?: string;
};

export interface DiscoveryProvider {
  search(
    query: DiscoveryQuery
  ): Promise<BusinessCandidate[]>;
}
```

Create equivalent interfaces for:

- Website fetching.
- AI research.
- AI drafting.
- Contact verification.
- Email sending.
- Reply ingestion.
- Usage accounting.

Every provider must define:

- Supported operations.
- Required configuration.
- Data-retention rules.
- Rate limits.
- Quota information.
- Cost estimates.
- Retry behavior.
- Health status.

## 10. Business discovery

Prioritize:

1. Official APIs with permitted commercial use.
2. Business websites and directories whose terms allow the intended access and use.
3. User-provided business lists and URLs.
4. Optional licensed enrichment providers.

### Google Places

Implement as an optional provider.

- Use the official API.
- Request only necessary fields.
- Apply required attribution.
- Track cost by API operation.
- Follow applicable caching and retention restrictions.
- Never scrape Google Maps webpages.
- Do not assume API-returned information may be retained indefinitely.

If a provider does not permit storing a field in the long-term CRM, the application must not persist it merely because the database supports it.

### Website and directory sources

- Respect robots.txt and applicable terms.
- Identify the application appropriately.
- Apply rate limits and timeouts.
- Avoid authentication barriers and anti-bot circumvention.
- Store only necessary permitted information.
- Track source URLs and retrieval times.
- Support refreshing and removing stale records.

### Contact discovery

Prioritize publicly listed general business contacts, official contact pages, user-provided contacts and appropriately licensed enrichment sources.

Do not guess personal email addresses.

Do not equate a published email address with automatic permission for unsolicited marketing.

---

# PART F: WEBSITE RESEARCH AND AI

## 11. Safe website inspection

Implement a bounded research pipeline inside server-side code or an isolated worker.

### Default research scope

For each business, inspect up to five pages:

- Homepage.
- Contact page.
- Menu or services page.
- Booking or ordering page.
- One additional relevant page.

Make the limit configurable.

### SSRF protections

- Allow only HTTP and HTTPS.
- Resolve hostnames and reject private, loopback, link-local and reserved addresses.
- Revalidate destinations after redirects.
- Protect against DNS rebinding.
- Block cloud metadata endpoints.
- Restrict ports.
- Set response-size and timeout limits.
- Limit redirects and pages per domain.
- Reject unsupported content types.
- Do not forward internal cookies or credentials.
- Never expose internal services to browser-rendering jobs.

A hostname check alone is insufficient. Enforce destination restrictions at the network-connection level.

For production browser rendering, use an isolated service with network restrictions. If such a service is unavailable, skip JavaScript-dependent research rather than silently weakening the security controls.

### Evidence types

- Menu not found among inspected pages.
- Booking link appears broken.
- Contact details are difficult to locate.
- Online ordering is not visible on inspected pages.
- A page appears inaccessible.
- A potential automation opportunity is observed.

A missing feature is not proven just because it was not found on one page. Store the pages inspected, timestamp and confidence level.

## 12. AI integration

Implement a provider-neutral interface.

```typescript
export type ResearchResult = {
  businessSummary: string;
  opportunities: Array<{
    serviceId: string;
    findingIds: string[];
    businessBenefit: string;
    confidence: number;
    reasoningSummary: string;
  }>;
  unsupportedClaims: string[];
  needsHumanReview: boolean;
};

export interface ResearchProvider {
  analyzeBusiness(
    businessContext: unknown,
    evidence: unknown[],
    services: unknown[]
  ): Promise<ResearchResult>;
}

export interface DraftProvider {
  createEmailDraft(
    businessContext: unknown,
    verifiedFindings: unknown[],
    serviceMatch: unknown,
    styleConfig: unknown
  ): Promise<{
    subject: string;
    bodyText: string;
    bodyHtml?: string;
    evidenceIds: string[];
  }>;
}
```

Validate actual outputs at runtime using Zod or an equivalent schema-validation library.

Never trust TypeScript types alone for external model responses.

### AI requirements

- Use structured outputs where supported.
- Validate evidence identifiers.
- Reject invented findings.
- Track provider, model and prompt version.
- Set token and response-size limits.
- Implement timeouts and bounded retries.
- Track estimated costs.
- Support a configurable fallback provider.
- Keep all AI credentials server-side.

Webpage content is untrusted data. Ignore embedded instructions attempting to override the application's policies or trigger actions.

The research model must never have direct access to email-sending credentials or sending tools.

## 13. Lead scoring

Use deterministic, explainable scoring.

| Component | Maximum |
|---|---:|
| Business fit | 30 |
| Evidence of an addressable problem | 35 |
| Contactability | 15 |
| Service match | 20 |
| **Total** | **100** |

Default qualification threshold: 65.

Evidence-quality caps:

- Unverified business identity: maximum score 30.
- No evidence for the claimed problem: maximum score 40.
- Stale or low-confidence evidence: maximum score 60.
- Ineligible or suppressed contact: disqualified from outreach regardless of score.

Reason codes may include:

- `NO_MENU_FOUND_ON_INSPECTED_PAGES`
- `BOOKING_LINK_FAILED`
- `MOBILE_LAYOUT_ISSUE_CONFIRMED`
- `STRONG_SERVICE_MATCH`
- `CONTACT_SOURCE_UNVERIFIED`
- `EVIDENCE_STALE`
- `CONTACT_SUPPRESSED`

Keep score weights and thresholds configurable. Store scoring versions and component scores.

---

# PART G: GMAIL AND OUTREACH

## 14. Gmail OAuth

Use the Gmail API and OAuth 2.0.

### Setup requirements

- Configure a Google Cloud project.
- Enable the Gmail API.
- Configure the OAuth consent screen.
- Configure redirect URIs.
- Request the minimum necessary scopes.
- Encrypt refresh tokens at rest.
- Provide a disconnect and revocation workflow.
- Never request the user's Google password.
- Never store tokens in browser local storage.
- Never commit credentials to Git.

Use `gmail.send` when sending alone is sufficient. Request read-only or modify permissions only if required for reply synchronization or draft management.

Document any OAuth testing-user restrictions or verification requirements applicable to the deployed application.

### Server-side token storage

Store OAuth credentials in a protected database table with RLS enabled and no direct client access.

Encrypt tokens using authenticated encryption with a key stored in Vercel environment variables or an appropriate managed secret store.

Never log access tokens or refresh tokens.

## 15. Safe email sending

Before every send:

1. Confirm that the workflow is approved and active.
2. Confirm that approval matches the current workflow version.
3. Confirm that the draft is approved under the selected mode.
4. Confirm that the recipient remains eligible.
5. Recheck global and channel-specific suppression.
6. Confirm that the contact source is appropriate.
7. Validate factual claims and evidence freshness.
8. Check for an equivalent prior send.
9. Check campaign, daily and monthly limits.
10. Check budget and provider quotas.
11. Claim the message using a database-backed idempotency mechanism.
12. Submit the request to Gmail.
13. Persist the provider message ID and result.
14. Schedule follow-up only after the result is reconciled.

### Ambiguous outcomes

If a request times out after it may have reached Gmail, mark it `unknown_outcome`.

Do not blindly resend. Attempt safe reconciliation where possible or send the item to manual review.

Gmail does not provide a universal idempotency guarantee for message submission, so application-level protection and reconciliation are essential.

### Initial limits

- Sending disabled by default.
- Five automated emails per day as an initial application-level limit.
- A target of 100 newly qualified businesses per month.
- Individual approval required during initial testing.
- Automatic sending enabled only after explicit workflow approval.
- Global pause control available at all times.

These are application safeguards, not statements of Gmail's maximum sending quota.

## 16. Personalization requirements

Every email must contain:

- A verified observation.
- A relevant service.
- A plausible business benefit.
- A concise call to action.
- Accurate company identity.
- An appropriate opt-out mechanism or disclosure where applicable.

Never:

- Invent business features or problems.
- Pretend to have visited the business.
- Fabricate a personal relationship.
- Promise guaranteed results.
- Use deceptive subject lines.
- Continue after a valid opt-out.

Generate plain-text email as the primary format. HTML is optional.

## 17. Follow-up scheduling

Suggested default sequence:

- Day 0: Initial email.
- Day 4: First follow-up, if eligible.
- Day 9: Final follow-up, if eligible.

Before every follow-up, recheck:

- Reply status.
- Opt-out status.
- Bounce and complaint status.
- Manual pause status.
- Workflow approval.
- Current sending limits.
- Applicable channel and contact policies.

Do not send follow-ups after an opt-out, a request for no further contact, a hard bounce or a complaint.

---

# PART H: BACKGROUND JOBS WITHOUT DOCKER

## 18. Job processing design

Use a persistent PostgreSQL job queue rather than in-memory timers.

For the initial workload, process short-running tasks using Next.js server-side modules and scheduled Vercel invocations.

### Job types

- `discover_businesses`
- `research_business`
- `score_lead`
- `generate_draft`
- `send_email`
- `sync_replies`
- `process_followups`
- `refresh_evidence`
- `reconcile_unknown_send`

### Scheduling

Use Vercel Cron to invoke a protected endpoint at configured intervals, subject to the deployed plan's supported scheduling frequency and execution limits.

The endpoint must:

1. Authenticate the scheduled invocation.
2. Claim a bounded number of eligible jobs.
3. Process only work that fits the available execution window.
4. Persist progress and errors.
5. Leave unfinished work queued or safely recoverable.
6. Return promptly rather than attempting to process an unlimited queue.

Use database transactions and atomic job claiming to prevent multiple workers from claiming the same job.

For a low-volume workload, this is preferable to maintaining a separate worker server.

### Execution limits

Vercel functions have finite execution limits, and these depend on configuration and plan.

Do not run large browser sessions, long crawls or unbounded AI calls in a single request.

For work exceeding the available execution window:

- Split it into small, resumable jobs.
- Use a suitable Supabase Edge Function if it fits the task's limits.
- Otherwise use a separate managed worker only when necessary.

The core app must not depend on a permanently running local computer.

### Retry policy

- Exponential backoff with jitter.
- Maximum retry count.
- Error classification.
- Manual-review state for ambiguous outcomes.
- Recovery of abandoned locks.
- Idempotency keys.
- Job heartbeat where appropriate.

Never retry permanent errors indefinitely.

---

# PART I: API AND ROUTE HANDLERS

## 19. Required routes

Use Next.js Route Handlers under `/app/api`.

### Authentication

- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `POST /api/auth/logout`
- `GET /api/auth/session`

### Campaigns

- `GET /api/campaigns`
- `POST /api/campaigns`
- `GET /api/campaigns/[id]`
- `PATCH /api/campaigns/[id]`
- `POST /api/campaigns/[id]/pause`
- `POST /api/campaigns/[id]/resume`

### Discovery

- `POST /api/campaigns/[id]/discover`
- `GET /api/discovery-runs`
- `GET /api/discovery-runs/[id]`
- `POST /api/discovery-runs/[id]/cancel`

### Leads

- `GET /api/businesses`
- `GET /api/businesses/[id]`
- `PATCH /api/businesses/[id]`
- `GET /api/businesses/[id]/evidence`
- `GET /api/businesses/[id]/timeline`
- `POST /api/businesses/[id]/research`
- `POST /api/businesses/[id]/recalculate-score`

### Drafts

- `GET /api/drafts`
- `POST /api/businesses/[id]/drafts`
- `GET /api/drafts/[id]`
- `PATCH /api/drafts/[id]`
- `POST /api/drafts/[id]/approve`
- `POST /api/drafts/[id]/reject`

### Workflows

- `GET /api/workflows`
- `POST /api/workflows`
- `POST /api/workflows/[id]/request-approval`
- `POST /api/workflows/[id]/approve`
- `POST /api/workflows/[id]/pause`
- `POST /api/workflows/[id]/revoke`

### Outreach

- `POST /api/outreach/queue`
- `GET /api/outreach/messages`
- `GET /api/outreach/messages/[id]`
- `POST /api/outreach/messages/[id]/cancel`
- `POST /api/outreach/messages/[id]/retry`

### Suppression

- `GET /api/suppression`
- `POST /api/suppression`
- `DELETE /api/suppression/[id]`

Suppression removal requires owner authorization and a documented reason. Do not automatically remove opt-outs.

### Reporting and operations

- `GET /api/reports/overview`
- `GET /api/reports/campaigns/[id]`
- `GET /api/usage`
- `GET /api/providers`
- `PATCH /api/settings/budgets`
- `POST /api/cron/process-jobs`
- `GET /api/health`

Validate all external payloads. Apply authentication, authorization, rate limits and input validation on every sensitive endpoint.

---

# PART J: USER INTERFACE

## 20. Dashboard

Display:

- Qualified leads this month.
- Progress toward the 100-lead target.
- Businesses discovered.
- Research jobs pending or failed.
- Drafts awaiting approval.
- Emails sent.
- Replies and positive replies.
- Meetings or demos booked.
- Bounce and suppression counts.
- Estimated and actual API spend.
- Available quota information.

Do not count generated records as qualified leads unless they meet the qualification rules.

## 21. Campaign builder

Fields:

- Campaign name.
- Geography.
- Industry.
- Search terms.
- Services offered.
- Monthly target.
- Qualification threshold.
- Enabled providers.
- Research depth.
- Maximum discovery spend.
- Campaign status.

Show estimated usage and potential costs before execution.

## 22. Lead explorer

Filters:

- Qualification score.
- City and category.
- Contact availability.
- Research status.
- Evidence confidence.
- Outreach status.
- Last contact date.
- Follow-up due.
- Suppression status.

Display the strongest verified opportunity and the next action for each lead.

## 23. Business research page

Show:

- Business profile.
- Official website.
- Sources and timestamps.
- Pages inspected.
- Verified and uncertain findings.
- Recommended services.
- Score breakdown.
- Drafts.
- Research errors.
- Outreach timeline.

Allow the owner to correct or reject findings.

## 24. Draft approval queue

Show:

- Recipient and contact source.
- Subject and email preview.
- Personalization evidence.
- Unsupported-claim validation.
- Contact eligibility.
- Sending-policy checks.
- Estimated cost.
- Approve, edit, reject and pause actions.

Unapproved drafts must never enter the sending queue.

## 25. Workflow controls

Display:

- Workflow version.
- Approval status.
- Daily and monthly limits.
- Follow-up cadence.
- Enabled channels.
- Provider status.
- Current pause state.
- Approval history.

Include an obvious global pause button.

## 26. Provider settings

Display:

- Connected Gmail account.
- AI provider configuration.
- Discovery provider configuration.
- Credential connection status.
- Provider usage.
- Free-quota information where available.
- Budget limits.
- Last successful request.
- Sanitized errors.

Never reveal saved secrets in the UI.

---

# PART K: SECURITY, COMPLIANCE AND PRIVACY

## 27. Environment variables

Create `.env.example` containing safe placeholders.

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

SESSION_SECRET=
ENCRYPTION_KEY=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

AI_PROVIDER=
AI_API_KEY=

DISCOVERY_PROVIDER=
DISCOVERY_API_KEY=

CRON_SECRET=

ENABLE_AUTOMATED_SENDING=false
DAILY_SEND_LIMIT=5
MONTHLY_NEW_LEAD_TARGET=100
MAX_PAGES_PER_RESEARCH_RUN=5
MAX_MONTHLY_SPEND_INR=0
```

Use only the environment variables actually needed by the chosen providers.

Rules:

- Never hardcode secrets.
- Never expose service-role keys in client-side code.
- Use deployment secrets in Vercel.
- Keep `.env` out of Git.
- Validate configuration at startup.
- Encrypt OAuth credentials at rest.
- Rotate and revoke credentials when needed.
- Never place credentials in URLs or logs.

### Supabase client separation

Create separate modules for:

1. Browser Supabase client using public credentials.
2. Server-side authenticated Supabase client using the user's session.
3. Privileged server-only client where required.

The privileged client must never be imported into client components.

## 28. Web security

Implement:

- HTTPS in production.
- Secure session cookies.
- CSRF protection for state-changing requests where applicable.
- OAuth state validation and PKCE where supported.
- Content Security Policy.
- API rate limiting.
- Input validation.
- Parameterized database access.
- Output escaping.
- Secure CSV export.
- SSRF protection.
- Dependency vulnerability scanning.
- Database backups and restore tests.
- Sanitized audit logging.

A Vercel cron endpoint must require a secret or another robust authentication mechanism. It must not be publicly callable without authorization.

For website fetching, enforce restrictions at the connection level. A URL validator alone is not sufficient protection against SSRF.

## 29. Compliance

Before activating production outreach, implement checks for:

- Applicable Indian data-protection requirements, including the DPDP Act and applicable rules and commencement provisions.
- Requirements in other recipient jurisdictions.
- Permitted purposes for each contact source.
- Provider terms and data-retention restrictions.
- Email identification and opt-out requirements.
- Contact correction, deletion and suppression requests.
- Vendor and subprocessor data handling.
- Platform restrictions on unsolicited messaging.
- Required business identity and disclosures.

The application must support country-specific policies.

When the eligibility of a contact is uncertain, set `review_required` and block automatic sending.

## 30. Retention

- Keep contact information only for a documented purpose and appropriate period.
- Expire stale findings and revalidate before using them in new outreach.
- Respect provider-specific storage restrictions.
- Delete or anonymize data when appropriate.
- Preserve minimum suppression information needed to honor opt-outs.
- Avoid retaining unnecessary personal data in logs.
- Document retention periods and deletion behavior.

---

# PART L: COSTS AND BUDGETS

## 31. Cost categories

| Component | Cost treatment |
|---|---|
| Next.js and TypeScript | Open-source software |
| Vercel | Hosting plan limits and usage restrictions apply |
| Supabase | Database, authentication and usage limits depend on the selected plan |
| PostgreSQL | Included through Supabase within plan limits |
| Website parsing libraries | Open-source software |
| Business discovery APIs | Provider-specific quotas and pricing |
| AI APIs | Provider-specific free tiers or paid usage |
| Local or self-hosted AI | No per-token API fee, but computing costs remain |
| Gmail API | API availability and quotas are separate from Workspace sending limits |
| Domain and Google Workspace | Existing subscription costs, if applicable |
| Optional browser rendering | May require additional infrastructure |
| WhatsApp API | Provider and platform charges may apply |

Do not promise that the entire deployed application will remain free indefinitely.

## 32. Budget enforcement

Implement a centralized budget service.

Before every paid or quota-limited operation:

1. Estimate the cost.
2. Check daily and monthly limits.
3. Reserve budget transactionally.
4. Execute the request.
5. Record usage.
6. Reconcile the estimate against actual usage where available.
7. Stop or defer operations if the budget is exhausted.

Requirements:

- Global spend cap.
- Per-provider cap.
- Per-campaign cap.
- Monthly reset.
- Quota warning thresholds.
- Token limits.
- No automatic paid fallback unless explicitly enabled.
- Default additional spend cap of ₹0.
- Clear distinction between unknown quota and unlimited quota.

Maintain a provider registry with:

- Provider name.
- Operation.
- Published quota.
- Quota reset period.
- Pricing source URL.
- Currency.
- Last reviewed date.
- Billing-enabled status.
- User-configured maximum.
- Free-tier availability status.

Do not hardcode advertised free quotas as permanent facts.

---

# PART M: TESTING AND RELIABILITY

## 33. Automated tests

### Discovery

Test:

- Duplicate businesses.
- Same name in different cities.
- Missing websites.
- Provider timeouts.
- Rate-limit responses.
- Invalid responses.
- Retention restrictions.
- Monthly target already reached.

### Research

Test:

- Normal HTML.
- Broken links.
- Missing menu.
- Robots.txt disallow.
- Redirect loops.
- Private IP targets.
- DNS rebinding simulations.
- Metadata endpoint targets.
- Oversized responses.
- Malicious webpage instructions.
- Stale evidence.
- Contradictory findings.

### AI

Test:

- Invalid structured output.
- Missing evidence IDs.
- Hallucinated claims.
- Low-confidence findings.
- Provider timeouts.
- Token budget exhaustion.
- Unsupported service recommendations.

### Outreach

Test:

- Approved draft.
- Unapproved workflow.
- Revoked workflow.
- Workflow changed after approval.
- Suppressed contact.
- Duplicate send request.
- Gmail timeout after submission.
- Gmail rate-limit response.
- Hard bounce.
- Reply before follow-up.
- Opt-out before follow-up.
- Budget exhaustion.
- Expired OAuth credentials.

### Supabase security

Test:

- Unauthenticated requests.
- Unauthorized row access.
- Attempts to change roles.
- Attempts to approve a workflow through direct database updates.
- Attempts to mark messages sent from the client.
- Service-role key exposure.
- SQL injection.
- XSS in business names.
- Unauthorized exports.
- Cron endpoint without a valid secret.

### Expected behavior

- Suppressed contacts never receive messages.
- Duplicate job execution cannot create duplicate sends.
- Unknown send outcomes require reconciliation.
- Budget exhaustion blocks paid operations.
- Invalid AI findings are rejected or sent to review.
- RLS blocks unauthorized data access.
- Secrets remain protected.
- Provider errors are visible and recoverable.

## 34. Acceptance criteria

### Functional

- User can authenticate.
- User can create a campaign.
- Discovery can retrieve permitted business records.
- Deduplication works across repeated runs.
- Evidence can be inspected.
- Lead scores are explainable.
- AI drafts reference real evidence.
- Gmail OAuth can connect and disconnect.
- Sending is disabled by default.
- Workflow approval gates sending.
- Suppression is checked before every send.
- Follow-ups stop after replies, opt-outs and hard bounces.
- Usage and costs are visible.

### Reliability

- Background jobs survive Vercel function termination.
- Job claims are atomic.
- Duplicate requests cannot blindly resend messages.
- Database migrations run successfully.
- Budget exhaustion stops paid operations.
- Failed jobs can be inspected and retried safely.
- Database backups can be restored.

### Security

- No committed secrets.
- RLS is enabled on exposed tables.
- OAuth tokens are encrypted at rest.
- Website fetching enforces SSRF protections.
- Production traffic uses HTTPS.
- Audit logs capture approvals and sending actions.
- Global pause works.

### Performance

Initial targets:

- Dashboard reads: p95 under 500 ms, excluding external calls.
- Research and discovery execute asynchronously.
- Paginated queries use appropriate indexes.
- 100 qualified leads per month supported without architectural changes.
- External requests have explicit timeouts.
- Job processing stays within deployed function limits.

These are targets to measure, not guarantees across all plans.

---

# PART N: SETUP AND DEPLOYMENT

## 35. Development prerequisites

Install:

- Git.
- Node.js LTS.
- npm or the selected package manager.
- A Supabase account.
- A Vercel account.
- A Google Cloud project for Gmail OAuth.
- Optional discovery and AI provider accounts.

Docker is not required.

## 36. Local development setup

1. Clone the repository.
2. Install Node dependencies.
3. Create a Supabase project.
4. Copy `.env.example` to `.env.local`.
5. Add the Supabase project URL and public key.
6. Configure server-only secrets.
7. Run the committed database migrations using the Supabase CLI or the Supabase SQL editor.
8. Create the initial owner account.
9. Configure the Google OAuth consent screen and redirect URI.
10. Run the Next.js development server.
11. Run unit and integration tests.
12. Use mocked providers until real integrations have passed their tests.
13. Create a synthetic test campaign.
14. Verify the research and draft workflow before enabling sending.

The README must provide the exact commands and required versions.

Do not require a local PostgreSQL server or Redis instance.

If local Supabase emulation is optional, document it separately. The core application must also be testable against a hosted Supabase development project.

## 37. Vercel deployment

1. Push the repository to GitHub.
2. Import the repository into Vercel.
3. Configure the project root and build settings.
4. Add required environment variables.
5. Configure the production Supabase URL and public key.
6. Add server-only Supabase credentials.
7. Configure Gmail OAuth callback URLs.
8. Configure the production application URL.
9. Deploy a preview build.
10. Run authentication and RLS tests.
11. Test discovery with a permitted provider.
12. Test Gmail sending with an approved test recipient.
13. Configure Vercel Cron and its authentication secret.
14. Verify the scheduled job dispatcher.
15. Deploy to production with automated sending disabled.
16. Enable sending only after the acceptance criteria pass.

Use separate Supabase projects for development and production when practical.

Never run destructive migrations against production without a backup and a reviewed migration plan.

## 38. Supabase setup

Document:

- Project creation.
- Database migrations.
- Auth configuration.
- Redirect URL configuration.
- RLS policies.
- Index creation.
- Secrets and privileged access.
- Backup and recovery.
- Development versus production separation.
- Data retention and deletion.

If Supabase Edge Functions are used, deploy them through the Supabase CLI without introducing Docker as a project requirement.

## 39. Production operations

Provide:

- Health checks.
- Error monitoring.
- Job status monitoring.
- Database backup instructions.
- Restore procedure.
- Migration and rollback instructions.
- Secret rotation instructions.
- Gmail credential revocation instructions.
- Provider quota and budget dashboards.
- Emergency global pause procedure.

If a free hosting plan cannot provide the required scheduling frequency, execution time or reliability, document that limitation instead of silently introducing an unreliable workaround.

---

# PART O: IMPLEMENTATION PHASES

## 40. Phase 1: Foundation

Build:

- Next.js application.
- Supabase authentication.
- RLS policies.
- Database migrations.
- Campaign and lead management.
- Dashboard.
- Mock discovery provider.

## 41. Phase 2: Discovery

Build:

- Provider interfaces.
- One permitted discovery integration.
- Normalization and deduplication.
- Discovery job queue.
- Usage accounting.
- Provider health status.

## 42. Phase 3: Research

Build:

- Safe HTTP fetching.
- Evidence extraction.
- Research history.
- Finding verification.
- SSRF protection.
- Research job scheduling.

## 43. Phase 4: AI qualification

Build:

- AI provider adapter.
- Structured output validation.
- Service matching.
- Explainable scoring.
- Draft generation.
- Evidence-backed validation.

## 44. Phase 5: Outreach

Build:

- Gmail OAuth.
- Sending queue.
- Workflow approval.
- Suppression.
- Idempotency.
- Daily and monthly limits.
- Budget gates.
- Send reconciliation.

## 45. Phase 6: Follow-ups and reporting

Build:

- Reply synchronization where authorized.
- Follow-up scheduling.
- Conversion tracking.
- Usage reporting.
- Audit history.
- Campaign analytics.

## 46. Phase 7: Hardening

Complete:

- RLS and authorization tests.
- SSRF tests.
- Provider failure simulations.
- Backup and restore tests.
- Vercel deployment.
- Supabase production configuration.
- Controlled launch.

Do not enable production sending until discovery, research, retention controls and budget enforcement work correctly.

---

# PART P: CODING-AGENT BUILD PROMPT

You are a senior full-stack engineer, Supabase specialist, Next.js engineer, AI systems engineer and application security engineer.

Build Evee as a production-oriented web application using **Next.js, TypeScript, Supabase and Vercel**.

## Mandatory technology restrictions

- Do not use Docker.
- Do not introduce Docker Compose.
- Do not build a separate FastAPI backend.
- Do not require a self-managed PostgreSQL server.
- Do not require Redis or Celery.
- Use Supabase PostgreSQL as the persistent database.
- Use Supabase Auth and Row Level Security.
- Use Next.js Route Handlers and server-side modules for application logic.
- Use Vercel for web deployment and supported scheduled functions.
- Use a persistent database-backed job queue.
- Use Supabase Edge Functions only where appropriate for the execution requirements.

## Working rules

1. Inspect the existing repository before modifying it.
2. If it is empty, scaffold the required project.
3. Preserve existing working code where practical.
4. Write a concise implementation plan.
5. Implement a working vertical slice first.
6. Continue through the implementation phases.
7. Run tests, linting and type checks after each major phase.
8. Fix failures instead of merely documenting them.
9. Never claim a test passed unless it actually ran.
10. Use mocked providers for local development.
11. Do not silently replace a real provider with a mock in production.
12. Pin compatible dependency versions.
13. Document unresolved provider requirements.
14. Keep integrations behind provider interfaces.
15. Keep discovery, research, drafting and sending separate.
16. Implement least privilege and fail-closed safety checks.
17. Do not overengineer the application.
18. Never expose privileged Supabase credentials in browser code.

## Required deliverables

Implement:

- Next.js dashboard.
- Supabase authentication.
- PostgreSQL schema and migrations.
- RLS policies.
- Campaign management.
- Provider registry.
- At least one permitted real discovery integration when credentials are available.
- Mock discovery provider.
- Deduplication.
- Safe website research.
- Evidence records.
- AI qualification.
- Explainable lead scoring.
- Personalized email drafts.
- Gmail OAuth.
- Controlled email sending.
- Versioned workflow approvals.
- Suppression management.
- Database-backed background jobs.
- Vercel Cron integration.
- Follow-up scheduler.
- Budget and quota tracking.
- Audit logging.
- Health checks.
- Unit, integration, security and end-to-end tests.
- `.env.example`.
- README and deployment documentation.

## Non-negotiable safety behavior

- Sending defaults to disabled.
- Workflow approval is required before sending.
- The approved version must match the active configuration.
- Recipient eligibility and suppression are checked immediately before sending.
- Every factual personalization claim must be backed by evidence or removed.
- Website content is untrusted data.
- SSRF protections are enforced.
- Duplicate-send protection uses persistent database state.
- Timeouts do not trigger blind resends.
- Unknown send outcomes go to reconciliation or manual review.
- Provider failures have bounded retries.
- Budget exhaustion blocks paid operations.
- Unknown quotas are not treated as unlimited.
- Source-specific retention restrictions are enforced.
- Unapproved social messaging integrations remain disabled.
- Secrets never appear in frontend bundles, Git, URLs or logs.

## Supabase-specific requirements

- Use the official Supabase SSR integration for Next.js.
- Create separate browser and server clients.
- Keep service-role operations server-only.
- Enable RLS on all exposed application tables.
- Test policies with unauthorized sessions.
- Prevent direct client manipulation of workflow approvals and send statuses.
- Use database constraints for deduplication and idempotency.
- Use atomic job claiming and transaction-safe budget reservations.
- Commit migrations to the repository.
- Provide a repeatable development setup.

## Vercel-specific requirements

- Keep server-side work within configured function limits.
- Process jobs in bounded batches.
- Use Vercel Cron only within the supported limits of the selected plan.
- Secure cron endpoints.
- Persist job state in PostgreSQL.
- Ensure function termination does not corrupt job state.
- Avoid in-memory scheduling as the sole mechanism.
- Document any features that require a paid plan.
- Never claim the free tier supports a capability without verifying its current limits.

## AI requirements

Use structured output validation.

AI may propose findings and draft copy but must not control sending permissions, credentials, suppression state or budgets.

Distinguish verified facts, uncertain observations and inferences.

Reject unsupported claims and route ambiguous cases to human review.

## Budget requirements

Default the additional monthly spend cap to ₹0.

Implement configurable:

- Provider quotas.
- Daily and monthly budgets.
- Campaign budgets.
- Token limits.
- Discovery limits.
- Research page limits.
- Daily email limits.
- Monthly lead targets.

Do not activate a paid fallback unless the owner explicitly enables it.

## Final deliverables

At completion, provide:

1. Working source code.
2. Database migrations.
3. `.env.example`.
4. Exact local development commands.
5. Supabase setup instructions.
6. Vercel deployment instructions.
7. Gmail OAuth setup instructions.
8. API documentation.
9. Security and compliance documentation.
10. Test results showing what actually ran.
11. Required external credentials.
12. Integrations still using mocks.
13. Known limitations and plan-dependent features.
14. A production launch checklist.
15. A demonstration using synthetic data.

## Definition of done

A user must be able to sign in, create a campaign, discover permitted businesses, research them, inspect evidence, score leads, generate personalized drafts, approve a workflow, connect Gmail and send a test message only after all safety checks pass.

The application must remain in safe draft-only mode until the owner explicitly approves an eligible workflow.

Begin by inspecting the repository and creating an implementation plan. Then build and test the first working vertical slice before continuing through the remaining phases.

Do not stop after producing a plan or scaffolding. Continue until the acceptance criteria pass or a concrete external blocker is identified.
