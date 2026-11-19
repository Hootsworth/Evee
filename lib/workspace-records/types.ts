export const recordTypes = ['account_plan', 'relationship', 'meeting', 'inbound_lead', 'opportunity', 'proposal', 'onboarding', 'renewal', 'health_review', 'escalation', 'vendor', 'procurement', 'service_request', 'success_plan', 'outcome'] as const;
export type WorkspaceRecordType = typeof recordTypes[number];
