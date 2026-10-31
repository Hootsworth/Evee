// Evee - Lightweight, Robust CSV Parser & Column Auto-Detector
// Compliant with RFC 4180 (handles quotes, commas, escaped quotes, newlines)

export interface CsvColumnMapping {
  email: string | null;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  website: string | null;
  city: string | null;
  phone?: string | null;
  category?: string | null;
  [key: string]: string | null | undefined;
}

export interface ParsedCsvResult {
  headers: string[];
  rows: Record<string, string>[];
  detectedMapping: CsvColumnMapping;
  totalRows: number;
  validEmailCount: number;
}

// 1. Parse CSV string into raw matrix
export function parseCsvText(text: string): string[][] {
  const cleanText = text.replace(/^\uFEFF/, '').trim(); // Remove UTF-8 BOM
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip CRLF
      }
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  // Last field
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

// 2. Smart column auto-detection
export function detectColumnMapping(headers: string[]): CsvColumnMapping {
  const lowerHeaders = headers.map((h) => h.toLowerCase().replace(/[\s_-]+/g, ''));

  const findHeader = (candidates: string[]): string | null => {
    for (const cand of candidates) {
      const idx = lowerHeaders.findIndex((h) => h === cand || h.includes(cand));
      if (idx !== -1) return headers[idx];
    }
    return null;
  };

  const emailCol = findHeader(['email', 'mail', 'emailaddress', 'contactemail', 'workemail']);
  const companyCol = findHeader([
    'company',
    'companyname',
    'business',
    'businessname',
    'organization',
    'org',
    'account',
  ]);
  const firstNameCol = findHeader(['firstname', 'first', 'givenname', 'fname']);
  const nameCol = firstNameCol || findHeader(['name', 'contact', 'contactname', 'leadname', 'recipient']);
  const lastNameCol = findHeader(['lastname', 'last', 'surname', 'familyname', 'lname']);
  const websiteCol = findHeader(['website', 'url', 'site', 'domain', 'webpage', 'link']);
  const cityCol = findHeader(['city', 'location', 'town', 'region', 'area']);
  const phoneCol = findHeader(['phone', 'phonenumber', 'mobile', 'tel', 'telephone', 'cell', 'contactnumber']);
  const categoryCol = findHeader(['category', 'businesstype', 'industry', 'type', 'sector', 'niche']);

  return {
    email: emailCol,
    companyName: companyCol,
    firstName: nameCol,
    lastName: lastNameCol,
    website: websiteCol,
    city: cityCol,
    phone: phoneCol,
    category: categoryCol,
  };
}

// 3. Complete parser pipeline
export function parseAndAnalyzeCsv(csvText: string): ParsedCsvResult {
  const matrix = parseCsvText(csvText);
  if (matrix.length === 0) {
    return {
      headers: [],
      rows: [],
      detectedMapping: { email: null, companyName: null, firstName: null, lastName: null, website: null, city: null },
      totalRows: 0,
      validEmailCount: 0,
    };
  }

  const rawHeaders = matrix[0];
  // Deduplicate and clean headers
  const headers = rawHeaders.map((h, idx) => (h.trim() ? h.trim() : `Column_${idx + 1}`));
  const mapping = detectColumnMapping(headers);

  const emailKey = mapping.email;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const rows: Record<string, string>[] = [];
  let validEmails = 0;

  for (let r = 1; r < matrix.length; r++) {
    const rowArray = matrix[r];
    const rowObj: Record<string, string> = {};

    headers.forEach((h, colIdx) => {
      rowObj[h] = rowArray[colIdx] || '';
    });

    if (emailKey && rowObj[emailKey]) {
      const email = rowObj[emailKey].trim().toLowerCase();
      rowObj[emailKey] = email;
      if (emailRegex.test(email)) {
        validEmails++;
      }
    }

    rows.push(rowObj);
  }

  return {
    headers,
    rows,
    detectedMapping: mapping,
    totalRows: rows.length,
    validEmailCount: validEmails,
  };
}

// 4. Dynamic Variable Replacer
export function replaceTemplateVariables(
  template: string,
  data: Record<string, any>,
  mapping?: CsvColumnMapping
): string {
  if (!template) return '';

  return template.replace(/\{([^{}]+)\}/g, (match, rawKey) => {
    const key = rawKey.trim();
    const lowerKey = key.toLowerCase().replace(/[\s_-]+/g, '');

    // 1. Direct key match
    if (data[key] !== undefined && data[key] !== null && String(data[key]).trim() !== '') {
      return String(data[key]);
    }

    // 2. Mapped standard variables
    if (mapping) {
      if (lowerKey === 'companyname' || lowerKey === 'company' || lowerKey === 'businessname') {
        const mappedCol = mapping.companyName;
        if (mappedCol && data[mappedCol]) return String(data[mappedCol]);
      }
      if (lowerKey === 'firstname' || lowerKey === 'name') {
        const mappedCol = mapping.firstName;
        if (mappedCol && data[mappedCol]) return String(data[mappedCol]);
      }
      if (lowerKey === 'lastname') {
        const mappedCol = mapping.lastName;
        if (mappedCol && data[mappedCol]) return String(data[mappedCol]);
      }
      if (lowerKey === 'email') {
        const mappedCol = mapping.email;
        if (mappedCol && data[mappedCol]) return String(data[mappedCol]);
      }
      if (lowerKey === 'website' || lowerKey === 'site' || lowerKey === 'url') {
        const mappedCol = mapping.website;
        if (mappedCol && data[mappedCol]) return String(data[mappedCol]);
      }
      if (lowerKey === 'city' || lowerKey === 'location') {
        const mappedCol = mapping.city;
        if (mappedCol && data[mappedCol]) return String(data[mappedCol]);
      }
    }

    // 3. Case-insensitive search across data keys
    const foundDataKey = Object.keys(data).find(
      (k) => k.toLowerCase().replace(/[\s_-]+/g, '') === lowerKey
    );
    if (foundDataKey && data[foundDataKey]) {
      return String(data[foundDataKey]);
    }

    // 4. AI-Enhanced Dynamic Tokens
    if (lowerKey === 'companytype' || lowerKey === 'type' || lowerKey === 'businesstype' || lowerKey === 'category') {
      return data.ai_company_type || data.company_type || data.companyType || data.category || 'growing business';
    }
    if (lowerKey === 'personalizedpitch' || lowerKey === 'pitch' || lowerKey === 'hook') {
      return data.ai_personalized_pitch || data.personalized_pitch || data.personalizedPitch || 'We help streamline online customer conversion and booking workflows.';
    }
    if (lowerKey === 'painpoint' || lowerKey === 'pain' || lowerKey === 'challenge') {
      return data.ai_pain_point || data.pain_point || data.painPoint || 'customer coordination drop-offs and scheduling friction';
    }
    if (lowerKey === 'valueprop' || lowerKey === 'solution' || lowerKey === 'benefit') {
      return data.ai_value_prop || data.value_prop || data.valueProp || 'frictionless digital booking workflows';
    }
    if (lowerKey === 'industry' || lowerKey === 'sector') {
      return data.ai_industry || data.industry || 'Commercial Services';
    }

    // 5. Fallback defaults for standard keys
    if (lowerKey === 'firstname' || lowerKey === 'name') return 'there';
    if (lowerKey === 'companyname' || lowerKey === 'company') return 'your team';
    if (lowerKey === 'city' || lowerKey === 'location') return 'your area';

    return match; // preserve if unmatched custom variable
  });
}
