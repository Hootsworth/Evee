// Evee - Lightweight, Secure, RFC 4180-Compliant CSV Exporter
// Features: RFC 4180 cell quoting, formula injection protection, UTF-8 BOM, and browser download trigger

export interface LeadExportRow {
  id?: string;
  display_name?: string | null;
  normalized_name?: string | null;
  business_type?: string | null;
  official_website_url?: string | null;
  canonical_domain?: string | null;
  general_business_email?: string | null;
  public_business_phone?: string | null;
  city?: string | null;
  region?: string | null;
  country_code?: string | null;
  postal_code?: string | null;
  identity_confidence?: number;
  record_status?: string | null;
  outreach_sent?: boolean;
  sent?: boolean;
  allotted_partner?: string | null;
  contacts?: Array<{
    id?: string;
    contact_name?: string | null;
    job_title?: string | null;
    role?: string | null;
    email_address?: string | null;
    email?: string | null;
    phone?: string | null;
    [key: string]: any;
  }>;
  lead_scores?: Array<{
    final_score?: number;
    fit_score?: number;
    [key: string]: any;
  }>;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface CsvExportOptions {
  includeContacts?: boolean;
  includeScores?: boolean;
  includeAllotment?: boolean;
  includeSentStatus?: boolean;
  allotments?: Record<string, { partnerName?: string; partnerEmail?: string }>;
  sentEmailSet?: Set<string>;
  sentBusinessIdSet?: Set<string>;
  columns?: string[];
}

/**
 * Escapes a single cell compliant with RFC 4180 and spreadsheet formula injection security.
 * Strings starting with '=', '+', '-', '@', '\t', '\r' are escaped to prevent formula execution in Excel/Sheets.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  let str = String(value);

  // Formula injection defense (sanitize leading operator characters)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // RFC 4180 quoting: if string contains double quotes, commas, or line breaks, enclose in quotes and double internal quotes
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Builds an RFC 4180 CSV string with a UTF-8 BOM (\uFEFF) for broad compatibility across Excel, Numbers, and Sheets.
 */
export function generateCsvString(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const rowLines = rows.map((row) => row.map(escapeCsvCell).join(','));
  return '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
}

/**
 * Converts an array of leads/businesses into a comprehensive, standardized CSV string.
 */
export function exportLeadsToCsv(leads: LeadExportRow[], options: CsvExportOptions = {}): string {
  const headers = [
    'Lead ID',
    'Company Name',
    'Category / Industry',
    'Website',
    'Email',
    'Phone',
    'Primary Contact Name',
    'Primary Contact Email',
    'Primary Contact Role',
    'City',
    'State / Region',
    'Country',
    'Postal Code',
    'Confidence Score',
    'Status',
    'Outreach Status',
    'Partner Allotted',
    'Date Added',
  ];

  const rows = leads.map((lead) => {
    const contact = lead.contacts?.[0];
    const contactName = contact?.contact_name || '';
    const contactEmail = contact?.email || contact?.email_address || '';
    const contactRole = contact?.job_title || contact?.role || '';

    // Calculate outreach sent status
    const isSent =
      Boolean(lead.id && options.sentBusinessIdSet?.has(lead.id)) ||
      Boolean(
        lead.general_business_email &&
          options.sentEmailSet?.has(lead.general_business_email.toLowerCase().trim())
      ) ||
      Boolean(contactEmail && options.sentEmailSet?.has(contactEmail.toLowerCase().trim())) ||
      lead.outreach_sent === true ||
      lead.sent === true;

    // Calculate partner allotment
    const allotment = lead.id ? options.allotments?.[lead.id] : undefined;
    const allottedTo = allotment?.partnerName
      ? `${allotment.partnerName}${allotment.partnerEmail ? ` (${allotment.partnerEmail})` : ''}`
      : lead.allotted_partner || 'Unassigned';

    const dateAdded = lead.created_at ? new Date(lead.created_at).toISOString().split('T')[0] : '';

    return [
      lead.id || '',
      lead.display_name || lead.normalized_name || '',
      lead.business_type || '',
      lead.official_website_url || lead.canonical_domain || '',
      lead.general_business_email || '',
      lead.public_business_phone || '',
      contactName,
      contactEmail,
      contactRole,
      lead.city || '',
      lead.region || '',
      lead.country_code || '',
      lead.postal_code || '',
      lead.identity_confidence !== undefined ? lead.identity_confidence : '',
      lead.record_status || 'active',
      isSent ? 'Sent' : 'Uncontacted',
      allottedTo,
      dateAdded,
    ];
  });

  return generateCsvString(headers, rows);
}

/**
 * Triggers a client-side file download in the browser.
 */
export function downloadCsvFile(csvContent: string, filename = 'evee-leads.csv'): void {
  if (typeof window === 'undefined') return;

  const cleanFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.setAttribute('href', url);
  link.setAttribute('download', cleanFilename);
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Revoke object URL after browser handles download
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
