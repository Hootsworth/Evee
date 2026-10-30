-- Evee Synthetic Development Seed Data
-- Clearly labeled as mock/synthetic data for development and testing

-- 1. Insert Initial Operator Profile
INSERT INTO profiles (id, display_name, role, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'Aditya Dixit (Operator)', 'owner', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Standard Workflow
INSERT INTO outreach_workflows (id, name, version, status, configuration, approved_by, approved_at)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  'Conservative Small Business Outreach (v1)',
  1,
  'approved',
  '{"daily_limit": 5, "monthly_limit": 100, "followup_intervals_days": [4, 9], "require_manual_review_for_uncertain_evidence": true, "require_contact_verification": true, "auto_send_enabled": false}',
  '00000000-0000-0000-0000-000000000001',
  timezone('utc', now())
) ON CONFLICT (id) DO NOTHING;

-- 3. Insert Campaign
INSERT INTO campaigns (id, name, target_geographies, target_industries, search_terms, services_to_promote, monthly_target, daily_discovery_limit, qualification_threshold, status, created_by)
VALUES (
  '00000000-0000-0000-0000-000000000020',
  'Bengaluru Cafes & Boutique Clinics (Q4)',
  '["Bengaluru", "Indiranagar", "Koramangala"]'::jsonb,
  '["Cafes & Bakeries", "Dental & Wellness Clinics"]'::jsonb,
  '["bakery", "artisan cafe", "dental aesthetics"]'::jsonb,
  '["Digital QR Menu", "Online Booking Workflow", "Mobile-Friendly Website"]'::jsonb,
  100,
  20,
  65,
  'active',
  '00000000-0000-0000-0000-000000000001'
) ON CONFLICT (id) DO NOTHING;

-- 4. Insert Discovered Businesses (Synthetic Demo Data)
INSERT INTO businesses (id, normalized_name, display_name, business_type, country_code, region, city, official_website_url, canonical_domain, public_business_phone, general_business_email, identity_confidence, record_status)
VALUES
(
  '00000000-0000-0000-0000-000000000101',
  'the artisan crust bakery cafe',
  'The Artisan Crust Bakery & Cafe [DEMO SEED]',
  'Bakery & Cafe',
  'IN',
  'Karnataka',
  'Bengaluru',
  'https://artisancrust.example.com',
  'artisancrust.example.com',
  '+91 98765 43210',
  'hello@artisancrust.example.com',
  1.0,
  'active'
),
(
  '00000000-0000-0000-0000-000000000102',
  'sutra dental care aesthetics',
  'Sutra Dental Care & Aesthetics [DEMO SEED]',
  'Dental Clinic',
  'IN',
  'Karnataka',
  'Bengaluru',
  'https://sutradental.example.com',
  'sutradental.example.com',
  '+91 98111 22334',
  'care@sutradental.example.com',
  1.0,
  'active'
) ON CONFLICT (id) DO NOTHING;

-- 5. Contacts
INSERT INTO contacts (id, business_id, contact_name, job_title, email_address, email_normalized, contact_channel, contact_type, verification_status, contact_eligibility)
VALUES
(
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000101',
  'Rohan Mehta',
  'General Manager',
  'hello@artisancrust.example.com',
  'hello@artisancrust.example.com',
  'email',
  'general_business',
  'syntax_valid',
  'eligible'
),
(
  '00000000-0000-0000-0000-000000000202',
  '00000000-0000-0000-0000-000000000102',
  'Dr. Ananya Rao',
  'Lead Dentist & Clinic Owner',
  'care@sutradental.example.com',
  'care@sutradental.example.com',
  'email',
  'published_executive',
  'syntax_valid',
  'eligible'
) ON CONFLICT (id) DO NOTHING;

-- 6. Empirical Evidence Items
INSERT INTO evidence_items (id, business_id, source_url, source_type, finding_type, claim_text, supporting_excerpt, confidence, verification_status)
VALUES
(
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000101',
  'https://artisancrust.example.com',
  'website_inspection',
  'NO_MENU_FOUND_ON_INSPECTED_PAGES',
  'No interactive digital menu found on inspected pages; patrons cannot preview daily bakery items on mobile.',
  'Welcome to Artisan Crust Bakery. Visit our store in Indiranagar.',
  0.95,
  'verified'
),
(
  '00000000-0000-0000-0000-000000000302',
  '00000000-0000-0000-0000-000000000102',
  'https://sutradental.example.com',
  'website_inspection',
  'BOOKING_LINK_FAILED',
  'Appointment request link leads to an unconfigured form without real-time booking confirmation.',
  'Schedule a consultation today.',
  0.90,
  'verified'
) ON CONFLICT (id) DO NOTHING;

-- 7. Lead Scores (Deterministic 100 pt model)
INSERT INTO lead_scores (id, business_id, campaign_id, score_version, fit_score, need_score, contactability_score, service_match_score, final_score, reason_codes)
VALUES
(
  '00000000-0000-0000-0000-000000000401',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000020',
  'v1',
  30, 25, 12, 20, 87,
  '["HIGH_BUSINESS_FIT", "NO_MENU_FOUND_ON_INSPECTED_PAGES", "STRONG_SERVICE_MATCH", "QUALIFIED_LEAD"]'::jsonb
),
(
  '00000000-0000-0000-0000-000000000402',
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000020',
  'v1',
  30, 25, 12, 20, 87,
  '["HIGH_BUSINESS_FIT", "BOOKING_LINK_FAILED", "STRONG_SERVICE_MATCH", "QUALIFIED_LEAD"]'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- 8. Email Drafts (Pending Review)
INSERT INTO email_drafts (id, business_id, contact_id, campaign_id, subject, body_text, personalization_summary, evidence_item_ids, model_provider, model_name, validation_status, approval_status)
VALUES
(
  '00000000-0000-0000-0000-000000000501',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000020',
  'Quick observation regarding The Artisan Crust Bakery''s online menu setup',
  E'Hi Rohan,\n\nI was looking at The Artisan Crust Bakery & Cafe in Bengaluru and noticed that your website currently lacks an interactive digital menu for customers previewing items on mobile.\n\nWe recently helped similar cafes in Indiranagar set up a lightweight Digital QR Menu system that lets staff update daily specials in real time and cuts ordering delays.\n\nWould you be open to a brief 5-minute preview sometime next week?\n\nBest regards,\nEvee Team\n\nTo opt out of future emails, reply with ''unsubscribe''.',
  'Referenced verified finding: No interactive digital menu found on inspected pages.',
  '["00000000-0000-0000-0000-000000000301"]'::jsonb,
  'mock-ai',
  'gpt-4o-mini',
  'valid',
  'pending'
) ON CONFLICT (id) DO NOTHING;
