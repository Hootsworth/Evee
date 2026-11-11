import { describe, it, expect } from 'vitest';
import {
  escapeCsvCell,
  generateCsvString,
  exportLeadsToCsv,
  LeadExportRow,
} from '@/lib/csv/exporter';
import { parseAndAnalyzeCsv } from '@/lib/csv/parser';

describe('CSV Exporter & Lead Download Pipeline', () => {
  describe('escapeCsvCell', () => {
    it('escapes cells containing commas, quotes, and newlines per RFC 4180', () => {
      expect(escapeCsvCell('Acme, Inc.')).toBe('"Acme, Inc."');
      expect(escapeCsvCell('The "Best" Coffee')).toBe('"The ""Best"" Coffee"');
      expect(escapeCsvCell("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
    });

    it('neutralizes spreadsheet formula injection threats', () => {
      // Excel/Sheets formula triggers (=, +, -, @, \t, \r)
      expect(escapeCsvCell('=CMD("calc.exe")')).toBe('"\'=CMD(""calc.exe"")"');
      expect(escapeCsvCell('+12345')).toBe('\'+12345');
      expect(escapeCsvCell('-SUM(A1:B10)')).toBe('\'-SUM(A1:B10)');
      expect(escapeCsvCell('@SUM(A1:A5)')).toBe('\'@SUM(A1:A5)');
    });

    it('handles null, undefined, and primitive types gracefully', () => {
      expect(escapeCsvCell(null)).toBe('');
      expect(escapeCsvCell(undefined)).toBe('');
      expect(escapeCsvCell(42)).toBe('42');
      expect(escapeCsvCell(0)).toBe('0');
      expect(escapeCsvCell(false)).toBe('false');
    });
  });

  describe('generateCsvString', () => {
    it('generates CRLF-delimited CSV with UTF-8 BOM', () => {
      const headers = ['Name', 'Role'];
      const rows = [
        ['Alice', 'Founder'],
        ['Bob', 'Engineer'],
      ];
      const csv = generateCsvString(headers, rows);

      // Begins with UTF-8 BOM
      expect(csv.startsWith('\uFEFF')).toBe(true);

      // Uses standard CRLF lines
      const clean = csv.replace('\uFEFF', '');
      const lines = clean.split('\r\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('Name,Role');
      expect(lines[1]).toBe('Alice,Founder');
      expect(lines[2]).toBe('Bob,Engineer');
    });
  });

  describe('exportLeadsToCsv', () => {
    const mockLeads: LeadExportRow[] = [
      {
        id: 'biz_001',
        display_name: 'Apex Robotics, Inc.',
        business_type: 'Industrial Automation',
        official_website_url: 'https://apexrobotics.ai',
        general_business_email: 'hello@apexrobotics.ai',
        public_business_phone: '+1 617-555-0199',
        city: 'Boston',
        region: 'MA',
        country_code: 'US',
        postal_code: '02110',
        identity_confidence: 94,
        record_status: 'active',
        created_at: '2026-10-15T09:30:00Z',
        contacts: [
          {
            contact_name: 'David Vance',
            job_title: 'Chief Technology Officer',
            email: 'david@apexrobotics.ai',
            phone: '+1 617-555-0200',
          },
        ],
      },
      {
        id: 'biz_002',
        display_name: 'Artisan Bakes',
        business_type: 'Bakery & Cafe',
        official_website_url: 'https://artisanbakes.in',
        general_business_email: 'contact@artisanbakes.in',
        public_business_phone: '+91 80 5555 1234',
        city: 'Bengaluru',
        region: 'Karnataka',
        country_code: 'IN',
        postal_code: '560001',
        identity_confidence: 88,
        record_status: 'active',
        created_at: '2026-10-20T14:15:00Z',
        contacts: [
          {
            contact_name: 'Sunita Rao',
            job_title: 'Owner',
            email: 'sunita@artisanbakes.in',
          },
        ],
      },
    ];

    it('exports all leads with standard fields and contacts', () => {
      const csv = exportLeadsToCsv(mockLeads);
      expect(csv).toContain('Lead ID');
      expect(csv).toContain('Company Name');
      expect(csv).toContain('Primary Contact Name');
      expect(csv).toContain('Primary Contact Email');
      expect(csv).toContain('"Apex Robotics, Inc."');
      expect(csv).toContain('David Vance');
      expect(csv).toContain('david@apexrobotics.ai');
      expect(csv).toContain('Artisan Bakes');
      expect(csv).toContain('Sunita Rao');
    });

    it('accurately reports outreach sent status when matching sent email or business ID', () => {
      const sentEmailSet = new Set(['david@apexrobotics.ai']);
      const sentBusinessIdSet = new Set(['biz_001']);

      const csv = exportLeadsToCsv(mockLeads, { sentEmailSet, sentBusinessIdSet });

      // Apex should be marked as Sent, Artisan Bakes as Uncontacted
      expect(csv).toContain('Sent');
      expect(csv).toContain('Uncontacted');
    });

    it('integrates partner allotments into the export', () => {
      const allotments = {
        biz_002: {
          partnerName: 'Acme Partners',
          partnerEmail: 'agent@acme.com',
        },
      };

      const csv = exportLeadsToCsv(mockLeads, { allotments });
      expect(csv).toContain('Acme Partners (agent@acme.com)');
    });

    it('performs full round-trip: export leads and re-parse with CSV parser', () => {
      const csv = exportLeadsToCsv(mockLeads);
      const parsed = parseAndAnalyzeCsv(csv);

      expect(parsed.rows.length).toBe(2);
      expect(parsed.validEmailCount).toBeGreaterThanOrEqual(2);

      const firstRow = parsed.rows[0];
      expect(firstRow['Company Name']).toBe('Apex Robotics, Inc.');
      expect(firstRow['City']).toBe('Boston');
      expect(firstRow['Primary Contact Name']).toBe('David Vance');
    });
  });
});
