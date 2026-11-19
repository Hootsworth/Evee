# Evee B2B Workspace Roadmap

## Product direction

Evee should become the place a B2B team coordinates and completes its day-to-day work: understand an account, decide what needs to happen, collaborate on the work, execute it through connected tools, and keep a reliable record of the outcome. Email outreach remains one useful workflow inside that workspace, rather than the product's boundary.

The guiding unit should be a **work item** linked to an organization, account, people, files, and activity. Different work types can then share ownership, status, due dates, approvals, automations, and audit history without forcing every job into an email campaign.

## Starting point

Evee already has prospect and business records, contact enrichment, evidence-backed research and scoring, draft review, approved outreach workflows, controlled email dispatch, partner lead allocation, reporting, and organization-scoped data. These provide the base for a broader workspace, but the current experience is still organized around prospecting and outreach.

## Roadmap

### 1. Make the current workspace dependable

- Close reliability gaps in tenant and partner scoping, record ownership, and allocation visibility.
- Establish one canonical account/contact model and consistent API contracts.
- Add a unified activity timeline for research, edits, assignments, approvals, messages, and outcomes.
- Make imports, exports, retries, and background jobs observable and recoverable.
- Define role-based access for operators, managers, and external partners.

**Outcome:** teams can trust the records and history that future workflows will share.

### 2. Introduce work items and shared workflow building blocks

- Add reusable work items with type, owner, collaborators, status, priority, due date, and linked records.
- Support comments, mentions, checklists, attachments, and approval steps.
- Build configurable workflow templates with triggers, conditions, actions, and human review gates.
- Provide queues, personal task lists, team views, and an activity feed.
- Keep automation fail-closed for consequential actions, with clear approval and audit records.

**Outcome:** teams can coordinate work beyond email using a common system of record.

### 3. Expand account and revenue workflows

- Add account plans, relationship maps, meeting notes, and next-step tracking.
- Support inbound lead intake, qualification, routing, and follow-up SLAs.
- Add opportunity stages, deal risks, handoffs, and forecast views.
- Create proposals and follow-up packs from approved account data and reusable templates.
- Track outcomes such as replies, meetings, qualified opportunities, and closed revenue.

**Outcome:** Evee supports the journey from first signal through active deal coordination.

### 4. Add cross-functional B2B operations

- Offer customer onboarding plans with milestones, owners, dependencies, and customer-facing checklists.
- Support renewal and account-health reviews, escalation handling, and success plans.
- Add vendor, partner, and procurement workflows with document collection and approvals.
- Provide lightweight service requests and internal handoffs tied to the customer account.
- Reuse the same work-item and approval model instead of creating disconnected mini-apps.

**Outcome:** teams can run repeatable customer and partner operations in the same workspace.

### 5. Connect the tools teams already use

- Add calendar and meeting synchronization, then CRM and document storage integrations.
- Add configurable webhooks and a documented API for events and workflow actions.
- Let admins map fields, control sync direction, and inspect sync errors.
- Keep a clear source of truth and show provenance for imported or AI-generated data.

**Outcome:** Evee coordinates work across the existing stack without hiding where data came from.

### 6. Make Evee an accountable work copilot

- Let users ask questions across their authorized accounts, work items, and activity history.
- Turn requests into proposed plans, drafts, and task updates that users can review.
- Add role-aware recommendations for next actions, stalled work, and missing information.
- Require confirmation for external communication, financial commitments, and material record changes.
- Measure quality through completion, correction, and outcome metrics rather than message volume.

**Outcome:** Evee helps teams complete work while keeping people in control of important decisions.

## Suggested sequencing and success measures

Prioritize phases 1 and 2 before adding many new workflow categories. Measure record accuracy, assignment correctness, time to recover failed jobs, work-item completion time, overdue work, handoff delays, and user corrections. For outreach, continue measuring replies and qualified outcomes alongside deliverability and approval rates.

## Product boundaries

“Any B2B work” is a direction, not a promise to build an unbounded suite at once. Start with one shared work model, then expand into adjacent jobs where teams need coordination, approvals, records, and measurable outcomes. Keep data access tenant-scoped, make automation inspectable, and preserve human approval for high-impact actions.
