import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';
import { answerWorkspaceQuestion } from '@/lib/providers/ai';

export async function POST(req: NextRequest) {
  try {
    const user = await getUserContext(req); assertAuthenticated(user);
    const body = await req.json();
    const question = typeof body.question === 'string' ? body.question.trim().slice(0, 2000) : '';
    if (!question) return NextResponse.json({ error: 'Ask a question to get started.' }, { status: 400 });
    const admin = createAdminClient();
    const [workResult, recordsResult, accountsResult] = await Promise.all([
      admin.from('work_items').select('id, title, description, status, priority, due_at, account_id, owner_id').eq('organization_id', user.organizationId).order('updated_at', { ascending: false }).limit(50),
      admin.from('account_workspace_records').select('id, record_type, title, body, status, stage, amount, currency, due_at, account_id, data').eq('organization_id', user.organizationId).order('updated_at', { ascending: false }).limit(50),
      admin.from('businesses').select('id, display_name, city, business_type').eq('organization_id', user.organizationId).eq('record_status', 'active').limit(100),
    ]);
    if (workResult.error || recordsResult.error || accountsResult.error) throw workResult.error || recordsResult.error || accountsResult.error;
    const accountIds = new Set((accountsResult.data || []).map((account) => account.id));
    const workItems = (workResult.data || []).map(({ id, title, description, status, priority, due_at, account_id }) => ({ id, title, description: description.slice(0, 1000), status, priority, dueAt: due_at, accountId: account_id }));
    const records = (recordsResult.data || []).map(({ id, record_type, title, body: description, status, stage, amount, currency, due_at, account_id, data: custom }) => ({ id, type: record_type, title, description: description.slice(0, 1000), status, stage, amount, currency, dueAt: due_at, accountId: account_id, details: custom }));
    const result = await answerWorkspaceQuestion(user.organizationId!, question, { accounts: accountsResult.data, workItems, records });
    const proposedTasks = result.proposedTasks.map((task: any) => ({
      title: typeof task.title === 'string' ? task.title.trim().slice(0, 240) : '',
      description: typeof task.description === 'string' ? task.description.slice(0, 2000) : '',
      priority: ['low', 'normal', 'high', 'urgent'].includes(task.priority) ? task.priority : 'normal',
      accountId: typeof task.accountId === 'string' && accountIds.has(task.accountId) ? task.accountId : null,
      dueAt: typeof task.dueAt === 'string' && !Number.isNaN(Date.parse(task.dueAt)) ? new Date(task.dueAt).toISOString() : null,
    })).filter((task: any) => task.title);
    return NextResponse.json({ answer: result.answer, proposedTasks, citations: { workItems: workItems.map((item) => item.id), records: records.map((record) => record.id) } });
  } catch (err: any) { return NextResponse.json({ error: err.message || 'Copilot request failed' }, { status: err.statusCode || 500 }); }
}
