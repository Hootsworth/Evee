import { describe, it, expect } from 'vitest';

describe('Overview Reports & KPI Metrics Aggregation', () => {
  it('correctly aggregates sent emails from both direct CSV jobs and workflow messages', () => {
    const jobs = [
      { job_type: 'csv_email_dispatch', status: 'succeeded', payload: { recipientEmail: 'alice@biz.com' } },
      { job_type: 'csv_email_dispatch', status: 'succeeded', payload: { recipientEmail: 'bob@biz.com' } },
      { job_type: 'csv_email_dispatch', status: 'queued', payload: { recipientEmail: 'carol@biz.com' } },
      { job_type: 'lead_enrichment', status: 'succeeded', payload: {} },
    ];

    const messages = [
      { status: 'sent', id: 'msg-1' },
      { status: 'queued', id: 'msg-2' },
      { status: 'failed', id: 'msg-3' },
    ];

    const sentCsvJobs = jobs.filter(
      (j) => j.job_type === 'csv_email_dispatch' && j.status === 'succeeded'
    ).length;
    const sentWorkflowMessages = messages.filter((m) => m.status === 'sent').length;
    const totalSentEmails = sentWorkflowMessages + sentCsvJobs;

    expect(sentCsvJobs).toBe(2);
    expect(sentWorkflowMessages).toBe(1);
    expect(totalSentEmails).toBe(3);
  });

  it('correctly aggregates in-flight queued outreach emails', () => {
    const jobs = [
      { job_type: 'csv_email_dispatch', status: 'queued' },
      { job_type: 'csv_email_dispatch', status: 'running' },
      { job_type: 'csv_email_dispatch', status: 'succeeded' },
    ];

    const messages = [
      { status: 'queued' },
      { status: 'sending' },
      { status: 'sent' },
    ];

    const queuedCsvJobs = jobs.filter(
      (j) => j.job_type === 'csv_email_dispatch' && (j.status === 'queued' || j.status === 'running')
    ).length;
    const queuedWorkflowMessages = messages.filter(
      (m) => m.status === 'queued' || m.status === 'sending'
    ).length;
    const totalQueuedEmails = queuedWorkflowMessages + queuedCsvJobs;

    expect(queuedCsvJobs).toBe(2);
    expect(queuedWorkflowMessages).toBe(2);
    expect(totalQueuedEmails).toBe(4);
  });

  it('calculates monthly goal progress percentage accurately bounded to 100%', () => {
    const calculateProgress = (qualified: number, target: number) => {
      const targetVal = target > 0 ? target : 100;
      return Math.min(Math.round((qualified / targetVal) * 100), 100);
    };

    expect(calculateProgress(0, 100)).toBe(0);
    expect(calculateProgress(45, 100)).toBe(45);
    expect(calculateProgress(100, 100)).toBe(100);
    expect(calculateProgress(150, 100)).toBe(100);
    expect(calculateProgress(25, 50)).toBe(50);
  });

  it('identifies qualified prospects from active contactable businesses and dispatched prospects', () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const businesses = [
      { id: 'b1', record_status: 'active', general_business_email: 'team@cafe.in', created_at: now.toISOString() },
      { id: 'b2', record_status: 'active', general_business_email: 'info@bakery.com', created_at: now.toISOString() },
      { id: 'b3', record_status: 'active', general_business_email: '', created_at: now.toISOString() }, // no email
      { id: 'b4', record_status: 'archived', general_business_email: 'old@archive.com', created_at: now.toISOString() },
    ];

    const jobs = [
      { job_type: 'csv_email_dispatch', status: 'succeeded', payload: { recipientEmail: 'csvprospect@domain.com' }, created_at: now.toISOString(), updated_at: now.toISOString() },
    ];

    const activeWithEmail = businesses.filter(
      (b) => b.record_status === 'active' && Boolean(b.general_business_email?.trim())
    );
    expect(activeWithEmail.length).toBe(2);

    const qualifiedSet = new Set<string>();
    for (const b of activeWithEmail) {
      if (b.created_at >= startOfMonth) qualifiedSet.add(b.id);
    }
    for (const j of jobs) {
      if (j.job_type === 'csv_email_dispatch') {
        const em = j.payload?.recipientEmail?.toLowerCase().trim();
        if (em) qualifiedSet.add(em);
      }
    }

    const qualifiedCount = Math.max(qualifiedSet.size, activeWithEmail.length);
    expect(qualifiedCount).toBe(3); // 2 businesses with email + 1 CSV outreach prospect
  });
});
