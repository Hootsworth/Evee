import { describe, it, expect } from 'vitest';
import { detectTechStack } from '@/lib/enrichment/tech-detector';

describe('Lead Tech Stack & Web Inspection Detector', () => {
  it('identifies Shopify and modern web technologies from page markup', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <script src="https://cdn.shopify.com/s/files/1/0000/shopify.theme.js"></script>
          <script src="https://www.googletagmanager.com/gtag/js?id=G-12345"></script>
        </head>
        <body>
          <div id="__next">Shopify Storefront</div>
        </body>
      </html>
    `;

    const result = detectTechStack(html, 'https://artisanroaster.com');
    expect(result.technologies).toContain('Shopify');
    expect(result.technologies).toContain('Google Tag Manager / GA4');
    expect(result.technologies).toContain('Next.js');
    expect(result.findings.some((f) => f.type === 'ecommerce_architecture')).toBe(true);
  });

  it('identifies WooCommerce and restaurant reservation systems', () => {
    const html = `
      <html>
        <head><meta name="viewport" content="width=device-width"></head>
        <body class="woocommerce">
          <div class="opentable-widget">Reserve a table</div>
        </body>
      </html>
    `;

    const result = detectTechStack(html, 'https://bellaitalia.com');
    expect(result.technologies).toContain('WooCommerce');
    expect(result.technologies).toContain('OpenTable');
  });

  it('flags missing automated booking for restaurants lacking digital widgets', () => {
    const html = `
      <html>
        <head><meta name="viewport" content="width=device-width"></head>
        <body>
          <h1>Corner Bistro Menu & Dining</h1>
          <p>Call our landline to make reservations.</p>
        </body>
      </html>
    `;

    const result = detectTechStack(html, 'https://cornerbistro.com');
    expect(result.findings.some((f) => f.type === 'missing_direct_booking')).toBe(true);
  });
});
