// Evee - HTML Parsing & Safe Evidence Extraction
import * as cheerio from 'cheerio';
import { validateUrlAgainstSSRF } from './ssrf';

export interface ExtractedEvidence {
  findingType: string;
  claimText: string;
  supportingExcerpt?: string;
  confidence: number;
  sourceUrl: string;
}

export interface WebsiteInspectionResult {
  pagesAttempted: number;
  pagesSuccessfullyRead: number;
  evidence: ExtractedEvidence[];
  contactEmail?: string;
  contactPhone?: string;
  errors: string[];
}

/**
 * Safely fetches a single webpage verifying SSRF protections and content size limits
 */
async function safeFetchHtml(targetUrl: string, timeoutMs = 8000): Promise<{ html: string; url: string } | null> {
  const ssrfCheck = await validateUrlAgainstSSRF(targetUrl);
  if (!ssrfCheck.isValid) {
    throw new Error(`SSRF validation failed for ${targetUrl}: ${ssrfCheck.reason}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EveeBot/1.0; +https://evee.local/bot)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    clearTimeout(timer);

    if (!res.ok) {
      return null;
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return null;
    }

    // Limit read size to 1.5MB to prevent memory exhaustion
    const text = await res.text();
    return { html: text.slice(0, 1500000), url: res.url };
  } catch (err: unknown) {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Inspects a business website up to maxPages (default: 5)
 */
export async function inspectWebsite(baseUrl: string, maxPages = 5, timeoutMs = 3000): Promise<WebsiteInspectionResult> {
  const result: WebsiteInspectionResult = {
    pagesAttempted: 0,
    pagesSuccessfullyRead: 0,
    evidence: [],
    errors: [],
  };

  const pagesToVisit: string[] = [baseUrl];
  const visited = new Set<string>();

  try {
    const baseParsed = new URL(baseUrl);

    while (pagesToVisit.length > 0 && visited.size < maxPages) {
      const currentUrl = pagesToVisit.shift()!;
      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);

      result.pagesAttempted++;
      const fetched = await safeFetchHtml(currentUrl, timeoutMs);
      if (!fetched) {
        result.errors.push(`Could not fetch or invalid HTML: ${currentUrl}`);
        continue;
      }

      result.pagesSuccessfullyRead++;
      const $ = cheerio.load(fetched.html);

      // 1. Check for email & phone on page
      if (!result.contactEmail) {
        const mailto = $('a[href^="mailto:"]').first().attr('href');
        if (mailto) {
          result.contactEmail = mailto.replace(/^mailto:/i, '').split('?')[0].trim();
        } else {
          const bodyText = $('body').text();
          const emailMatch = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (emailMatch) {
            result.contactEmail = emailMatch[0].trim();
          }
        }
      }

      if (!result.contactPhone) {
        const tel = $('a[href^="tel:"]').first().attr('href');
        if (tel) {
          result.contactPhone = tel.replace(/^tel:/i, '').trim();
        }
      }

      // 2. Discover relevant subpages (Menu, Booking, Contact, Services)
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        try {
          const resolved = new URL(href, currentUrl);
          // Only crawl same domain
          if (resolved.hostname === baseParsed.hostname && !visited.has(resolved.href)) {
            const pathLower = resolved.pathname.toLowerCase();
            if (
              pathLower.includes('menu') ||
              pathLower.includes('book') ||
              pathLower.includes('contact') ||
              pathLower.includes('service') ||
              pathLower.includes('order')
            ) {
              if (!pagesToVisit.includes(resolved.href) && pagesToVisit.length < 10) {
                pagesToVisit.push(resolved.href);
              }
            }
          }
        } catch {
          // ignore malformed URLs
        }
      });

      // 3. Evaluate specific evidence patterns
      const pageText = $('body').text().toLowerCase();

      // Check for booking links / forms
      const hasBookingKeyword = pageText.includes('book an appointment') || pageText.includes('reserve a table') || pageText.includes('book online');
      const hasBookingForm = $('form').length > 0 || $('iframe[src*="calendly"], iframe[src*="opentable"], iframe[src*="resy"]').length > 0;

      if (hasBookingKeyword && !hasBookingForm) {
        result.evidence.push({
          findingType: 'BOOKING_WORKFLOW_INCOMPLETE',
          claimText: 'Mentions appointments/reservations but no interactive booking form or widget is active.',
          supportingExcerpt: $('h1, h2, h3, p').filter((_, e) => $(e).text().toLowerCase().includes('book')).first().text().slice(0, 160),
          confidence: 0.85,
          sourceUrl: currentUrl,
        });
      }

      // Check mobile viewport meta tag
      const hasViewportMeta = $('meta[name="viewport"]').length > 0;
      if (!hasViewportMeta) {
        result.evidence.push({
          findingType: 'MOBILE_LAYOUT_VIEWPORT_MISSING',
          claimText: 'Webpage lacks standard responsive viewport configuration for mobile screens.',
          confidence: 0.95,
          sourceUrl: currentUrl,
        });
      }
    }

    // After inspecting all available pages, check if menu was missing for restaurant/cafe/bakery
    const hasMenuInPages = Array.from(visited).some((u) => u.toLowerCase().includes('menu'));
    if (!hasMenuInPages && result.pagesSuccessfullyRead > 0) {
      result.evidence.push({
        findingType: 'NO_MENU_FOUND_ON_INSPECTED_PAGES',
        claimText: 'No dedicated menu or digital pricing catalogue found across inspected website pages.',
        confidence: 0.9,
        sourceUrl: baseUrl,
      });
    }

  } catch (err: unknown) {
    const error = err as Error;
    result.errors.push(`Inspection failed: ${error.message}`);
  }

  return result;
}
