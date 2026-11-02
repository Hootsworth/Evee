import { describe, it, expect } from 'vitest';
import {
  evaluateEmailQuality,
  scanLeadsEmailQuality,
} from '@/lib/services/email-quality';

describe('Email Quality & Proxy Detector', () => {
  it('detects aggregator proxies such as Foursquare and Swiggy', () => {
    const foursquare = evaluateEmailQuality('contact@redirect.foursquare.com');
    expect(foursquare).not.toBeNull();
    expect(foursquare?.category).toBe('aggregator_proxy');
    expect(foursquare?.suggestedAction).toBe('archive');

    const swiggy = evaluateEmailQuality('partner-support@swiggy.com');
    expect(swiggy).not.toBeNull();
    expect(swiggy?.category).toBe('aggregator_proxy');

    const zomato = evaluateEmailQuality('merchant@zomato.com');
    expect(zomato).not.toBeNull();
    expect(zomato?.category).toBe('aggregator_proxy');
  });

  it('detects social media platform domain handles like Instagram and Facebook', () => {
    const instagram = evaluateEmailQuality('cafe_delight@instagram.com');
    expect(instagram).not.toBeNull();
    expect(instagram?.category).toBe('social_platform');

    const facebook = evaluateEmailQuality('bakery@facebook.com');
    expect(facebook).not.toBeNull();
    expect(facebook?.category).toBe('social_platform');
  });

  it('detects fake, test, and placeholder emails', () => {
    const testEmail = evaluateEmailQuality('test@test.com');
    expect(testEmail).not.toBeNull();
    expect(testEmail?.category).toBe('placeholder_fake');

    const placeholderUsername = evaluateEmailQuality('dummy@mycooldomain.com');
    expect(placeholderUsername).not.toBeNull();
    expect(placeholderUsername?.category).toBe('placeholder_fake');

    const exampleDomain = evaluateEmailQuality('owner@example.com');
    expect(exampleDomain).not.toBeNull();
    expect(exampleDomain?.category).toBe('placeholder_fake');
  });

  it('detects non-emails and malformed strings', () => {
    const phoneInEmail = evaluateEmailQuality('+91 98765 43210');
    expect(phoneInEmail).not.toBeNull();
    expect(phoneInEmail?.category).toBe('non_email');

    const urlInEmail = evaluateEmailQuality('https://swiggy.com/restaurants/abc');
    expect(urlInEmail).not.toBeNull();
    expect(urlInEmail?.category).toBe('non_email');

    const noAt = evaluateEmailQuality('contact.mydomain.com');
    expect(noAt).not.toBeNull();
    expect(noAt?.category).toBe('non_email');
  });

  it('detects system no-reply emails', () => {
    const noReply = evaluateEmailQuality('noreply@acmeb2b.com');
    expect(noReply).not.toBeNull();
    expect(noReply?.category).toBe('system_noreply');
  });

  it('allows valid business emails', () => {
    const valid = evaluateEmailQuality('alex@thirdwavecoffee.in');
    expect(valid).toBeNull();

    const founder = evaluateEmailQuality('founders@roasterycraft.co');
    expect(founder).toBeNull();
  });

  it('scans a list of leads and flags cross-lead duplicate emails', () => {
    const leads = [
      {
        id: '1',
        display_name: 'Cafe Alpha',
        general_business_email: 'shared@agency.com',
        record_status: 'active',
      },
      {
        id: '2',
        display_name: 'Bistro Beta',
        general_business_email: 'shared@agency.com',
        record_status: 'active',
      },
      {
        id: '3',
        display_name: 'Foursquare Test',
        general_business_email: 'contact@redirect.foursquare.com',
        record_status: 'active',
      },
      {
        id: '4',
        display_name: 'Clean Artisan Cafe',
        general_business_email: 'hello@cleanartisan.com',
        record_status: 'active',
      },
    ];

    const report = scanLeadsEmailQuality(leads);
    expect(report.totalLeads).toBe(4);
    expect(report.totalFlagged).toBe(3); // 2 duplicates + 1 aggregator proxy
    expect(report.flaggedByCategory.aggregator_proxy).toBe(1);
    expect(report.flaggedByCategory.duplicate_email).toBe(2);
  });
});
