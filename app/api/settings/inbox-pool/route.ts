// Evee - Deliverability Inbox & Domain Pool API Endpoint (Tenant-Isolated)
import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/auth/context';
import { assertAuthenticated, assertAuthorized } from '@/lib/auth/rbac';
import {
  getTenantDomains,
  getTenantMailboxes,
  getPoolSummary,
  registerSendingDomain,
  registerSendingMailbox,
  removeSendingDomain,
  removeSendingMailbox,
} from '@/lib/deliverability/store';

export async function GET(req: NextRequest) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);

    const orgId = userCtx.organizationId;
    const [domains, mailboxes, summary] = await Promise.all([
      getTenantDomains(orgId),
      getTenantMailboxes(orgId),
      getPoolSummary(orgId),
    ]);

    return NextResponse.json({
      success: true,
      domains,
      mailboxes,
      summary,
    });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);
    assertAuthorized(userCtx, 'operator');

    const orgId = userCtx.organizationId;
    const body = await req.json();
    const { action } = body;

    if (action === 'add_domain') {
      const { domain, dailyLimit } = body;
      if (!domain || typeof domain !== 'string') {
        return NextResponse.json({ error: 'Valid domain name is required.' }, { status: 400 });
      }
      const newDomain = await registerSendingDomain(orgId, domain, dailyLimit);
      return NextResponse.json({ success: true, domain: newDomain });
    }

    if (action === 'add_mailbox') {
      const { domainId, email, senderName, provider, dailyLimit, warmupEnabled } = body;
      if (!domainId || !email || !senderName) {
        return NextResponse.json(
          { error: 'domainId, email, and senderName are required.' },
          { status: 400 }
        );
      }
      const newMailbox = await registerSendingMailbox(orgId, {
        domainId,
        email,
        senderName,
        provider,
        dailyLimit,
        warmupEnabled,
      });
      return NextResponse.json({ success: true, mailbox: newMailbox });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userCtx = await getUserContext();
    assertAuthenticated(userCtx);
    assertAuthorized(userCtx, 'operator');

    const orgId = userCtx.organizationId;
    const { searchParams } = new URL(req.url);
    const domainId = searchParams.get('domainId');
    const mailboxId = searchParams.get('mailboxId');

    if (domainId) {
      const success = await removeSendingDomain(orgId, domainId);
      return NextResponse.json({ success });
    }

    if (mailboxId) {
      const success = await removeSendingMailbox(orgId, mailboxId);
      return NextResponse.json({ success });
    }

    return NextResponse.json({ error: 'Specify domainId or mailboxId to delete.' }, { status: 400 });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Unauthenticated') ? 401 : 500);
    return NextResponse.json({ error: err.message }, { status });
  }
}
