// Evee - Tech Stack & Deep Web Inspection Detector
// Empirically identifies CMS, e-commerce engines, analytics, and booking platforms from public web pages

export interface TechDetectionResult {
  technologies: string[];
  categoryTags: string[];
  findings: Array<{
    type: string;
    claim: string;
    serviceOpportunity: string;
  }>;
}

export function detectTechStack(html: string, url: string = ''): TechDetectionResult {
  const technologies: string[] = [];
  const categoryTags: string[] = [];
  const findings: TechDetectionResult['findings'] = [];

  const lower = html.toLowerCase();

  // 1. E-Commerce Engines
  if (lower.includes('cdn.shopify.com') || lower.includes('shopify.theme') || lower.includes('myshopify.com')) {
    technologies.push('Shopify');
    categoryTags.push('E-Commerce');
    findings.push({
      type: 'ecommerce_architecture',
      claim: 'Storefront runs on Shopify infrastructure.',
      serviceOpportunity: 'Shopify Storefront Speed & Checkout Optimization',
    });
  } else if (lower.includes('woocommerce') || lower.includes('wp-content/plugins/woocommerce')) {
    technologies.push('WooCommerce');
    categoryTags.push('E-Commerce');
    findings.push({
      type: 'ecommerce_architecture',
      claim: 'E-commerce operations managed via WooCommerce on WordPress.',
      serviceOpportunity: 'WooCommerce Checkout Streamlining & Mobile Speed Booster',
    });
  } else if (lower.includes('squarespace.com') || lower.includes('static1.squarespace.com')) {
    technologies.push('Squarespace');
    categoryTags.push('Website Builder');
  } else if (lower.includes('wix.com') || lower.includes('wixsite.com')) {
    technologies.push('Wix');
    categoryTags.push('Website Builder');
  } else if (lower.includes('wp-content') || lower.includes('wp-includes')) {
    technologies.push('WordPress');
    categoryTags.push('Content Management');
  }

  // 2. Booking, Ordering & Reservations
  if (lower.includes('opentable') || lower.includes('opentable.com/widget')) {
    technologies.push('OpenTable');
    categoryTags.push('Reservations');
  } else if (lower.includes('calendly.com') || lower.includes('assets.calendly.com')) {
    technologies.push('Calendly');
    categoryTags.push('Booking');
  } else if (lower.includes('toasttab.com')) {
    technologies.push('Toast POS');
    categoryTags.push('Restaurant POS');
  } else if (lower.includes('resy.com') || lower.includes('widgets.resy.com')) {
    technologies.push('Resy');
    categoryTags.push('Reservations');
  }

  // 3. Analytics & Tracking
  if (lower.includes('gtag(') || lower.includes('google-analytics.com') || lower.includes('googletagmanager.com')) {
    technologies.push('Google Tag Manager / GA4');
    categoryTags.push('Analytics');
  }
  if (lower.includes('connect.facebook.net') || lower.includes('fbq(')) {
    technologies.push('Meta Pixel');
    categoryTags.push('Marketing');
  }

  // 4. Modern JS Frameworks
  if (lower.includes('/_next/') || lower.includes('__next')) {
    technologies.push('Next.js');
    categoryTags.push('Modern Web');
  } else if (lower.includes('react') || lower.includes('__react')) {
    technologies.push('React');
  }

  // Generate actionable observations if missing booking/ordering for SMBs
  if (!technologies.some((t) => ['OpenTable', 'Calendly', 'Toast POS', 'Resy'].includes(t))) {
    if (lower.includes('menu') || lower.includes('dining') || lower.includes('reservation') || lower.includes('appointment')) {
      findings.push({
        type: 'missing_direct_booking',
        claim: 'No automated digital reservation or booking interface found on website.',
        serviceOpportunity: 'Automated 24/7 Digital Booking & Inquiry Workflow',
      });
    }
  }

  // If mobile viewport missing
  if (!lower.includes('name="viewport"') && !lower.includes("name='viewport'")) {
    findings.push({
      type: 'mobile_viewport_missing',
      claim: 'HTML missing standard responsive mobile viewport tag.',
      serviceOpportunity: 'Mobile Optimization & Local Search Visibility',
    });
  }

  return {
    technologies: Array.from(new Set(technologies)),
    categoryTags: Array.from(new Set(categoryTags)),
    findings,
  };
}
