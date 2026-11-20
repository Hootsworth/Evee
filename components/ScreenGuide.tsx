'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { BookOpen, Check, X } from 'lucide-react';

type Guide = { title: string; purpose: string; steps: string[] };

const guides: Record<string, Guide> = {
  home: { title: 'Your workspace at a glance', purpose: 'Use the overview to see what needs attention across your team.', steps: ['Review the activity and workload summaries.', 'Open a task, lead, or alert to continue the work.'] },
  campaigns: { title: 'Campaigns', purpose: 'Build and manage prospecting campaigns from one place.', steps: ['Create a campaign and choose its audience.', 'Review the generated leads and drafts before dispatch.'] },
  'campaigns-csv': { title: 'CSV outreach', purpose: 'Prepare an outreach batch from a spreadsheet.', steps: ['Upload a CSV and map its columns.', 'Check the preview, run a test, then dispatch when ready.'] },
  leads: { title: 'Lead directory', purpose: 'Search and qualify the businesses your team may work with.', steps: ['Filter or search the list to find a lead.', 'Open a lead to review its details, evidence, and next steps.'] },
  'lead-detail': { title: 'Lead profile', purpose: 'Review one business, its evidence, contacts, and outreach history.', steps: ['Check the profile and source evidence.', 'Update contact details or create the next follow-up task.'] },
  work: { title: 'Work queue', purpose: 'Keep shared tasks, owners, due dates, and approvals in one queue.', steps: ['Filter by owner or status to find the next task.', 'Open or create work and keep its status and due date current.'] },
  revenue: { title: 'Revenue workspace', purpose: 'Track account plans, inbound leads, opportunities, proposals, and outcomes.', steps: ['Choose a record type to review its pipeline.', 'Open a record to update its stage, owner, and next action.'] },
  operations: { title: 'Operations workspace', purpose: 'Coordinate onboarding, renewals, account health, procurement, and service work.', steps: ['Create or open an operational record.', 'Turn milestones into owned tasks and track dependencies.'] },
  partners: { title: 'Partner management', purpose: 'Manage partner access and the leads allocated to each partner.', steps: ['Add or pause a partner account.', 'Allocate leads and use the portal link to review their workspace.'] },
  partner: { title: 'Your partner workspace', purpose: 'Work only with the leads allocated to your partner account.', steps: ['Filter leads by readiness and complete missing contact details.', 'Select ready leads and use Start Outreach; import, export, and enrichment are under Lead tools.'] },
  drafts: { title: 'Draft review', purpose: 'Review AI-assisted outreach before it can be sent.', steps: ['Open a draft and check its claims against the evidence.', 'Approve or request changes before dispatch.'] },
  outreach: { title: 'Outreach activity', purpose: 'Review sent outreach and its delivery or reply status.', steps: ['Filter the activity to find a message or campaign.', 'Open a record to understand its latest status and follow-up.'] },
  'csv-outreach': { title: 'CSV outreach', purpose: 'Send a carefully reviewed outreach batch from imported leads.', steps: ['Upload and map the file, then inspect the preview.', 'Send a test before approving the live dispatch.'] },
  jobs: { title: 'Background jobs', purpose: 'Monitor queued work and recover jobs that need attention.', steps: ['Filter for failed or waiting jobs.', 'Open a job to inspect its error, then retry or resolve it.'] },
  settings: { title: 'Workspace settings', purpose: 'Configure mail, AI, data providers, integrations, and workspace controls.', steps: ['Choose a settings section from the tabs.', 'Save credentials and use the available test action to validate them.'] },
  copilot: { title: 'Evee Copilot', purpose: 'Ask questions about authorized workspace records and get task suggestions.', steps: ['Ask a specific question about accounts or work.', 'Review each suggested task and add only the ones you want.'] },
  developers: { title: 'Developer API', purpose: 'Create scoped API keys for trusted external tools.', steps: ['Give each key a clear name and the minimum scopes needed.', 'Copy the key when it is created; revoke it here if it is no longer needed.'] },
  'workflow-templates': { title: 'Workflow templates', purpose: 'Create repeatable automations that propose work for approval.', steps: ['Choose a trigger and add simple conditions and actions.', 'Activate the template, then review each proposed run before it executes.'] },
  workflows: { title: 'Outreach workflows', purpose: 'Manage the guarded email-dispatch workflow and its approvals.', steps: ['Review pending items and their safety checks.', 'Approve only after verifying the audience and message.'] },
};

