import { describe, it, expect } from 'vitest';

describe('Sent Outreach & Contacted Registry Deduplication', () => {
  it('normalizes emails for duplicate comparison across case and whitespace', () => {
    const normalizeEmail = (e: string) => e.trim().toLowerCase();
    const sentSet = new Set<string>(['founder@startup.io', 'sales@bakery.in']);

    expect(sentSet.has(normalizeEmail('  Founder@Startup.io  '))).toBe(true);
    expect(sentSet.has(normalizeEmail('SALES@BAKERY.IN'))).toBe(true);
    expect(sentSet.has(normalizeEmail('other@company.com'))).toBe(false);
  });

  it('filters out already contacted leads when skipPreviouslyContacted is enabled', () => {
    const existingSentEmails = new Set<string>(['alice@alpha.com', 'bob@beta.org']);

    const batch = [
      { email: 'alice@alpha.com', company: 'Alpha Inc' },
      { email: 'charlie@gamma.co', company: 'Gamma LLC' },
      { email: 'bob@beta.org', company: 'Beta Corp' },
      { email: 'diana@delta.io', company: 'Delta IO' },
    ];

    const queued: any[] = [];
    const skipped: any[] = [];

    for (const prospect of batch) {
      const email = prospect.email.trim().toLowerCase();
      if (existingSentEmails.has(email)) {
        skipped.push({ email, reason: 'previously_contacted' });
      } else {
        queued.push(prospect);
        existingSentEmails.add(email);
      }
    }

    expect(queued.length).toBe(2);
    expect(skipped.length).toBe(2);
    expect(queued.map((q) => q.email)).toEqual(['charlie@gamma.co', 'diana@delta.io']);
    expect(skipped.map((s) => s.email)).toEqual(['alice@alpha.com', 'bob@beta.org']);
  });

  it('prevents accidental intra-batch duplicate dispatches when CSV has repeated rows', () => {
    const contactedEmails = new Set<string>();

    const rawCsvRows = [
      { email: 'founder@apex.com', name: 'Lead 1' },
      { email: 'founder@apex.com', name: 'Lead 1 Duplicate' },
      { email: 'info@summit.com', name: 'Lead 2' },
      { email: 'FOUNDER@APEX.COM', name: 'Lead 1 Duplicate Caps' },
    ];

    const toDispatch: any[] = [];
    const duplicatesSkipped: any[] = [];

    for (const row of rawCsvRows) {
      const email = row.email.trim().toLowerCase();
      if (contactedEmails.has(email)) {
        duplicatesSkipped.push(row);
      } else {
        toDispatch.push(row);
        contactedEmails.add(email);
      }
    }

    expect(toDispatch.length).toBe(2);
    expect(duplicatesSkipped.length).toBe(2);
    expect(toDispatch.map((t) => t.email.toLowerCase())).toEqual(['founder@apex.com', 'info@summit.com']);
  });

  it('matches sent businesses by general business email or contact email', () => {
    const sentEmails = new Set<string>(['contact@marriott.com', 'sales@providenthousing.com']);
    const sentBusinessIds = new Set<string>(['biz-123']);

    const isLeadSent = (b: any): boolean => {
      if (!b) return false;
      if (sentBusinessIds.has(b.id)) return true;
      const em = b.general_business_email?.toLowerCase().trim();
      if (em && sentEmails.has(em)) return true;
      if (b.contacts && Array.isArray(b.contacts)) {
        return b.contacts.some((c: any) => c.email && sentEmails.has(c.email.toLowerCase().trim()));
      }
      return false;
    };

    const biz1 = { id: 'biz-1', general_business_email: 'contact@marriott.com' };
    const biz2 = { id: 'biz-123', general_business_email: 'newemail@test.com' };
    const biz3 = { id: 'biz-3', general_business_email: 'uncontacted@example.com', contacts: [{ email: 'sales@providenthousing.com' }] };
    const biz4 = { id: 'biz-4', general_business_email: 'clean@brand.com', contacts: [{ email: 'hello@brand.com' }] };

    expect(isLeadSent(biz1)).toBe(true);
    expect(isLeadSent(biz2)).toBe(true);
    expect(isLeadSent(biz3)).toBe(true);
    expect(isLeadSent(biz4)).toBe(false);
  });
});
