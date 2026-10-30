import { describe, it, expect } from 'vitest';
import { parseAndAnalyzeCsv, parseCsvText, replaceTemplateVariables } from '@/lib/csv/parser';

describe('CSV Parser & Column Auto-Detection', () => {
  it('parses standard comma-separated values correctly', () => {
    const csvContent = `Email,Company Name,First Name,City
sarah@nexusfintech.io,Nexus Fintech,Sarah,Austin
david@apexrobotics.ai,Apex Robotics,David,Boston`;

    const result = parseAndAnalyzeCsv(csvContent);
    expect(result.rows).toHaveLength(2);
    expect(result.detectedMapping.email).toBe('Email');
    expect(result.detectedMapping.companyName).toBe('Company Name');
    expect(result.detectedMapping.firstName).toBe('First Name');
    expect(result.detectedMapping.city).toBe('City');
    expect(result.validEmailCount).toBe(2);

    expect(result.rows[0]['Email']).toBe('sarah@nexusfintech.io');
    expect(result.rows[0]['Company Name']).toBe('Nexus Fintech');
    expect(result.rows[0]['First Name']).toBe('Sarah');
  });

  it('handles quotes, commas within quotes, and whitespace correctly', () => {
    const csvContent = `"Work Email","Organization, Inc.","First Name"
"alex.smith@cloudwave.com","CloudWave, Inc.","Alex"
"elena@vertexbio.com","Vertex Bio, LLC","Elena"`;

    const result = parseAndAnalyzeCsv(csvContent);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]['Work Email']).toBe('alex.smith@cloudwave.com');
    expect(result.rows[0]['Organization, Inc.']).toBe('CloudWave, Inc.');
    expect(result.rows[0]['First Name']).toBe('Alex');
  });

  it('replaces template variables with contact data and fallbacks', () => {
    const template = 'Hi {first_name}, hope {company_name} in {city} is growing!';
    const contact = {
      email: 'test@example.com',
      companyName: 'Acme Corp',
      firstName: 'Jane',
      city: 'Seattle',
      raw: {},
    };

    const rendered = replaceTemplateVariables(template, contact);
    expect(rendered).toBe('Hi Jane, hope Acme Corp in Seattle is growing!');
  });

  it('handles fallback defaults when fields are missing', () => {
    const template = 'Hi {first_name}, how is {company_name}?';
    const contact = {
      email: 'test@example.com',
      raw: {},
    };

    const rendered = replaceTemplateVariables(template, contact);
    expect(rendered).toBe('Hi there, how is your team?');
  });
});
