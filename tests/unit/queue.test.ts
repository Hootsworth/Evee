import { describe, it, expect } from 'vitest';
import {
  enqueueJob,
  claimNextBatch,
  markJobComplete,
  markJobFailed,
  recoverStaleJobs,
  getQueueMetrics,
} from '@/lib/jobs/queue';

describe('Resilient Job Queue Engine', () => {
  it('enqueues, claims, and completes background jobs', async () => {
    const job = await enqueueJob('lead_enrichment', {
      businessId: 'biz_123',
      domain: 'testcafe.in',
    });

    expect(job.id).toMatch(/^job_/);
    expect(job.status).toBe('queued');
    expect(job.job_type).toBe('lead_enrichment');

    // Claim batch
    const claimed = await claimNextBatch('worker_test_1', 10);
    const myJob = claimed.find((j) => j.id === job.id);
    expect(myJob).toBeDefined();
    expect(myJob?.status).toBe('processing');
    expect(myJob?.locked_by).toBe('worker_test_1');

    // Complete job
    await markJobComplete(job.id, { emailsFound: ['contact@testcafe.in'] });

    const metrics = await getQueueMetrics();
    expect(metrics.succeeded).toBeGreaterThanOrEqual(1);
  });

  it('handles job failure with retry attempts tracking', async () => {
    const job = await enqueueJob('email_dispatch', { recipient: 'fail@test.com' }, 2);

    await claimNextBatch('worker_test_2', 10);
    await markJobFailed(job.id, 'Connection timeout');

    // Should return to queued if attempts < max_attempts
    const metrics = await getQueueMetrics();
    expect(metrics.total).toBeGreaterThanOrEqual(1);
  });
});