function guideForPath(pathname: string): [string, Guide] | null {
  if (pathname === '/') return ['home', guides.home];
  if (pathname === '/campaigns/csv') return ['campaigns-csv', guides['campaigns-csv']];
  if (pathname === '/campaigns') return ['campaigns', guides.campaigns];
  if (pathname === '/leads') return ['leads', guides.leads];
  if (pathname.startsWith('/leads/')) return ['lead-detail', guides['lead-detail']];
  if (pathname === '/work') return ['work', guides.work];
  if (pathname === '/revenue') return ['revenue', guides.revenue];
  if (pathname === '/operations') return ['operations', guides.operations];
  if (pathname === '/partners') return ['partners', guides.partners];
  if (pathname === '/partner') return ['partner', guides.partner];
  if (pathname === '/drafts') return ['drafts', guides.drafts];
  if (pathname === '/outreach') return ['outreach', guides.outreach];
  if (pathname === '/csv-outreach') return ['csv-outreach', guides['csv-outreach']];
  if (pathname === '/jobs') return ['jobs', guides.jobs];
  if (pathname === '/settings') return ['settings', guides.settings];
  if (pathname === '/copilot') return ['copilot', guides.copilot];
  if (pathname === '/developers') return ['developers', guides.developers];
  if (pathname === '/workflow-templates') return ['workflow-templates', guides['workflow-templates']];
  if (pathname === '/workflows') return ['workflows', guides.workflows];
  return null;
}

export default function ScreenGuide({ screen }: { screen?: string }) {
  const pathname = usePathname();
  const page = screen ? [screen, guides[screen]] as [string, Guide] : guideForPath(pathname);
  const [visible, setVisible] = useState(false);
  const [visibleForKey, setVisibleForKey] = useState('');
  const storageKey = page ? `evee_screen_guide_v1:${page[0]}` : '';

  useEffect(() => {
    setVisibleForKey('');
    if (!storageKey) { setVisible(false); return; }
    try {
      const shouldShow = localStorage.getItem(storageKey) !== 'seen';
      setVisible(shouldShow);
      if (shouldShow) setVisibleForKey(storageKey);
    } catch { setVisible(false); }
  }, [storageKey]);

  if (!page || !page[1] || !visible || visibleForKey !== storageKey) return null;
  const dismiss = () => {
    try { localStorage.setItem(storageKey, 'seen'); } catch { /* Keep the guide dismissible if storage is unavailable. */ }
    setVisible(false);
  };

  return <aside aria-label={`${page[1].title} first-visit guide`} className="fixed bottom-4 right-4 z-[60] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] shadow-[0_18px_55px_rgba(20,30,20,0.20)] animate-ios-swish">
    <div className="flex items-start gap-3 border-b border-[var(--line)] bg-[#edf2eb] px-4 py-3 dark:bg-white/[0.05]">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--accent)] text-white"><BookOpen className="h-4 w-4"/></span>
      <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">Quick guide</p><h2 className="mt-0.5 text-sm font-semibold">{page[1].title}</h2></div>
      <button onClick={dismiss} aria-label="Dismiss guide" className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"><X className="h-4 w-4"/></button>
    </div>
    <div className="space-y-3 px-4 py-3.5">
      <p className="text-xs leading-5 text-[var(--muted)]">{page[1].purpose}</p>
      <ol className="space-y-2">{page[1].steps.map((step, index) => <li key={step} className="flex gap-2.5 text-xs leading-5"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#edf2eb] text-[10px] font-semibold text-[var(--accent)] dark:bg-white/[0.08]">{index + 1}</span><span>{step}</span></li>)}</ol>
      <button onClick={dismiss} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"><Check className="h-3.5 w-3.5"/>Got it</button>
      <p className="text-center text-[10px] text-[var(--muted)]">This guide appears once on this screen.</p>
    </div>
  </aside>;
}
