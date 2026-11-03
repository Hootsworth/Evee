'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Filter,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  FileText,
  ChevronRight,
  Sparkles,
  UploadCloud,
  CheckCircle2,
  RefreshCw,
  X,
  ChevronDown,
  Mail,
  User,
  Phone,
  Building,
  Send,
  CheckSquare,
  Square,
  ArrowRight,
  ArrowLeft,
  Eye,
  AlertTriangle,
  Info,
  Archive,
  RotateCcw,
  Building2,
  Globe,
  MapPin,
  MailCheck,
  PenLine,
  Layers,
  Cpu,
  Hash,
  Server,
  ShieldAlert,
  Users,
  Trash2,
  CopyX,
  Check,
  Clock,
} from 'lucide-react';
import { parseAndAnalyzeCsv, CsvColumnMapping, replaceTemplateVariables } from '@/lib/csv/parser';
import {
  identifyDuplicateLeads,
  identifyDuplicateContacts,
  DuplicateLeadGroup,
  DuplicateContactGroup,
} from '@/lib/normalization/deduplication';
import {
  scanLeadsEmailQuality,
  FlaggedLeadEmail,
  EmailAuditReport,
} from '@/lib/services/email-quality';

const SAMPLE_LEADS_CSV = `Company Name,Website,Contact Name,Email,Phone,City,Category
Artisan Flour Bakery,artisanflour.com,Siddharth Rao,,+91 98765 43210,Bengaluru,Artisan Bakery
Roast & Ground Cafe,roastground.in,Ananya Iyer,,+91 98450 11223,Bengaluru,Specialty Coffee
Dr. Sharma Dental Studio,sharmadental.in,Dr. Vivek Sharma,,+91 98200 55443,Mumbai,Healthcare
Apex Legal Advisory,apexlegal.in,Meera Sen,,+91 98110 99887,Delhi,Legal Services
Zenith Robotics,zenithrobotics.io,Rohan Verma,,+91 99000 77665,Bengaluru,Technology`;

export default function LeadsPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'missing_email' | 'archived' | 'suppressed' | 'duplicates' | 'flagged_emails'>('active');
  const [archiving, setArchiving] = useState(false);

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Duplicate identification and management state
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [deletingDuplicates, setDeletingDuplicates] = useState(false);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const [duplicateActiveTab, setDuplicateActiveTab] = useState<'leads' | 'contacts'>('leads');

  // AI Email Quality & Proxy Cleaner state
  const [showEmailAuditModal, setShowEmailAuditModal] = useState(false);
  const [selectedFlaggedIds, setSelectedFlaggedIds] = useState<Set<string>>(new Set());
  const [cleaningFlagged, setCleaningFlagged] = useState(false);
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<string>('all');

  // Enrichment state
  const [bulkEnriching, setBulkEnriching] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [enrichMessage, setEnrichMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Unified 4-Step Outreach Wizard state (Strictly matching CSV Direct Outreach)
  const [showOutreachModal, setShowOutreachModal] = useState(false);
  const [outreachStep, setOutreachStep] = useState<'recipients' | 'template' | 'test_sent' | 'dispatched'>('recipients');
  const [outreachSubject, setOutreachSubject] = useState('quick note regarding {company_name}');
  const [outreachBody, setOutreachBody] = useState(
    'Hi {first_name},\n\nSaw {company_name} while researching top {company_type} teams in {city}. {personalized_pitch}\n\nWe recently helped another {company_type} solve {pain_point} with {value_prop} — without adding any extra staff overhead.\n\nOpen to a quick 2-minute glance at how it works? Happy to send a 60-second walkthrough if helpful.\n\nBest,\nOperator'
  );
  const [operatorEmail, setOperatorEmail] = useState('');
  const [previewLeadIdx, setPreviewLeadIdx] = useState(0);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchSummary, setDispatchSummary] = useState<any>(null);
  const [dispatchResults, setDispatchResults] = useState<any[]>([]);
  const [dispatchCadence, setDispatchCadence] = useState<'human' | 'fast' | 'immediate'>('human');
  const [aiEnrichingModal, setAiEnrichingModal] = useState(false);
  const [aiEnrichedModal, setAiEnrichedModal] = useState(false);
  const [aiMetaModal, setAiMetaModal] = useState<{
    source: 'live' | 'ai_synthetic';
    provider: string;
    model: string;
    error?: string;
  } | null>(null);
  const outreachTextareaRef = useRef<HTMLTextAreaElement>(null);

  // CSV Import Modal state
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [csvResult, setCsvResult] = useState<any>(null);
  const [mapping, setMapping] = useState<CsvColumnMapping>({
    companyName: null,
    website: null,
    email: null,
    firstName: null,
    lastName: null,
    city: null,
    phone: null,
    category: null,
  });
  const [autoEnrichOnImport, setAutoEnrichOnImport] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBusinesses = async () => {
    try {
      const res = await fetch('/api/businesses');
      const data = await res.json();
      setBusinesses(data.businesses || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
    fetch('/api/settings/providers')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings?.smtpUser) {
          setOperatorEmail(data.settings.smtpUser);
        }
      })
      .catch(() => {});
  }, []);

  // Derived duplicate groups using normalized deduplication engine
  const duplicateLeadGroups: DuplicateLeadGroup[] = useMemo(() => {
    return identifyDuplicateLeads(businesses);
  }, [businesses]);

  const duplicateContactGroups: DuplicateContactGroup[] = useMemo(() => {
    return identifyDuplicateContacts(businesses);
  }, [businesses]);

  const allDuplicateLeadIds = useMemo(() => {
    const ids = new Set<string>();
    for (const grp of duplicateLeadGroups) {
      for (const d of grp.duplicates) {
        ids.add(d.id);
      }
    }
    return ids;
  }, [duplicateLeadGroups]);

  const allDuplicateClusterIds = useMemo(() => {
    const ids = new Set<string>();
    for (const grp of duplicateLeadGroups) {
      for (const item of grp.all) {
        ids.add(item.id);
      }
    }
    return ids;
  }, [duplicateLeadGroups]);

  const totalDuplicateLeadsCount = allDuplicateLeadIds.size;
  const totalDuplicateContactsCount = useMemo(() => {
    return duplicateContactGroups.reduce((acc, grp) => acc + grp.duplicates.length, 0);
  }, [duplicateContactGroups]);

  // Derived AI email quality audit report
  const emailAuditReport: EmailAuditReport = useMemo(() => {
    return scanLeadsEmailQuality(businesses.filter((b) => b.record_status === 'active'));
  }, [businesses]);

  const flaggedEmailsMap = useMemo(() => {
    const map = new Map<string, FlaggedLeadEmail>();
    for (const item of emailAuditReport.flaggedLeads) {
      map.set(item.leadId, item);
    }
    return map;
  }, [emailAuditReport]);

  const totalFlaggedEmailsCount = emailAuditReport.totalFlagged;

  // Filtered list
  const filtered = businesses.filter((b) => {
    const matchesSearch =
      b.display_name.toLowerCase().includes(search.toLowerCase()) ||
      b.city.toLowerCase().includes(search.toLowerCase()) ||
      b.business_type.toLowerCase().includes(search.toLowerCase()) ||
      (b.general_business_email && b.general_business_email.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'duplicates') {
      return allDuplicateClusterIds.has(b.id);
    }
    if (statusFilter === 'flagged_emails') {
      return flaggedEmailsMap.has(b.id);
    }
    if (statusFilter === 'missing_email') {
      return (!b.general_business_email || b.general_business_email.trim() === '') && b.record_status === 'active';
    }
    if (statusFilter === 'archived') {
      return b.record_status === 'archived';
    }
    if (statusFilter === 'suppressed') {
      return b.record_status === 'suppressed';
    }
    return b.record_status === 'active';
  });

  const activeBusinesses = businesses.filter((b) => b.record_status === 'active');
  const missingEmailCount = activeBusinesses.filter((b) => !b.general_business_email || b.general_business_email.trim() === '').length;
  const archivedCount = businesses.filter((b) => b.record_status === 'archived').length;

  // Archival handlers
  const handleArchive = async (ids: string[]) => {
    if (ids.length === 0) return;
    setArchiving(true);
    try {
      const res = await fetch('/api/leads/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action: 'archive' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEnrichMessage({
          text: `Archived ${data.count} ${data.count === 1 ? 'lead' : 'leads'}.`,
          type: 'success',
        });
        setSelectedIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        fetchBusinesses();
      } else {
        setEnrichMessage({ text: data.error || 'Failed to archive leads', type: 'error' });
      }
    } catch (e: any) {
      setEnrichMessage({ text: e.message || 'Network error while archiving', type: 'error' });
    } finally {
      setArchiving(false);
    }
  };

  const handleUnarchive = async (ids: string[]) => {
    if (ids.length === 0) return;
    setArchiving(true);
    try {
      const res = await fetch('/api/leads/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action: 'unarchive' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEnrichMessage({
          text: `Restored ${data.count} ${data.count === 1 ? 'lead' : 'leads'} to active list.`,
          type: 'success',
        });
        setSelectedIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        fetchBusinesses();
      } else {
        setEnrichMessage({ text: data.error || 'Failed to restore leads', type: 'error' });
      }
    } catch (e: any) {
      setEnrichMessage({ text: e.message || 'Network error while restoring', type: 'error' });
    } finally {
      setArchiving(false);
    }
  };

  const handleArchiveAllMissingEmail = async () => {
    if (missingEmailCount === 0) return;
    if (!confirm(`Archive all ${missingEmailCount} active leads that currently lack an email address? They can be viewed and restored from the 'Archived' tab anytime.`)) {
      return;
    }
    setArchiving(true);
    try {
      const res = await fetch('/api/leads/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allMissingEmail: true, action: 'archive' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEnrichMessage({
          text: `Archived ${data.count} leads with missing emails. Outreach directory refined!`,
          type: 'success',
        });
        setSelectedIds(new Set());
        fetchBusinesses();
      } else {
        setEnrichMessage({ text: data.error || 'Failed to archive leads', type: 'error' });
      }
    } catch (e: any) {
      setEnrichMessage({ text: e.message || 'Network error while archiving', type: 'error' });
    } finally {
      setArchiving(false);
    }
  };

  const handleArchiveFlagged = async (ids: string[]) => {
    if (ids.length === 0) return;
    setCleaningFlagged(true);
    try {
      const res = await fetch('/api/leads/email-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive', leadIds: ids }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEnrichMessage({
          text: `Archived ${data.count} flagged fake/proxy ${data.count === 1 ? 'lead' : 'leads'}.`,
          type: 'success',
        });
        setSelectedFlaggedIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        fetchBusinesses();
      } else {
        setEnrichMessage({ text: data.error || 'Failed to archive flagged leads', type: 'error' });
      }
    } catch (e: any) {
      setEnrichMessage({ text: e.message || 'Network error while archiving', type: 'error' });
    } finally {
      setCleaningFlagged(false);
    }
  };

  const handleArchiveAllFlagged = async () => {
    if (totalFlaggedEmailsCount === 0) return;
    if (
      !confirm(
        `Archive all ${totalFlaggedEmailsCount} leads with fake, proxy (@swiggy.com, @redirect.foursquare.com), social (@instagram.com), or duplicate emails? You can restore them anytime from the Archived tab.`
      )
    ) {
      return;
    }
    setCleaningFlagged(true);
    try {
      const res = await fetch('/api/leads/email-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive', archiveAllFlagged: true }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEnrichMessage({
          text: `Cleaned directory: archived ${data.count} leads with fake, proxy, or duplicate emails.`,
          type: 'success',
        });
        setSelectedFlaggedIds(new Set());
        fetchBusinesses();
      } else {
        setEnrichMessage({ text: data.error || 'Failed to archive flagged leads', type: 'error' });
      }
    } catch (e: any) {
      setEnrichMessage({ text: e.message || 'Network error while archiving', type: 'error' });
    } finally {
      setCleaningFlagged(false);
    }
  };

  const handleDeleteFlagged = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (
      !confirm(
        `Permanently delete ${ids.length} selected leads? This will delete associated contacts and drafts and cannot be undone.`
      )
    ) {
      return;
    }
    setCleaningFlagged(true);
    try {
      const res = await fetch('/api/leads/email-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', leadIds: ids }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEnrichMessage({
          text: `Permanently deleted ${data.count} ${data.count === 1 ? 'lead' : 'leads'}.`,
          type: 'success',
        });
        setSelectedFlaggedIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        fetchBusinesses();
      } else {
        setEnrichMessage({ text: data.error || 'Failed to delete leads', type: 'error' });
      }
    } catch (e: any) {
      setEnrichMessage({ text: e.message || 'Network error while deleting leads', type: 'error' });
    } finally {
      setCleaningFlagged(false);
    }
  };

  const handleDeleteLead = async (id: string, name?: string) => {
    const displayName = name || 'this lead';
    if (!confirm(`Permanently delete ${displayName}? This will also delete associated contacts and cannot be undone.`)) {
      return;
    }
    setDeletingLeadId(id);
    try {
      const res = await fetch('/api/leads/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_leads', leadIds: [id] }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEnrichMessage({
          text: `Permanently deleted ${displayName}.`,
          type: 'success',
        });
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        fetchBusinesses();
      } else {
        setEnrichMessage({ text: data.error || 'Failed to delete lead', type: 'error' });
      }
    } catch (e: any) {
      setEnrichMessage({ text: e.message || 'Network error while deleting lead', type: 'error' });
    } finally {
      setDeletingLeadId(null);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!confirm(`Permanently delete all ${count} selected leads? This cannot be undone.`)) {
      return;
    }
    setDeletingDuplicates(true);
    try {
      const res = await fetch('/api/leads/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_leads', leadIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEnrichMessage({
          text: `Permanently deleted ${data.deletedLeadsCount} ${data.deletedLeadsCount === 1 ? 'lead' : 'leads'}.`,
          type: 'success',
        });
        setSelectedIds(new Set());
        fetchBusinesses();
      } else {
        setEnrichMessage({ text: data.error || 'Failed to delete selected leads', type: 'error' });
      }
    } catch (e: any) {
      setEnrichMessage({ text: e.message || 'Network error while deleting leads', type: 'error' });
    } finally {
      setDeletingDuplicates(false);
    }
  };

  const handleDeleteAllDuplicates = async () => {
    const totalToClean = totalDuplicateLeadsCount + totalDuplicateContactsCount;
    if (totalToClean === 0) return;
    if (
      !confirm(
        `Purge all ${totalDuplicateLeadsCount} duplicate leads and ${totalDuplicateContactsCount} duplicate contacts? Primary/canonical records will be safely preserved.`
      )
    ) {
      return;
    }
    setDeletingDuplicates(true);
    try {
      const res = await fetch('/api/leads/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoCleanAll: true }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEnrichMessage({
          text: `Directory cleaned: purged ${data.deletedLeadsCount} duplicate leads and ${data.deletedContactsCount} duplicate contacts.`,
          type: 'success',
        });
        setSelectedIds(new Set());
        fetchBusinesses();
        setShowDuplicatesModal(false);
      } else {
        setEnrichMessage({ text: data.error || 'Failed to clean duplicates', type: 'error' });
      }
    } catch (e: any) {
      setEnrichMessage({ text: e.message || 'Network error while cleaning duplicates', type: 'error' });
    } finally {
      setDeletingDuplicates(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Permanently delete this duplicate contact?')) return;
    setDeletingDuplicates(true);
    try {
      const res = await fetch('/api/leads/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_contacts', contactIds: [contactId] }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEnrichMessage({
          text: 'Permanently deleted duplicate contact.',
          type: 'success',
        });
        fetchBusinesses();
      } else {
        setEnrichMessage({ text: data.error || 'Failed to delete contact', type: 'error' });
      }
    } catch (e: any) {
      setEnrichMessage({ text: e.message || 'Network error while deleting contact', type: 'error' });
    } finally {
      setDeletingDuplicates(false);
    }
  };

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((b) => b.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Selected businesses array
  const selectedBusinesses = businesses.filter((b) => selectedIds.has(b.id));
  const selectedReadyToEmail = selectedBusinesses.filter((b) => Boolean(b.general_business_email));
  const selectedMissingEmail = selectedBusinesses.filter((b) => !b.general_business_email);

  // Outreach Candidates: selected leads, or filtered leads if none explicitly selected
  const activeCandidatesList = selectedBusinesses.length > 0 ? selectedBusinesses : filtered;
  const outreachCandidates = activeCandidatesList.map((b) => ({
    id: b.id,
    email: b.general_business_email || b.contacts?.[0]?.contact_email || '',
    company_name: b.display_name,
    first_name: b.contacts?.[0]?.contact_name?.split(' ')[0] || 'there',
    website: b.official_website_url || '',
    city: b.city || '',
    company_type: b.ai_company_type || b.business_type || 'growing business',
    personalized_pitch: b.ai_personalized_pitch || '',
    pain_point: b.ai_pain_point || '',
    value_prop: b.ai_value_prop || '',
    industry: b.business_type || 'Commercial Services',
    ai_company_type: b.ai_company_type || b.business_type,
    ai_personalized_pitch: b.ai_personalized_pitch,
    ai_pain_point: b.ai_pain_point,
    ai_value_prop: b.ai_value_prop,
    ai_industry: b.business_type,
  }));
  const activeRecipients = outreachCandidates.filter((c) => Boolean(c.email && c.email.includes('@')));
  const sampleCandidate = activeRecipients[previewLeadIdx] || activeRecipients[0] || {};
  const renderedSubject = replaceTemplateVariables(outreachSubject, sampleCandidate);
  const renderedBody = replaceTemplateVariables(outreachBody, sampleCandidate);

  // Single Lead Enrich
  const handleEnrichSingle = async (businessId: string) => {
    setEnrichingId(businessId);
    setEnrichMessage(null);
    try {
      const res = await fetch('/api/leads/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId }),
      });
      const data = await res.json();
      if (res.ok && data.enriched?.[0]) {
        const item = data.enriched[0];
        if (item.status === 'enriched') {
          setEnrichMessage({
            text: `Discovered verified email (${item.email}) for ${item.businessName} via ${item.source}!`,
            type: 'success',
          });
          fetchBusinesses();
        } else {
          setEnrichMessage({
            text: `No email found on public directories or web pages for ${item.businessName}.`,
            type: 'error',
          });
        }
      } else {
        setEnrichMessage({ text: data.error || 'Failed to enrich lead', type: 'error' });
      }
    } catch (err: any) {
      setEnrichMessage({ text: err.message || 'Network error enriching lead', type: 'error' });
    } finally {
      setEnrichingId(null);
    }
  };

  // Bulk Enrich Missing (or Selected Missing)
  const handleBulkEnrich = async (targetIds?: string[]) => {
    setBulkEnriching(true);
    setEnrichMessage(null);
    try {
      const res = await fetch('/api/leads/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetIds && targetIds.length > 0 ? { businessIds: targetIds } : { enrichAllMissing: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setEnrichMessage({
          text: `Enrichment completed: Verified ${data.summary?.enriched || 0} emails using Deep Web Inspection, Gemini AI & MX verification!`,
          type: 'success',
        });
        fetchBusinesses();
      } else {
        setEnrichMessage({ text: data.error || 'Failed to execute bulk enrichment', type: 'error' });
      }
    } catch (err: any) {
      setEnrichMessage({ text: err.message || 'Network error during bulk enrichment', type: 'error' });
    } finally {
      setBulkEnriching(false);
    }
  };

  // Handle CSV Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      const parsed = parseAndAnalyzeCsv(text);
      setCsvResult(parsed);
      setMapping(parsed.detectedMapping);
    };
    reader.readAsText(file);
  };

  const handleLoadSampleCsv = () => {
    setFileName('sample_b2b_leads.csv');
    setCsvContent(SAMPLE_LEADS_CSV);
    const parsed = parseAndAnalyzeCsv(SAMPLE_LEADS_CSV);
    setCsvResult(parsed);
    setMapping(parsed.detectedMapping);
  };

  // Handle Lead Import
  const handleImportLeads = async () => {
    if (!csvResult || csvResult.rows.length === 0) return;
    setImporting(true);
    setImportResult(null);

    try {
      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: csvResult.rows,
          mapping,
          autoEnrich: autoEnrichOnImport,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setImportResult(data);
        fetchBusinesses();
      } else {
        alert(data.error || 'Failed to import leads');
      }
    } catch (err: any) {
      alert(`Network error importing leads: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  // Helper to insert a variable chip into the outreachBody at the current cursor position
  const handleInsertVariable = (tokenName: string) => {
    const token = `{${tokenName}}`;
    const textarea = outreachTextareaRef.current;
    if (!textarea) {
      setOutreachBody((prev) => prev + ' ' + token);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = outreachBody;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    setOutreachBody(before + token + after);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  };

  // Trigger AI enrichment on candidate leads
  const handleEnrichModalWithAi = async () => {
    if (activeRecipients.length === 0) return;
    setAiEnrichingModal(true);

    try {
      const res = await fetch('/api/csv-outreach/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospects: activeRecipients,
          mapping: {
            email: 'email',
            companyName: 'company_name',
            firstName: 'first_name',
            website: 'website',
            city: 'city',
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.enrichedProspects) {
        const enrichedMap = new Map<string, any>();
        data.enrichedProspects.forEach((ep: any) => {
          if (ep.id) enrichedMap.set(ep.id, ep);
        });

        setBusinesses((prev) =>
          prev.map((b) => {
            const ep = enrichedMap.get(b.id);
            if (ep) {
              return {
                ...b,
                ai_company_type: ep.ai_company_type || ep.company_type || b.ai_company_type,
                ai_personalized_pitch: ep.ai_personalized_pitch || ep.personalized_pitch || b.ai_personalized_pitch,
                ai_pain_point: ep.ai_pain_point || ep.pain_point || b.ai_pain_point,
                ai_value_prop: ep.ai_value_prop || ep.value_prop || b.ai_value_prop,
              };
            }
            return b;
          })
        );
        setAiEnrichedModal(true);
        setAiMetaModal(data.meta || null);
      } else {
        alert(`AI Enrichment Error: ${data.error || 'Failed to enrich prospects.'}`);
      }
    } catch (err: any) {
      alert(`Network error during AI enrichment: ${err.message}`);
    } finally {
      setAiEnrichingModal(false);
    }
  };

  // 1. Safety Gate: Send Test Email to Myself
  const handleSendTestToSelf = async () => {
    if (activeRecipients.length === 0) return;
    setTestSending(true);
    setTestError(null);

    const sample = activeRecipients[previewLeadIdx] || activeRecipients[0];
    try {
      const res = await fetch('/api/csv-outreach/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: { subject: outreachSubject, bodyText: outreachBody },
          sampleProspect: sample,
          recipientOverride: operatorEmail,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTestResult(data);
        setOutreachStep('test_sent');
      } else {
        setTestError(data.error || 'Failed to dispatch verification email.');
      }
    } catch (err: any) {
      setTestError(err.message || 'Network error sending test email.');
    } finally {
      setTestSending(false);
    }
  };

  // 2. Full Live Bulk Dispatch
  const handleDispatchOutreach = async () => {
    if (activeRecipients.length === 0) return;
    setDispatching(true);

    try {
      const res = await fetch('/api/csv-outreach/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: { subject: outreachSubject, bodyText: outreachBody },
          recipients: activeRecipients,
          cadence: dispatchCadence,
          mapping: {
            email: 'email',
            companyName: 'company_name',
            firstName: 'first_name',
            website: 'website',
            city: 'city',
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setDispatchSummary(data.summary);
        setDispatchResults(data.results || []);
        setOutreachStep('dispatched');
        fetchBusinesses();
      } else {
        alert(`Bulk dispatch error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Network error during dispatch: ${err.message}`);
    } finally {
      setDispatching(false);
    }
  };

  // Active queue processor heartbeat while in dispatched summary view
  useEffect(() => {
    if (outreachStep !== 'dispatched') return;

    let isMounted = true;
    const processQueueTick = async () => {
      try {
        const res = await fetch('/api/jobs/queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'process', batchSize: 5 }),
        });
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.result && (data.result.succeeded > 0 || data.result.failed > 0)) {
            setDispatchSummary((prev: any) => ({
              ...prev,
              sent: (prev?.sent || 0) + (data.result.succeeded || 0),
              failed: (prev?.failed || 0) + (data.result.failed || 0),
            }));
          }
        }
      } catch (err) {
        console.error('Queue tick notice:', err);
      }
    };

    processQueueTick();
    const interval = setInterval(processQueueTick, 3500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [outreachStep]);

  // Navigate to full-screen CSV outreach pipeline with preloaded leads
  const handleOpenInFullCsvOutreach = () => {
    try {
      sessionStorage.setItem('evee_outreach_leads', JSON.stringify(activeRecipients));
    } catch (e) {
      console.error(e);
    }
    router.push('/campaigns/csv');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#090a0f] text-[#000000] dark:text-[#ffffff] transition-colors duration-150">
      {/* Brand 3-Color Ribbon Accent (DESIGN.md) */}
      <div className="brand-gradient-h w-full" />

      {/* Hero Band: deep green page header */}
      <section className="bg-[#28352d] text-white border-b border-white/[0.08] px-6 py-10 sm:py-14 relative overflow-hidden ui-grid-bg">
        <div className="max-w-7xl mx-auto flex flex-col xl:flex-row xl:items-end justify-between gap-6 relative z-10">
          <div className="max-w-xl">
            <div className="flex items-center space-x-2 text-[10px] font-mono tracking-widest text-[#959494] uppercase mb-2">
              <span>Prospect directory</span>
              <span>•</span>
              <span className="ui-badge text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                EVEE AI DIRECTORY
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-white">
              Leads
            </h1>
            <p className="text-sm text-[#959494] mt-2 font-normal leading-relaxed">
              Search, organize, and enrich your prospect list. Review contact details and manage outreach from one place.
            </p>
          </div>

          {/* Action CTAs: 5 Core Workflow Actions in a Single Sleek Row */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 shrink-0">
            {/* 1. Import CSV */}
            <button
              onClick={() => {
                setShowCsvModal(true);
                setImportResult(null);
              }}
              title="Import prospects from CSV spreadsheet"
              className="mono-btn h-9 bg-[#313641] hover:bg-[#3d4352] text-white border border-white/[0.12] px-3.5 rounded-[4px] text-xs font-mono font-medium tracking-tight transition flex items-center space-x-2 whitespace-nowrap shadow-sm"
            >
              <UploadCloud className="w-3.5 h-3.5 text-[#bdc8b5]" />
              <span>Import CSV</span>
            </button>

            {/* 2. Enrich */}
            <button
              onClick={() => handleBulkEnrich()}
              disabled={bulkEnriching || missingEmailCount === 0}
              title={
                bulkEnriching
                  ? 'Enriching in progress...'
                  : missingEmailCount > 0
                  ? `AI enrich ${missingEmailCount} leads missing emails`
                  : 'All active leads are enriched'
              }
              className="mono-btn h-9 bg-[#c8f6f9] hover:bg-[#b2f0f4] text-[#010120] px-3.5 rounded-[4px] text-xs font-mono font-medium tracking-tight transition flex items-center space-x-2 whitespace-nowrap shadow-sm disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${bulkEnriching ? 'animate-spin' : ''}`} />
              <span>{bulkEnriching ? 'Enriching...' : 'Enrich'}</span>
              {missingEmailCount > 0 && !bulkEnriching && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#010120]/15 text-[#010120] font-semibold">
                  {missingEmailCount}
                </span>
              )}
            </button>

            {/* 3. Deduplicate */}
            <button
              onClick={() => setShowDuplicatesModal(true)}
              title="Identify and delete duplicate leads & redundant contacts"
              className={`mono-btn h-9 px-3.5 rounded-[4px] text-xs font-mono font-medium tracking-tight transition flex items-center space-x-2 whitespace-nowrap border shadow-sm ${
                totalDuplicateLeadsCount > 0
                  ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/30'
                  : 'bg-[#313641] hover:bg-[#3d4352] text-white border-white/[0.12]'
              }`}
            >
              <CopyX className="w-3.5 h-3.5 text-amber-400" />
              <span>Deduplicate</span>
              {totalDuplicateLeadsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/25 text-amber-300 font-semibold border border-amber-500/30">
                  {totalDuplicateLeadsCount}
                </span>
              )}
            </button>

            {/* 4. Audit Emails */}
            <button
              onClick={() => setShowEmailAuditModal(true)}
              title="AI detect and clean fake emails, proxies, and social handles"
              className={`mono-btn h-9 px-3.5 rounded-[4px] text-xs font-mono font-medium tracking-tight transition flex items-center space-x-2 whitespace-nowrap border shadow-sm ${
                totalFlaggedEmailsCount > 0
                  ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/30'
                  : 'bg-[#313641] hover:bg-[#3d4352] text-white border-white/[0.12]'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Audit Emails</span>
              {totalFlaggedEmailsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-500/25 text-rose-300 font-semibold border border-rose-500/30">
                  {totalFlaggedEmailsCount}
                </span>
              )}
            </button>

            {/* 5. Start Outreach */}
            <button
              onClick={() => {
                if (selectedIds.size === 0) {
                  // Select all filtered by default if none selected
                  setSelectedIds(new Set(filtered.map((b) => b.id)));
                }
                setOutreachStep('recipients');
                setPreviewLeadIdx(0);
                setTestResult(null);
                setTestError(null);
                setDispatchSummary(null);
                setDispatchResults([]);
                setShowOutreachModal(true);
              }}
              title="Launch unified direct outreach campaign"
              className="mono-btn h-9 bg-white hover:bg-[#ebebeb] text-[#010120] px-4 rounded-[4px] text-xs font-mono font-semibold tracking-tight transition flex items-center space-x-2 whitespace-nowrap shadow-sm"
            >
              <Send className="w-3.5 h-3.5 text-[#010120]" />
              <span>Start Outreach</span>
              {selectedIds.size > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#010120]/15 text-[#010120] font-bold">
                  {selectedIds.size}
                </span>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Main Canvas Body: Clean hairline borders, 4px radius */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Feedback message banner */}
        {enrichMessage && (
          <div
            className={`mb-6 p-4 rounded-[4px] border text-xs font-mono flex items-center justify-between ${
              enrichMessage.type === 'success'
                ? 'bg-[#c8f6f9]/20 border-[#c8f6f9]/60 text-emerald-800 dark:text-[#c8f6f9]'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              {enrichMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-[#c8f6f9] shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <span>{enrichMessage.text}</span>
            </div>
            <button onClick={() => setEnrichMessage(null)} className="text-current opacity-60 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Filter, Search & Selection Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#959494] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by company, email, city, category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#0f1017] rounded-[4px] text-xs font-mono focus:outline-none focus:border-[#000000] dark:focus:border-white transition text-[#000000] dark:text-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mono-eyebrow text-[#959494] text-[11px] font-mono mr-1">STATUS:</span>
            {[
              { id: 'active', label: `ACTIVE (${activeBusinesses.length})` },
              { id: 'missing_email', label: `NO EMAIL (${missingEmailCount})` },
              ...(totalFlaggedEmailsCount > 0
                ? [{ id: 'flagged_emails', label: `FLAGGED EMAILS (${totalFlaggedEmailsCount})` }]
                : []),
              ...(totalDuplicateLeadsCount > 0
                ? [{ id: 'duplicates', label: `DUPLICATES (${totalDuplicateLeadsCount})` }]
                : []),
              { id: 'archived', label: `ARCHIVED (${archivedCount})` },
              { id: 'all', label: `ALL (${businesses.length})` },
              { id: 'suppressed', label: 'SUPPRESSED' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id as any)}
                className={`mono-btn text-xs px-3 py-1.5 rounded-[4px] transition font-mono uppercase tracking-wider ${
                  statusFilter === st.id
                    ? 'bg-[#000000] dark:bg-white text-white dark:text-[#000000] font-semibold'
                    : 'bg-white dark:bg-[#14161f] border border-[#ebebeb] dark:border-white/[0.08] text-[#959494] hover:text-[#000000] dark:hover:text-white'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Missing Email Banner when viewing No Email */}
        {statusFilter === 'missing_email' && (
          <div className="mb-6 p-4 rounded-[4px] border border-pink-500/30 bg-pink-500/10 text-pink-800 dark:text-pink-300 font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <Archive className="w-4 h-4 text-pink-500 shrink-0" />
              <div>
                <span className="font-semibold">Showing {missingEmailCount} active leads without an email address.</span>
                <span className="text-[11px] opacity-80 block sm:inline sm:ml-2">Enrich them with AI or archive them to keep your outreach list clean.</span>
              </div>
            </div>
            {missingEmailCount > 0 && (
              <button
                onClick={handleArchiveAllMissingEmail}
                disabled={archiving}
                className="mono-btn bg-pink-600 hover:bg-pink-700 text-white px-3.5 py-1.5 rounded-[4px] text-xs font-mono uppercase tracking-wider whitespace-nowrap disabled:opacity-50 flex items-center space-x-2 shrink-0"
              >
                <Archive className={`w-3.5 h-3.5 ${archiving ? 'animate-spin' : ''}`} />
                <span>{archiving ? 'Archiving...' : `Archive All No-Email (${missingEmailCount})`}</span>
              </button>
            )}
          </div>
        )}

        {/* Flagged Email Banner when viewing Flagged Emails */}
        {statusFilter === 'flagged_emails' && (
          <div className="mb-6 p-4 rounded-[4px] border border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300 font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
              <div>
                <span className="font-semibold">Showing {totalFlaggedEmailsCount} leads with fake, proxy (@swiggy.com, @redirect.foursquare.com), social (@instagram.com), or duplicate emails.</span>
                <span className="text-[11px] opacity-80 block sm:inline sm:ml-2">Outreach to these leads will bounce or fail to reach founders.</span>
              </div>
            </div>
            <button
              onClick={() => setShowEmailAuditModal(true)}
              className="mono-btn bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-[4px] text-xs font-mono uppercase tracking-wider whitespace-nowrap"
            >
              Open Email Cleaner
            </button>
          </div>
        )}

        {/* Duplicate Banner when viewing Duplicates */}
        {statusFilter === 'duplicates' && (
          <div className="mb-6 p-4 rounded-[4px] border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <CopyX className="w-4 h-4 text-amber-500 shrink-0" />
              <div>
                <span className="font-semibold">Showing {duplicateLeadGroups.length} duplicate clusters ({totalDuplicateLeadsCount} redundant leads).</span>
                <span className="text-[11px] opacity-80 block sm:inline sm:ml-2">Primary records are highlighted below.</span>
              </div>
            </div>
            <button
              onClick={() => setShowDuplicatesModal(true)}
              className="mono-btn bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 rounded-[4px] text-xs font-mono uppercase tracking-wider whitespace-nowrap"
            >
              Open Duplicate Manager
            </button>
          </div>
        )}

        {/* Lead Table / List: lead table style */}
        {loading ? (
          <div className="py-20 text-center font-mono text-xs text-[#959494]">Loading discovered leads...</div>
        ) : filtered.length === 0 ? (
          <div className="border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] p-16 text-center bg-white dark:bg-[#0f1017]">
            <p className="text-xs text-[#959494] font-mono mb-4">No prospects match your search criteria.</p>
            <button
              onClick={() => setShowCsvModal(true)}
              className="mono-btn bg-[#000000] dark:bg-white text-white dark:text-[#000000] px-4 py-2 rounded-[4px] text-xs font-mono uppercase tracking-wider inline-flex items-center space-x-2"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>IMPORT PROSPECTS FROM CSV</span>
            </button>
          </div>
        ) : (
          <div className="border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] overflow-hidden bg-white dark:bg-[#0f1017]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                {/* data-table-header */}
                <thead className="bg-[#f4f4f5] dark:bg-[#14161f] border-b border-[#ebebeb] dark:border-white/[0.08] text-[#959494]">
                  <tr>
                    <th className="py-3 px-4 w-10">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-[#959494] hover:text-[#000000] dark:hover:text-white flex items-center"
                        title={selectedIds.size === filtered.length ? 'Deselect all' : 'Select all'}
                      >
                        {selectedIds.size === filtered.length && filtered.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-[#000000] dark:text-white" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4 font-medium tracking-[0.55px] uppercase">BUSINESS NAME</th>
                    <th className="py-3 px-4 font-medium tracking-[0.55px] uppercase">CONTACT & EMAIL</th>
                    <th className="py-3 px-4 font-medium tracking-[0.55px] uppercase">CATEGORY</th>
                    <th className="py-3 px-4 font-medium tracking-[0.55px] uppercase">LOCATION</th>
                    <th className="py-3 px-4 font-medium tracking-[0.55px] uppercase">STATUS</th>
                    <th className="py-3 px-4 font-medium tracking-[0.55px] uppercase text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ebebeb] dark:divide-white/[0.06]">
                  {filtered.map((b) => {
                    const isSelected = selectedIds.has(b.id);
                    const hasEmail = Boolean(b.general_business_email);
                    const isEnrichingThis = enrichingId === b.id;
                    const contactName = b.contacts?.[0]?.contact_name;

                    return (
                      <tr
                        key={b.id}
                        className={`transition group ${
                          isSelected
                            ? 'bg-[#c8f6f9]/10 dark:bg-white/[0.03]'
                            : 'hover:bg-[#f8fafc] dark:hover:bg-[#14161f]'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleSelect(b.id)}
                            className="text-[#959494] hover:text-[#000000] dark:hover:text-white flex items-center"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#000000] dark:text-white" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* Business Name */}
                        <td className="py-3.5 px-4 font-sans">
                          <div className="flex items-center space-x-1.5 flex-wrap">
                            <Link
                              href={`/leads/${b.id}`}
                              className="font-medium text-sm text-[#000000] dark:text-white hover:underline flex items-center space-x-1.5"
                            >
                              <span>{b.display_name}</span>
                              <ChevronRight className="w-3.5 h-3.5 text-[#959494] group-hover:translate-x-0.5 transition-transform" />
                            </Link>
                            {allDuplicateLeadIds.has(b.id) && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-semibold uppercase">
                                <CopyX className="w-2.5 h-2.5" />
                                Duplicate
                              </span>
                            )}
                          </div>
                          {b.official_website_url && (
                            <span className="text-[11px] text-[#959494] font-mono block mt-0.5 truncate max-w-xs">
                              {b.official_website_url}
                            </span>
                          )}
                        </td>

                        {/* Contact & Email with Live Free AI/Web Discovery */}
                        <td className="py-3.5 px-4 font-mono">
                          {hasEmail ? (
                            <div>
                              <div className="flex items-center space-x-1.5 flex-wrap gap-y-1 text-[#000000] dark:text-white font-normal">
                                <Mail className="w-3 h-3 text-[#959494] shrink-0" />
                                <span>{b.general_business_email}</span>
                                {flaggedEmailsMap.has(b.id) && (
                                  <span
                                    title={flaggedEmailsMap.get(b.id)!.flag.reason}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-semibold uppercase shrink-0"
                                  >
                                    <ShieldAlert className="w-2.5 h-2.5" />
                                    <span>{flaggedEmailsMap.get(b.id)!.flag.categoryLabel}</span>
                                  </span>
                                )}
                              </div>
                              {contactName && (
                                <div className="text-[11px] text-[#959494] mt-0.5">
                                  {contactName}
                                </div>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleEnrichSingle(b.id)}
                              disabled={isEnrichingThis || bulkEnriching}
                              className="mono-btn px-2.5 py-1 rounded-[4px] bg-white dark:bg-[#14161f] border border-[#ebebeb] dark:border-white/[0.12] text-[#000000] dark:text-white hover:bg-[#f4f4f5] dark:hover:bg-[#1c1d27] flex items-center space-x-1.5 text-[11px] font-mono tracking-wider uppercase transition disabled:opacity-50"
                              title="Crawl contact pages, infer via Gemini AI, and verify MX"
                            >
                              <Sparkles className={`w-3 h-3 ${isEnrichingThis ? 'animate-spin' : ''}`} />
                              <span>{isEnrichingThis ? 'FINDING...' : 'FIND EMAIL'}</span>
                            </button>
                          )}
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-4 text-[#959494]">
                          <span className="px-2 py-0.5 rounded-[4px] bg-[#f4f4f5] dark:bg-[#14161f] text-[#000000] dark:text-white text-[11px] font-mono border border-[#ebebeb] dark:border-white/[0.08]">
                            {b.business_type}
                          </span>
                        </td>

                        {/* Location */}
                        <td className="py-3.5 px-4 text-[#959494]">
                          {b.city}, {b.country_code}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-[4px] font-mono text-[10px] uppercase tracking-wider ${
                              b.record_status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : b.record_status === 'archived'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {b.record_status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right font-mono">
                          <div className="inline-flex items-center space-x-1.5">
                            {b.record_status === 'archived' ? (
                              <button
                                type="button"
                                onClick={() => handleUnarchive([b.id])}
                                disabled={archiving}
                                title="Restore lead to active directory"
                                className="mono-btn bg-white dark:bg-[#14161f] hover:bg-emerald-50 dark:hover:bg-emerald-950/20 border border-[#ebebeb] dark:border-white/[0.08] text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-[4px] text-[11px] font-mono inline-flex items-center space-x-1 transition"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>RESTORE</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleArchive([b.id])}
                                disabled={archiving}
                                title="Archive lead (removes from active outreach)"
                                className="mono-btn bg-white dark:bg-[#14161f] hover:bg-amber-50 dark:hover:bg-amber-950/20 border border-[#ebebeb] dark:border-white/[0.08] text-[#959494] hover:text-amber-600 dark:hover:text-amber-400 px-2.5 py-1 rounded-[4px] text-[11px] font-mono inline-flex items-center space-x-1 transition"
                              >
                                <Archive className="w-3 h-3" />
                                <span>ARCHIVE</span>
                              </button>
                            )}

                            <Link
                              href={`/leads/${b.id}`}
                              className="mono-btn bg-white dark:bg-[#14161f] hover:bg-[#f4f4f5] dark:hover:bg-[#1c1d27] border border-[#ebebeb] dark:border-white/[0.08] text-[#000000] dark:text-white px-3 py-1 rounded-[4px] text-[11px] font-mono inline-flex items-center space-x-1"
                            >
                              <span>EVIDENCE</span>
                              <ChevronRight className="w-3 h-3" />
                            </Link>

                            <button
                              type="button"
                              onClick={() => handleDeleteLead(b.id, b.display_name)}
                              disabled={deletingLeadId === b.id}
                              title="Delete lead permanently"
                              className="mono-btn bg-white dark:bg-[#14161f] hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-[#ebebeb] dark:border-white/[0.08] text-[#959494] hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-[4px] text-[11px] font-mono inline-flex items-center transition"
                            >
                              <Trash2 className={`w-3 h-3 ${deletingLeadId === b.id ? 'animate-spin' : ''}`} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Floating Action Bar when Leads are selected (DESIGN.md Level 3 Elevation) */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#28352d] text-white border border-white/[0.16] rounded-[4px] px-5 py-3 shadow-2xl flex items-center space-x-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="font-mono text-xs flex items-center space-x-2">
            <span>
              <strong>{selectedIds.size}</strong> {selectedIds.size === 1 ? 'LEAD' : 'LEADS'} SELECTED
            </span>
          </div>

          <div className="h-4 w-px bg-white/20" />

          {selectedMissingEmail.length > 0 && (
            <button
              onClick={() => handleBulkEnrich(selectedMissingEmail.map((b) => b.id))}
              disabled={bulkEnriching}
              className="mono-btn bg-[#313641] hover:bg-[#3d4352] text-white border border-white/[0.12] px-3 py-1.5 rounded-[4px] text-xs font-mono font-medium uppercase tracking-wider flex items-center space-x-1.5 transition disabled:opacity-50"
            >
              <Sparkles className="w-3 h-3 text-[#bdc8b5]" />
              <span>ENRICH ({selectedMissingEmail.length})</span>
            </button>
          )}

          {statusFilter === 'archived' ? (
            <button
              onClick={() => handleUnarchive(Array.from(selectedIds))}
              disabled={archiving}
              className="mono-btn bg-[#313641] hover:bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-[4px] text-xs font-mono font-medium uppercase tracking-wider flex items-center space-x-1.5 transition disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3" />
              <span>RESTORE ({selectedIds.size})</span>
            </button>
          ) : (
            <button
              onClick={() => handleArchive(Array.from(selectedIds))}
              disabled={archiving}
              className="mono-btn bg-[#313641] hover:bg-rose-950/40 text-rose-300 border border-rose-500/30 px-3 py-1.5 rounded-[4px] text-xs font-mono font-medium uppercase tracking-wider flex items-center space-x-1.5 transition disabled:opacity-50"
            >
              <Archive className="w-3 h-3 text-[#71866e]" />
              <span>ARCHIVE ({selectedIds.size})</span>
            </button>
          )}

          <button
            onClick={handleDeleteSelected}
            disabled={deletingDuplicates}
            className="mono-btn bg-[#313641] hover:bg-rose-950/40 text-rose-300 border border-rose-500/30 px-3 py-1.5 rounded-[4px] text-xs font-mono font-medium uppercase tracking-wider flex items-center space-x-1.5 transition disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3 text-rose-400" />
            <span>DELETE ({selectedIds.size})</span>
          </button>

          <button
            onClick={() => {
              setOutreachStep('recipients');
              setPreviewLeadIdx(0);
              setTestResult(null);
              setTestError(null);
              setDispatchSummary(null);
              setDispatchResults([]);
              setShowOutreachModal(true);
            }}
            className="mono-btn bg-white hover:bg-[#ebebeb] text-[#010120] px-4 py-1.5 rounded-[4px] text-xs font-mono font-medium uppercase tracking-wider flex items-center space-x-1.5 transition"
          >
            <Send className="w-3 h-3 text-[#010120]" />
            <span>START OUTREACH</span>
          </button>

          <button
            onClick={handleClearSelection}
            className="text-xs font-mono text-[#959494] hover:text-white transition"
          >
            CLEAR
          </button>
        </div>
      )}

      {/* Outreach Dispatch Modal: Strictly unified with CSV Direct Outreach */}
      {showOutreachModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#010120] border border-[#ebebeb] dark:border-white/[0.12] rounded-[4px] w-full max-w-5xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 space-y-6">
            <div className="brand-gradient-h -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 mb-6" />

            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#ebebeb] dark:border-white/[0.08] gap-4">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-mono tracking-wider uppercase mb-1 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 text-[#959494] font-medium">
                    <Send className="w-2.5 h-2.5 text-[#71866e]" />
                    OUTREACH PIPELINE
                  </span>
                  <span className="text-[#959494]/40">•</span>
                  <span className="inline-flex items-center gap-1 text-[#71866e] font-semibold">
                    <Sparkles className="w-2.5 h-2.5" />
                    AI ENGINE
                  </span>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-xl font-medium tracking-tight text-black dark:text-white whitespace-nowrap">
                    Direct Outreach to Leads
                  </h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#f8fafc] dark:bg-white/[0.06] border border-[#ebebeb] dark:border-white/[0.08] text-[#959494] inline-flex items-center gap-1 whitespace-nowrap">
                    <Users className="w-3 h-3 text-[#959494]" />
                    {activeRecipients.length} ready
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
                {/* Stepper Pill Indicator with Icons */}
                <div className="flex items-center space-x-1 bg-[#f8fafc] dark:bg-[#313641]/40 border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] p-1 text-xs font-mono">
                  {[
                    { id: 'recipients', icon: Users, label: 'Candidates' },
                    { id: 'template', icon: PenLine, label: 'Compose' },
                    { id: 'test_sent', icon: ShieldCheck, label: 'Test' },
                    { id: 'dispatched', icon: Send, label: 'Dispatched' },
                  ].map((s) => {
                    const active = outreachStep === s.id;
                    const StepIcon = s.icon;
                    return (
                      <span
                        key={s.id}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] text-[11px] font-mono whitespace-nowrap transition ${
                          active
                            ? 'bg-black dark:bg-white text-white dark:text-black font-semibold shadow-sm'
                            : 'text-[#959494]'
                        }`}
                      >
                        <StepIcon className="w-3 h-3 shrink-0" />
                        <span>{s.label}</span>
                      </span>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleOpenInFullCsvOutreach}
                  title="Open in Full-Screen CSV Outreach Page"
                  className="mono-btn hidden md:inline-flex items-center gap-1 text-xs text-[#71866e] hover:underline font-mono px-2 py-1 rounded hover:bg-[#71866e]/10 transition whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Full Page</span>
                </button>

                <button
                  onClick={() => setShowOutreachModal(false)}
                  className="text-[#959494] hover:text-black dark:hover:text-white p-1 rounded hover:bg-neutral-100 dark:hover:bg-white/[0.08] transition"
                  aria-label="Close dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* STEP 1: CANDIDATES & AI CLASSIFICATION */}
            {outreachStep === 'recipients' && (
              <div className="space-y-5 font-mono text-xs">
                {/* Stats Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px]">
                    <div className="flex items-center justify-between text-[#959494] text-[10px] uppercase font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3 h-3 text-[#959494]" />
                        Candidates
                      </span>
                    </div>
                    <div className="text-xl font-semibold text-black dark:text-white mt-1">
                      {outreachCandidates.length}
                    </div>
                  </div>
                  <div className="p-3 bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px]">
                    <div className="flex items-center justify-between text-[#959494] text-[10px] uppercase font-semibold">
                      <span className="flex items-center gap-1.5">
                        <MailCheck className="w-3 h-3 text-emerald-500" />
                        Valid Emails
                      </span>
                    </div>
                    <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                      {activeRecipients.length}
                    </div>
                  </div>
                  <div className="p-3 bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px]">
                    <div className="flex items-center justify-between text-[#959494] text-[10px] uppercase font-semibold">
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="w-3 h-3 text-amber-500" />
                        Missing Email
                      </span>
                    </div>
                    <div className="text-xl font-semibold text-amber-600 dark:text-amber-400 mt-1 flex items-center justify-between">
                      <span>{outreachCandidates.length - activeRecipients.length}</span>
                      {outreachCandidates.length - activeRecipients.length > 0 && (
                        <button
                          onClick={() => handleBulkEnrich(selectedMissingEmail.map((b) => b.id))}
                          disabled={bulkEnriching}
                          className="mono-btn text-[10px] px-2 py-0.5 rounded-[3px] bg-black dark:bg-white text-white dark:text-black uppercase font-semibold disabled:opacity-50 inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>{bulkEnriching ? 'Enriching...' : 'Enrich'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Flat Technical AI Reasoning & Adaptation Bar (workspace style) */}
                <div className="ai-flat-container overflow-hidden">
                  {/* Active Linear Scanner when Enriching, otherwise static 2px brand ribbon */}
                  {aiEnrichingModal ? (
                    <div className="w-full h-[2px] bg-neutral-200 dark:bg-white/[0.08] overflow-hidden relative">
                      <div className="w-1/3 h-full bg-gradient-to-r from-[#fc4c02] via-[#71866e] to-[#bdc8b5] animate-flat-scan" />
                    </div>
                  ) : (
                    <div className="brand-gradient-h w-full" />
                  )}

                  <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="mono-eyebrow text-[#959494] text-[10px] tracking-[0.55px] uppercase font-semibold flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-[#71866e]" />
                          AI REASONING & COPY ADAPTATION
                        </span>
                        {aiEnrichingModal && (
                          <span className="ai-flat-pill text-black dark:text-white border-[#ebebeb] dark:border-white/[0.12] inline-flex items-center gap-1">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                            <span>SYNTHESIZING...</span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-mono text-black dark:text-white leading-relaxed">
                        {aiEnrichingModal
                          ? `Evaluating ${activeRecipients.length} candidate businesses: deducing operating verticals, friction points, and bespoke angles...`
                          : aiEnrichedModal
                          ? `All ${activeRecipients.length} candidate businesses enriched with tailored value propositions.`
                          : 'Uses neural reasoning to deduce company verticals, friction points, and bespoke value props per prospect.'}
                      </div>

                      <div className="text-[11px] text-[#959494] font-mono flex flex-wrap items-center gap-2 pt-0.5">
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3 h-3 text-[#959494]" />
                          {activeRecipients.length} prospects
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 text-[#71866e] font-semibold">
                          <Cpu className="w-3 h-3" />
                          Deduces:
                        </span>
                        {['vertical', 'pain_point', 'value_prop', 'pitch'].map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/[0.06] text-[10px] font-mono text-black dark:text-white whitespace-nowrap"
                          >
                            +{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Flat Technical Action Button */}
                    <div className="shrink-0 self-start md:self-auto">
                      <button
                        type="button"
                        onClick={handleEnrichModalWithAi}
                        disabled={aiEnrichingModal || activeRecipients.length === 0}
                        className={`mono-btn px-4 py-2 rounded-[4px] text-xs font-mono font-medium uppercase tracking-wider flex items-center space-x-2 transition whitespace-nowrap ${
                          aiEnrichingModal
                            ? 'bg-neutral-100 dark:bg-white/[0.08] text-neutral-400 cursor-not-allowed border border-[#ebebeb] dark:border-white/[0.08]'
                            : aiEnrichedModal
                            ? 'bg-white dark:bg-[#14161f] text-black dark:text-white border border-[#ebebeb] dark:border-white/[0.16] hover:border-black dark:hover:border-white'
                            : 'bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200'
                        }`}
                      >
                        {aiEnrichingModal ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>INFERRING...</span>
                          </>
                        ) : aiEnrichedModal ? (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>RE-ENRICH ALL</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-[#71866e]" />
                            <span>ENRICH ALL WITH AI</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Candidate Preview Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="mono-eyebrow text-[#6b7280] dark:text-[#959494] font-semibold text-[11px] flex items-center gap-1.5">
                      <Layers className="w-3 h-3 text-[#959494]" />
                      CANDIDATE LEADS PREVIEW
                    </span>
                    <span className="text-[11px] text-[#959494] flex items-center gap-1 font-mono">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      {activeRecipients.length} valid email recipients
                    </span>
                  </div>

                  <div className="border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] overflow-hidden overflow-x-auto max-h-56">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-[#f8fafc] dark:bg-[#313641]/30 border-b border-[#ebebeb] dark:border-white/[0.08] text-[#959494] sticky top-0 bg-opacity-95">
                        <tr>
                          <th className="py-2 px-3 whitespace-nowrap">#</th>
                          <th className="py-2 px-3 text-[#71866e] whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              AI TYPE
                            </span>
                          </th>
                          <th className="py-2 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-[#959494]" />
                              COMPANY
                            </span>
                          </th>
                          <th className="py-2 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <Mail className="w-3 h-3 text-[#959494]" />
                              EMAIL
                            </span>
                          </th>
                          <th className="py-2 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-[#959494]" />
                              CITY
                            </span>
                          </th>
                          <th className="py-2 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <Globe className="w-3 h-3 text-[#959494]" />
                              WEBSITE
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ebebeb] dark:divide-white/[0.06]">
                        {outreachCandidates.slice(0, 15).map((row, idx) => (
                          <tr key={idx} className="hover:bg-[#f8fafc] dark:hover:bg-white/[0.02]">
                            <td className="py-2 px-3 text-[#959494] whitespace-nowrap">{idx + 1}</td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span className="ai-flat-pill animate-ios-swish text-[10px]">
                                <span className="w-1 h-1 rounded-[1px] bg-[#71866e]" />
                                <span>{row.ai_company_type || row.company_type || 'Commercial Enterprise'}</span>
                              </span>
                            </td>
                            <td className="py-2 px-3 text-black dark:text-white font-medium whitespace-nowrap truncate max-w-[160px]">
                              {row.company_name}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              {row.email ? (
                                <span className="text-emerald-600 dark:text-emerald-400">{row.email}</span>
                              ) : (
                                <span className="text-rose-500 text-[10px] inline-flex items-center gap-1">
                                  <AlertCircle className="w-2.5 h-2.5" />
                                  Missing Email
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-[#959494] whitespace-nowrap">{row.city || '—'}</td>
                            <td className="py-2 px-3 text-[#959494] truncate max-w-xs whitespace-nowrap">{row.website || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-4 border-t border-[#ebebeb] dark:border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setShowOutreachModal(false)}
                    className="text-xs font-mono text-[#959494] hover:text-black dark:hover:text-white inline-flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>

                  <button
                    onClick={() => setOutreachStep('template')}
                    disabled={activeRecipients.length === 0}
                    className="mono-btn bg-black dark:bg-white text-white dark:text-black px-5 py-2.5 rounded-[4px] text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition active:scale-95 disabled:opacity-50 whitespace-nowrap"
                  >
                    <span>Compose Template ({activeRecipients.length})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: COMPOSE TEMPLATE & REAL-TIME PREVIEW */}
            {outreachStep === 'template' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Editor & Variables Toolbar */}
                  <div className="lg:col-span-7 bg-white dark:bg-[#010120] border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] p-5 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-[#ebebeb] dark:border-white/[0.08]">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <PenLine className="w-3.5 h-3.5 text-[#71866e]" />
                          <h4 className="text-sm font-semibold text-black dark:text-white">
                            Compose Outreach Template
                          </h4>
                        </div>
                        <p className="text-[11px] text-[#959494] font-mono mt-0.5">
                          Click dynamic chips to insert personalized tokens
                        </p>
                      </div>
                      <button
                        onClick={() => setOutreachStep('recipients')}
                        className="mono-btn text-xs text-[#6b7280] dark:text-[#959494] hover:text-black dark:hover:text-white flex items-center space-x-1 whitespace-nowrap"
                      >
                        <ArrowLeft className="w-3 h-3" />
                        <span>Back</span>
                      </button>
                    </div>

                    {/* Flat Technical AI Variable Tokens */}
                    <div className="ai-flat-container overflow-hidden">
                      <div className="brand-gradient-h w-full" />
                      <div className="p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5 text-black dark:text-white font-mono text-xs font-semibold">
                            <Sparkles className="w-3 h-3 text-[#71866e]" />
                            <span>AI ADAPTATION TOKENS</span>
                          </div>
                          <span className="text-[10px] font-mono text-[#959494] hidden sm:inline">
                            Dynamically evaluated per lead
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { token: 'company_type', label: 'company_type', desc: 'Identified Business Type' },
                            { token: 'personalized_pitch', label: 'pitch', desc: 'Tailored Industry Pitch' },
                            { token: 'handcrafted_observation', label: 'observation', desc: 'Bespoke Human Observation' },
                            { token: 'pain_point', label: 'pain_point', desc: 'Industry Specific Bottleneck' },
                            { token: 'value_prop', label: 'value_prop', desc: 'Tailored Solution' },
                            { token: 'industry', label: 'industry', desc: 'High-Level Industry' },
                          ].map((v) => (
                            <button
                              key={v.token}
                              type="button"
                              onClick={() => handleInsertVariable(v.token)}
                              className="mono-btn text-[11px] font-mono px-2.5 py-1 rounded-[3px] bg-[#f8fafc] dark:bg-[#14161f] border border-[#ebebeb] dark:border-white/[0.12] text-black dark:text-white hover:border-[#71866e] transition inline-flex items-center gap-1 whitespace-nowrap"
                              title={v.desc}
                            >
                              <Sparkles className="w-2.5 h-2.5 text-[#71866e]" />
                              <span>+{`{${v.token}}`}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Standard Contact Variables */}
                    <div>
                      <div className="mono-eyebrow text-[#6b7280] dark:text-[#959494] mb-1.5 text-[10px] font-semibold flex items-center gap-1">
                        <Users className="w-2.5 h-2.5 text-[#959494]" />
                        <span>STANDARD CONTACT VARIABLES</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { token: 'first_name', icon: User },
                          { token: 'company_name', icon: Building2 },
                          { token: 'website', icon: Globe },
                          { token: 'city', icon: MapPin },
                          { token: 'email', icon: Mail },
                        ].map((v) => {
                          const VIcon = v.icon;
                          return (
                            <button
                              key={v.token}
                              type="button"
                              onClick={() => handleInsertVariable(v.token)}
                              className="mono-btn text-[11px] px-2 py-0.5 rounded-[3px] bg-[#f8fafc] dark:bg-[#313641]/30 border border-[#ebebeb] dark:border-white/[0.08] text-black dark:text-white hover:border-black dark:hover:border-white transition inline-flex items-center gap-1 whitespace-nowrap"
                            >
                              <VIcon className="w-2.5 h-2.5 text-[#959494]" />
                              <span>+{`{${v.token}}`}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Handcrafted Template Presets */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="mono-eyebrow text-[#6b7280] dark:text-[#959494] text-[10px] font-semibold flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 text-[#71866e]" />
                          <span>HANDCRAFTED 1-TO-1 TEMPLATE PRESETS</span>
                        </span>
                        <span className="text-[9px] font-mono text-[#959494]">Unique per company</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setOutreachSubject('quick note regarding {company_name}');
                            setOutreachBody(
                              'Hi {first_name},\n\nSaw {company_name} while researching top {company_type} teams in {city}. {personalized_pitch}\n\nWe recently helped another {company_type} solve {pain_point} with {value_prop} — without adding any extra staff overhead.\n\nOpen to a quick 2-minute glance at how it works? Happy to send a 60-second walkthrough if helpful.\n\nBest,\nOperator'
                            );
                          }}
                          className="text-left p-2.5 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] bg-[#f8fafc] dark:bg-[#313641]/20 hover:border-[#71866e] transition"
                        >
                          <div className="text-[11px] font-semibold text-black dark:text-white flex items-center justify-between">
                            <span>✍️ Observational</span>
                            <span className="text-[8px] uppercase font-mono px-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Best</span>
                          </div>
                          <p className="text-[10px] text-[#6b7280] dark:text-[#959494] leading-tight mt-1">
                            Authentic peer observation grounded in company & location.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setOutreachSubject('thought for {company_name}');
                            setOutreachBody(
                              'Hi {first_name},\n\nReally impressed by what you\'re doing with {company_name}. {personalized_pitch}\n\nCurious how your team is currently handling {pain_point}? We put together {value_prop} that cuts out the busywork entirely.\n\nNo pitch — happy to share a quick screenshot if this is top of mind right now.\n\nBest regards,\nOperator'
                            );
                          }}
                          className="text-left p-2.5 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] bg-[#f8fafc] dark:bg-[#313641]/20 hover:border-[#71866e] transition"
                        >
                          <div className="text-[11px] font-semibold text-black dark:text-white">
                            🤝 Founder-to-Founder
                          </div>
                          <p className="text-[10px] text-[#6b7280] dark:text-[#959494] leading-tight mt-1">
                            Warm consultative tone with zero-friction permission ask.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setOutreachSubject('{company_name} / quick question');
                            setOutreachBody(
                              'Hi {first_name},\n\nQuick observation on {company_name} in {city}: {personalized_pitch}\n\nWe set up {value_prop} to tackle {pain_point} without extra team overhead.\n\nWorth a 2-minute glance this week?\n\nBest,\nOperator'
                            );
                          }}
                          className="text-left p-2.5 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] bg-[#f8fafc] dark:bg-[#313641]/20 hover:border-[#71866e] transition"
                        >
                          <div className="text-[11px] font-semibold text-black dark:text-white">
                            ⚡ Ultra-Concise
                          </div>
                          <p className="text-[10px] text-[#6b7280] dark:text-[#959494] leading-tight mt-1">
                            Under 50 words, fast mobile scan, direct value focus.
                          </p>
                        </button>
                      </div>
                    </div>

                    {/* Subject Line Input */}
                    <div>
                      <label className="mono-eyebrow text-[#6b7280] dark:text-[#959494] flex items-center gap-1 mb-1 text-[11px]">
                        <Mail className="w-3 h-3 text-[#959494]" />
                        <span>SUBJECT LINE</span>
                      </label>
                      <input
                        type="text"
                        value={outreachSubject}
                        onChange={(e) => setOutreachSubject(e.target.value)}
                        placeholder="e.g. Quick question regarding {company_name}"
                        className="w-full text-xs font-mono border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] rounded-[4px] p-2.5 text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                      />
                    </div>

                    {/* Body Textarea */}
                    <div>
                      <label className="mono-eyebrow text-[#6b7280] dark:text-[#959494] flex items-center gap-1 mb-1 text-[11px]">
                        <FileText className="w-3 h-3 text-[#959494]" />
                        <span>EMAIL BODY TEMPLATE</span>
                      </label>
                      <textarea
                        ref={outreachTextareaRef}
                        rows={8}
                        value={outreachBody}
                        onChange={(e) => setOutreachBody(e.target.value)}
                        placeholder="Hi {first_name},\n\nWrite your message here..."
                        className="w-full text-xs font-mono leading-relaxed border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] rounded-[4px] p-3 text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                      />
                    </div>

                    {/* Test Error Alert */}
                    {testError && (
                      <div className="p-3 rounded-[4px] border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-mono flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{testError}</span>
                      </div>
                    )}

                    {/* Send Test to Myself Safety Gate */}
                    <div className="pt-3 border-t border-[#ebebeb] dark:border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="text-xs font-mono text-[#6b7280] dark:text-[#959494] flex items-center space-x-1.5 whitespace-nowrap">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Pre-flight verification required</span>
                      </div>

                      <button
                        onClick={handleSendTestToSelf}
                        disabled={testSending || !outreachSubject || !outreachBody}
                        className="mono-btn bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 px-4 py-2 rounded-[4px] text-xs font-semibold flex items-center space-x-2 shadow-sm transition active:scale-95 disabled:opacity-50 whitespace-nowrap"
                      >
                        {testSending ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>SENDING TEST...</span>
                          </>
                        ) : (
                          <>
                            <Mail className="w-3.5 h-3.5" />
                            <span>SEND TEST TO MYSELF</span>
                            <ArrowRight className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Live Variable Preview Sidebar */}
                  <div className="lg:col-span-5 bg-white dark:bg-[#010120] border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] p-5 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-[#ebebeb] dark:border-white/[0.08]">
                      <div className="flex items-center space-x-2">
                        <Eye className="w-3.5 h-3.5 text-[#71866e]" />
                        <span className="mono-eyebrow text-black dark:text-white font-semibold text-[11px]">
                          LIVE PREVIEW
                        </span>
                      </div>

                      {/* Prospect Selector */}
                      {activeRecipients.length > 0 && (
                        <div className="relative inline-flex items-center">
                          <select
                            value={previewLeadIdx}
                            onChange={(e) => setPreviewLeadIdx(Number(e.target.value))}
                            className="appearance-none text-[11px] font-mono border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] rounded-[3px] pl-2.5 pr-7 py-1 text-black dark:text-white focus:outline-none focus:border-black cursor-pointer max-w-[180px] truncate"
                          >
                            {activeRecipients.slice(0, 20).map((r, i) => (
                              <option key={i} value={i}>
                                #{i + 1} {r.company_name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-3 h-3 absolute right-2 text-[#959494] pointer-events-none" />
                        </div>
                      )}
                    </div>

                    {/* Flat AI Synthesized Profile Card */}
                    <div className="ai-flat-container overflow-hidden">
                      <div className="brand-gradient-h w-full" />
                      <div className="p-3.5 space-y-2">
                        <div className="flex items-center justify-between pb-2 border-b border-[#ebebeb] dark:border-white/[0.06]">
                          <div className="flex items-center space-x-1.5 text-black dark:text-white text-xs font-mono font-semibold">
                            <Sparkles className="w-3 h-3 text-[#71866e]" />
                            <span>AI PROFILE</span>
                          </div>
                          <span className="ai-flat-pill text-[9px] truncate max-w-[140px]">
                            {sampleCandidate.ai_industry || sampleCandidate.industry || 'Commercial Services'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] font-mono uppercase text-[#959494] flex items-center gap-1">
                            <Building2 className="w-2.5 h-2.5" />
                            VERTICAL
                          </span>
                          <div className="text-xs font-semibold text-black dark:text-white font-mono mt-0.5">
                            {sampleCandidate.ai_company_type || sampleCandidate.company_type || 'Growing Business'}
                          </div>
                        </div>
                        {sampleCandidate.ai_pain_point && (
                          <div className="pt-1.5 border-t border-[#ebebeb] dark:border-white/[0.06]">
                            <span className="text-[9px] font-mono uppercase text-[#959494] flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />
                              OPERATIONAL FRICTION
                            </span>
                            <div className="text-[11px] font-mono text-black dark:text-white leading-snug mt-0.5">
                              {sampleCandidate.ai_pain_point}
                            </div>
                          </div>
                        )}
                        {sampleCandidate.ai_personalized_pitch && (
                          <div className="pt-1.5 border-t border-[#ebebeb] dark:border-white/[0.06]">
                            <span className="text-[9px] font-mono uppercase text-[#959494] flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-[#71866e]" />
                              BESPOKE PITCH
                            </span>
                            <div className="text-[11px] font-mono text-black dark:text-white leading-snug mt-0.5">
                              {sampleCandidate.ai_personalized_pitch}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#f8fafc] dark:bg-[#313641]/20 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] p-3.5 text-xs font-mono space-y-2.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="w-3 h-3 text-[#959494] shrink-0" />
                        <span className="text-[#959494] text-[10px] font-semibold">TO:</span>
                        <span className="text-black dark:text-white truncate">
                          {sampleCandidate.email || 'recipient@domain.com'}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-[#ebebeb] dark:border-white/[0.06]">
                        <span className="text-[#959494] block text-[10px] font-semibold mb-0.5">SUBJECT:</span>
                        <span className="text-black dark:text-white font-medium">{renderedSubject}</span>
                      </div>

                      <div className="pt-2 border-t border-[#ebebeb] dark:border-white/[0.06]">
                        <span className="text-[#959494] block text-[10px] font-semibold mb-1">BODY:</span>
                        <div className="whitespace-pre-line leading-relaxed text-[#374151] dark:text-[#d4d4d8]">
                          {renderedBody}
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] text-[11px] font-mono text-[#6b7280] dark:text-[#959494] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <Info className="w-3.5 h-3.5 text-[#959494] shrink-0" />
                        <span className="text-[#959494] whitespace-nowrap">Test destination:</span>
                        <strong className="text-black dark:text-white truncate">
                          {operatorEmail || 'logged-in email'}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: PRE-FLIGHT TEST VERIFICATION REVIEW */}
            {outreachStep === 'test_sent' && (
              <div className="max-w-2xl mx-auto space-y-5 font-mono text-xs">
                <div className="border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] rounded-[4px] p-6 space-y-5">
                  <div className="flex items-start space-x-3.5 mb-2">
                    <div className="w-8 h-8 rounded-[4px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-black dark:text-white">
                        Test Email Dispatched Successfully
                      </h4>
                      <p className="text-xs text-[#959494] font-mono mt-0.5">
                        Delivered rendered copy to <strong className="text-black dark:text-white">{operatorEmail}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#f8fafc] dark:bg-[#313641]/20 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] p-3.5 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[#959494] flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-[#959494]" />
                        PROVIDER
                      </span>
                      <span className="text-black dark:text-white font-semibold">AUTHENTICATED SMTP</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#959494] flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5 text-[#959494]" />
                        MESSAGE ID
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                        {testResult?.messageId || 'smtp_verified'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#959494] flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#959494]" />
                        SAMPLE LEAD
                      </span>
                      <span className="text-black dark:text-white font-semibold">{sampleCandidate.company_name}</span>
                    </div>
                  </div>

                  {/* SENDING CADENCE SELECTOR (ANTI-SPAM) */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-black dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#959494]" />
                        <span>Sending Cadence & Deliverability Pacing</span>
                      </label>
                      <span className="text-[10px] text-[#959494]">Anti-spam rate protection</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      {/* Option 1: Human Drip */}
                      <button
                        type="button"
                        onClick={() => setDispatchCadence('human')}
                        className={`text-left p-3 rounded-[4px] border transition-all ${
                          dispatchCadence === 'human'
                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/30'
                            : 'border-[#ebebeb] dark:border-white/[0.08] bg-[#f8fafc] dark:bg-[#313641]/20 text-[#6b7280] dark:text-[#959494] hover:border-black/20 dark:hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs text-black dark:text-white flex items-center gap-1">
                            Human Drip
                          </span>
                          <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-mono font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                            Recommended
                          </span>
                        </div>
                        <p className="text-[10px] text-[#6b7280] dark:text-[#959494] leading-relaxed">
                          45–75s randomized delay. Bypasses spam tripwires & mimics human sending rhythm.
                        </p>
                      </button>

                      {/* Option 2: Fast Pace */}
                      <button
                        type="button"
                        onClick={() => setDispatchCadence('fast')}
                        className={`text-left p-3 rounded-[4px] border transition-all ${
                          dispatchCadence === 'fast'
                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/30'
                            : 'border-[#ebebeb] dark:border-white/[0.08] bg-[#f8fafc] dark:bg-[#313641]/20 text-[#6b7280] dark:text-[#959494] hover:border-black/20 dark:hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs text-black dark:text-white">
                            Fast Pace
                          </span>
                          <span className="text-[9px] font-mono text-[#959494]">~15s</span>
                        </div>
                        <p className="text-[10px] text-[#6b7280] dark:text-[#959494] leading-relaxed">
                          15s delay between sends. Quick dispatch suitable for smaller batches (&lt;20 leads).
                        </p>
                      </button>

                      {/* Option 3: Immediate */}
                      <button
                        type="button"
                        onClick={() => setDispatchCadence('immediate')}
                        className={`text-left p-3 rounded-[4px] border transition-all ${
                          dispatchCadence === 'immediate'
                            ? 'border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300 ring-1 ring-amber-500/30'
                            : 'border-[#ebebeb] dark:border-white/[0.08] bg-[#f8fafc] dark:bg-[#313641]/20 text-[#6b7280] dark:text-[#959494] hover:border-black/20 dark:hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs text-black dark:text-white">
                            Immediate Burst
                          </span>
                          <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-mono font-bold bg-amber-500/20 text-amber-700 dark:text-amber-400">
                            Risky
                          </span>
                        </div>
                        <p className="text-[10px] text-[#6b7280] dark:text-[#959494] leading-relaxed">
                          Sends all at once. Highest risk of mailbox spam filters flagging your domain.
                        </p>
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-[4px] text-amber-700 dark:text-amber-400 space-y-1">
                    <div className="font-semibold flex items-center space-x-1.5">
                      <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500" />
                      <span>Ready for Live Dispatch</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Confirming will queue and transmit emails to all{' '}
                      <strong>{activeRecipients.length}</strong> selected businesses via durable background queue.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-[#ebebeb] dark:border-white/[0.08] flex items-center justify-between">
                    <button
                      onClick={() => setOutreachStep('template')}
                      className="mono-btn text-xs text-[#959494] hover:text-black dark:hover:text-white flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>Edit Template</span>
                    </button>

                    <button
                      onClick={handleDispatchOutreach}
                      disabled={dispatching}
                      className="mono-btn bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 px-5 py-2.5 rounded-[4px] text-xs font-semibold flex items-center space-x-2 shadow-md transition active:scale-95 disabled:opacity-50 whitespace-nowrap"
                    >
                      <Send className={`w-3.5 h-3.5 ${dispatching ? 'animate-spin' : ''}`} />
                      <span>
                        {dispatching
                          ? 'DISPATCHING LIVE...'
                          : `APPROVE & DISPATCH (${activeRecipients.length})`}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: DISPATCHED SUMMARY */}
            {outreachStep === 'dispatched' && (
              <div className="max-w-2xl mx-auto space-y-5 font-mono text-xs">
                <div className="border border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#010120] rounded-[4px] p-6 space-y-5">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-8 h-8 rounded-[4px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-black dark:text-white">
                        Live Outreach Sequence Completed
                      </h4>
                      <p className="text-xs text-[#959494] mt-0.5">
                        Transmitted live personalized emails to the selected leads.
                      </p>
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-[4px] bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.08]">
                      <span className="text-[#959494] flex items-center gap-1 text-[10px] whitespace-nowrap">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        QUEUED / SENT
                      </span>
                      <span className="text-base font-semibold text-emerald-600 dark:text-emerald-400 mt-1 block">
                        {dispatchSummary?.sent || 0}
                      </span>
                    </div>
                    <div className="p-3 rounded-[4px] bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.08]">
                      <span className="text-[#959494] flex items-center gap-1 text-[10px] whitespace-nowrap">
                        <ShieldAlert className="w-3 h-3 text-amber-500" />
                        SUPPRESSED
                      </span>
                      <span className="text-base font-semibold text-amber-600 dark:text-amber-400 mt-1 block">
                        {dispatchSummary?.suppressed || 0}
                      </span>
                    </div>
                    <div className="p-3 rounded-[4px] bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.08]">
                      <span className="text-[#959494] flex items-center gap-1 text-[10px] whitespace-nowrap">
                        <AlertTriangle className="w-3 h-3 text-rose-500" />
                        FAILED
                      </span>
                      <span className="text-base font-semibold text-rose-600 dark:text-rose-400 mt-1 block">
                        {dispatchSummary?.failed || 0}
                      </span>
                    </div>
                    <div className="p-3 rounded-[4px] bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.08]">
                      <span className="text-[#959494] flex items-center gap-1 text-[10px] whitespace-nowrap">
                        <Clock className="w-3 h-3 text-blue-500" />
                        CADENCE
                      </span>
                      <span className="text-xs font-semibold text-black dark:text-white mt-1.5 block capitalize truncate">
                        {dispatchCadence === 'human'
                          ? 'Human Drip'
                          : dispatchCadence === 'fast'
                          ? 'Fast Pace'
                          : 'Immediate'}
                      </span>
                    </div>
                  </div>

                  {/* Itemized Recipient Table */}
                  {dispatchResults.length > 0 && (
                    <div className="border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] overflow-hidden max-h-56 overflow-y-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-[#f8fafc] dark:bg-[#313641]/30 border-b border-[#ebebeb] dark:border-white/[0.08] text-[#959494]">
                          <tr>
                            <th className="py-2 px-3 whitespace-nowrap">
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                RECIPIENT
                              </span>
                            </th>
                            <th className="py-2 px-3 text-[#71866e] whitespace-nowrap">
                              <span className="flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                AI TYPE
                              </span>
                            </th>
                            <th className="py-2 px-3 whitespace-nowrap">STATUS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#ebebeb] dark:divide-white/[0.06]">
                          {dispatchResults.map((r, i) => (
                            <tr key={i}>
                              <td className="py-2 px-3 text-black dark:text-white whitespace-nowrap">{r.email}</td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                <span className="ai-flat-pill text-[10px]">
                                  {r.companyType || 'Classified'}
                                </span>
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                <span
                                  className={`px-1.5 py-0.5 rounded-[2px] text-[10px] font-semibold uppercase ${
                                    r.status === 'sent'
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                      : r.status === 'suppressed'
                                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {r.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="pt-3 border-t border-[#ebebeb] dark:border-white/[0.08] flex items-center justify-between">
                    <Link
                      href="/outreach"
                      className="mono-btn px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-[4px] text-xs font-semibold inline-flex items-center space-x-1.5"
                    >
                      <span>VIEW LOGS</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setShowOutreachModal(false);
                        setOutreachStep('recipients');
                        setSelectedIds(new Set());
                      }}
                      className="mono-btn text-xs text-[#959494] hover:text-black dark:hover:text-white"
                    >
                      Done / Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CSV Import Modal: Strictly matching DESIGN.md */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0f1017] border border-[#ebebeb] dark:border-white/[0.12] rounded-[4px] w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 space-y-6">
            <div className="brand-gradient-h -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 mb-6" />

            <div className="flex items-center justify-between pb-4 border-b border-[#ebebeb] dark:border-white/[0.08]">
              <div>
                <div className="mono-eyebrow text-[#959494] font-mono text-[11px] font-medium tracking-[0.55px] uppercase">
                  DATA INGESTION
                </div>
                <h3 className="text-xl font-medium tracking-tight text-[#000000] dark:text-white mt-1">
                  Import Prospects from CSV
                </h3>
              </div>
              <button
                onClick={() => setShowCsvModal(false)}
                className="text-[#959494] hover:text-[#000000] dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success state */}
            {importResult ? (
              <div className="space-y-4 py-2 font-mono text-xs">
                <div className="p-4 rounded-[4px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 space-y-1">
                  <div className="font-medium flex items-center space-x-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>CSV Leads Successfully Ingested</span>
                  </div>
                  <div className="mt-2 space-y-0.5 text-[11px]">
                    <div>• <strong>{importResult.importedCount}</strong> new leads added to directory</div>
                    <div>• <strong>{importResult.duplicateCount}</strong> duplicates deduplicated</div>
                    {importResult.enrichedCount > 0 && (
                      <div>• <strong>{importResult.enrichedCount}</strong> contacts enriched via Web Inspection & Gemini AI</div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-[#ebebeb] dark:border-white/[0.08]">
                  <button
                    onClick={() => {
                      setShowCsvModal(false);
                      setImportResult(null);
                    }}
                    className="mono-btn bg-[#000000] dark:bg-white text-white dark:text-[#000000] px-5 py-2 rounded-[4px] text-xs font-mono uppercase font-medium"
                  >
                    CLOSE & VIEW LEADS
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {!csvResult ? (
                  <div className="space-y-4">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border border-dashed border-[#ebebeb] dark:border-white/[0.12] hover:border-[#000000] dark:hover:border-white rounded-[4px] p-8 text-center cursor-pointer transition bg-[#f8fafc] dark:bg-[#14161f]"
                    >
                      <UploadCloud className="w-8 h-8 text-[#959494] mx-auto mb-3" />
                      <div className="text-xs font-mono font-medium text-[#000000] dark:text-white">
                        CLICK TO UPLOAD CSV OR DRAG AND DROP
                      </div>
                      <div className="text-[11px] text-[#959494] font-mono mt-1">
                        Requires Company Name. Email, Website, Phone, and City are auto-detected.
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>

                    <div className="text-center">
                      <span className="text-[11px] text-[#959494] font-mono uppercase tracking-wider">OR</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleLoadSampleCsv}
                      className="w-full py-2.5 px-4 rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] text-xs font-mono text-[#000000] dark:text-white hover:bg-[#f8fafc] dark:hover:bg-[#14161f] transition uppercase tracking-wider"
                    >
                      Use Sample B2B Prospects CSV
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between p-3 bg-[#f8fafc] dark:bg-[#14161f] rounded-[4px] border border-[#ebebeb] dark:border-white/[0.08] text-xs font-mono">
                      <span className="text-[#000000] dark:text-white truncate max-w-xs">{fileName}</span>
                      <span className="text-[#959494]">{csvResult.rows.length} rows detected</span>
                    </div>

                    {/* Mapping Selectors */}
                    <div>
                      <div className="mono-eyebrow text-[#959494] text-[11px] mb-2 font-mono">
                        COLUMN MAPPING (AUTO-DETECTED)
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                          { key: 'companyName', label: 'Company Name*', required: true },
                          { key: 'website', label: 'Website / Domain' },
                          { key: 'email', label: 'Email (Optional)' },
                          { key: 'firstName', label: 'Contact Name' },
                          { key: 'phone', label: 'Phone' },
                          { key: 'city', label: 'City / Location' },
                        ].map((field) => (
                          <div key={field.key} className="space-y-1">
                            <label className="text-[10px] font-mono text-[#959494]">
                              {field.label}
                            </label>
                            <div className="relative">
                              <select
                                value={mapping[field.key as keyof CsvColumnMapping] || ''}
                                onChange={(e) =>
                                  setMapping({
                                    ...mapping,
                                    [field.key]: e.target.value || null,
                                  })
                                }
                                className="w-full appearance-none text-xs font-mono bg-white dark:bg-[#14161f] border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] pl-2.5 pr-7 py-1.5 focus:outline-none focus:border-[#000000] dark:focus:border-white text-[#000000] dark:text-white cursor-pointer"
                              >
                                <option value="">-- None --</option>
                                {csvResult.headers.map((h: string) => (
                                  <option key={h} value={h}>
                                    {h}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-[#959494] pointer-events-none" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Auto-Enrich Toggle */}
                    <div className="p-3 bg-[#f8fafc] dark:bg-[#14161f] border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <Sparkles className="w-4 h-4 text-[#bdc8b5] shrink-0" />
                        <div>
                          <div className="text-xs font-mono text-[#000000] dark:text-white font-medium">
                            Auto-enrich missing emails on import
                          </div>
                          <div className="text-[11px] text-[#959494] font-mono">
                            Uses Deep Web Crawler & Free Gemini AI with DNS MX checks.
                          </div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={autoEnrichOnImport}
                        onChange={(e) => setAutoEnrichOnImport(e.target.checked)}
                        className="w-4 h-4 accent-[#000000] dark:accent-white cursor-pointer"
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between pt-4 border-t border-[#ebebeb] dark:border-white/[0.08]">
                      <button
                        type="button"
                        onClick={() => {
                          setCsvResult(null);
                          setCsvContent('');
                          setFileName('');
                        }}
                        className="text-xs font-mono text-[#959494] hover:underline"
                      >
                        Choose different file
                      </button>

                      <button
                        type="button"
                        onClick={handleImportLeads}
                        disabled={importing || !mapping.companyName}
                        className="mono-btn bg-[#000000] dark:bg-white text-white dark:text-[#000000] px-5 py-2.5 rounded-[4px] text-xs font-mono uppercase font-medium flex items-center space-x-2 disabled:opacity-50"
                      >
                        <UploadCloud className={`w-3.5 h-3.5 ${importing ? 'animate-spin' : ''}`} />
                        <span>{importing ? 'IMPORTING & ENRICHING...' : `IMPORT ${csvResult.rows.length} LEADS`}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Duplicate Leads & Contacts Manager Modal */}
      {showDuplicatesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#010120] border border-[#ebebeb] dark:border-white/[0.12] rounded-[4px] w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6">
            <div className="brand-gradient-h -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 mb-6" />

            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#ebebeb] dark:border-white/[0.08] gap-4">
              <div>
                <div className="flex items-center space-x-2 text-[10px] font-mono tracking-widest text-[#959494] uppercase mb-1">
                  <span className="flex items-center gap-1 text-[#71866e]">
                    <Sparkles className="w-3 h-3" />
                    EVEE AI DEDUPLICATION ENGINE
                  </span>
                  <span>•</span>
                  <span>DIRECTORY INTEGRITY</span>
                </div>
                <h3 className="text-xl font-medium tracking-tight text-black dark:text-white">
                  Duplicate Leads & Contacts Manager
                </h3>
                <p className="text-xs text-[#959494] font-mono mt-0.5">
                  Cluster-based identity matching by canonical domain, general email, company name & city.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                {totalDuplicateLeadsCount + totalDuplicateContactsCount > 0 && (
                  <button
                    onClick={handleDeleteAllDuplicates}
                    disabled={deletingDuplicates}
                    className="mono-btn bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-[4px] text-xs font-mono font-medium uppercase tracking-wider flex items-center space-x-1.5 transition active:scale-95 disabled:opacity-50"
                  >
                    <Trash2 className={`w-3.5 h-3.5 ${deletingDuplicates ? 'animate-spin' : ''}`} />
                    <span>PURGE ALL DUPLICATES ({totalDuplicateLeadsCount + totalDuplicateContactsCount})</span>
                  </button>
                )}

                <button
                  onClick={() => setShowDuplicatesModal(false)}
                  className="text-[#959494] hover:text-black dark:hover:text-white p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Metric KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
              <div className="p-3 bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px]">
                <div className="text-[10px] uppercase font-semibold text-[#959494] flex items-center gap-1.5">
                  <CopyX className="w-3 h-3 text-amber-500" />
                  <span>DUPLICATE LEADS</span>
                </div>
                <div className="text-xl font-semibold text-amber-600 dark:text-amber-400 mt-1">
                  {totalDuplicateLeadsCount}
                </div>
              </div>

              <div className="p-3 bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px]">
                <div className="text-[10px] uppercase font-semibold text-[#959494] flex items-center gap-1.5">
                  <User className="w-3 h-3 text-rose-500" />
                  <span>REDUNDANT CONTACTS</span>
                </div>
                <div className="text-xl font-semibold text-rose-600 dark:text-rose-400 mt-1">
                  {totalDuplicateContactsCount}
                </div>
              </div>

              <div className="p-3 bg-[#f8fafc] dark:bg-[#313641]/20 border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px]">
                <div className="text-[10px] uppercase font-semibold text-[#959494] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span>CLEAN PROSPECTS</span>
                </div>
                <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                  {businesses.length - totalDuplicateLeadsCount}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center space-x-2 border-b border-[#ebebeb] dark:border-white/[0.08] pb-2 text-xs font-mono">
              <button
                onClick={() => setDuplicateActiveTab('leads')}
                className={`px-3 py-1.5 rounded-[4px] transition ${
                  duplicateActiveTab === 'leads'
                    ? 'bg-black dark:bg-white text-white dark:text-black font-semibold'
                    : 'text-[#959494] hover:text-black dark:hover:text-white'
                }`}
              >
                Duplicate Leads ({duplicateLeadGroups.length} groups)
              </button>
              <button
                onClick={() => setDuplicateActiveTab('contacts')}
                className={`px-3 py-1.5 rounded-[4px] transition ${
                  duplicateActiveTab === 'contacts'
                    ? 'bg-black dark:bg-white text-white dark:text-black font-semibold'
                    : 'text-[#959494] hover:text-black dark:hover:text-white'
                }`}
              >
                Duplicate Contacts ({duplicateContactGroups.length} groups)
              </button>
            </div>

            {/* Leads tab */}
            {duplicateActiveTab === 'leads' && (
              <div className="space-y-4 font-mono text-xs">
                {duplicateLeadGroups.length === 0 ? (
                  <div className="text-center py-12 border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px]">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <div className="text-sm font-semibold text-black dark:text-white">
                      Zero Duplicate Leads Detected
                    </div>
                    <div className="text-[11px] text-[#959494] mt-1">
                      Every business in your directory has a unique domain, email, and identity.
                    </div>
                  </div>
                ) : (
                  duplicateLeadGroups.map((group) => (
                    <div
                      key={group.id}
                      className="border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] p-4 bg-[#f8fafc]/50 dark:bg-[#14161f]/50 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="ai-flat-pill text-[10px]">
                            {group.reasonLabel}
                          </span>
                          <span className="text-[11px] text-[#959494]">
                            {group.all.length} matching records
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {/* Primary Record */}
                        <div className="p-3 bg-white dark:bg-[#010120] border border-emerald-500/30 rounded-[4px] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-black dark:text-white">
                                {group.primary.display_name}
                              </span>
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                                KEEP (PRIMARY)
                              </span>
                            </div>
                            <div className="text-[11px] text-[#959494] flex flex-wrap items-center gap-2">
                              {group.primary.general_business_email && (
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  {group.primary.general_business_email}
                                </span>
                              )}
                              {group.primary.official_website_url && (
                                <span>{group.primary.official_website_url}</span>
                              )}
                              {group.primary.city && <span>• {group.primary.city}</span>}
                            </div>
                          </div>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase">
                            Most Complete
                          </span>
                        </div>

                        {/* Duplicate Records */}
                        {group.duplicates.map((dup) => (
                          <div
                            key={dup.id}
                            className="p-3 bg-white dark:bg-[#010120] border border-rose-500/20 rounded-[4px] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-black dark:text-white">
                                  {dup.display_name}
                                </span>
                                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/20">
                                  DUPLICATE
                                </span>
                              </div>
                              <div className="text-[11px] text-[#959494] flex flex-wrap items-center gap-2">
                                {dup.general_business_email ? (
                                  <span>{dup.general_business_email}</span>
                                ) : (
                                  <span className="text-rose-400">No Email</span>
                                )}
                                {dup.official_website_url && <span>{dup.official_website_url}</span>}
                                {dup.city && <span>• {dup.city}</span>}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteLead(dup.id, dup.display_name)}
                              disabled={deletingLeadId === dup.id}
                              className="mono-btn px-2.5 py-1 rounded-[3px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center space-x-1 text-[11px] transition self-start sm:self-auto"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>DELETE</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Contacts tab */}
            {duplicateActiveTab === 'contacts' && (
              <div className="space-y-4 font-mono text-xs">
                {duplicateContactGroups.length === 0 ? (
                  <div className="text-center py-12 border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px]">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <div className="text-sm font-semibold text-black dark:text-white">
                      Zero Duplicate Contacts Detected
                    </div>
                    <div className="text-[11px] text-[#959494] mt-1">
                      No redundant email addresses detected across contacts.
                    </div>
                  </div>
                ) : (
                  duplicateContactGroups.map((group) => (
                    <div
                      key={group.id}
                      className="border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px] p-4 bg-[#f8fafc]/50 dark:bg-[#14161f]/50 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-black dark:text-white">
                            {group.businessName}
                          </span>
                          <span className="text-[#959494] text-[11px] ml-2">
                            Matching Contact Email: {group.matchValue}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {/* Primary contact */}
                        <div className="p-3 bg-white dark:bg-[#010120] border border-emerald-500/30 rounded-[4px] flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-black dark:text-white">
                                {group.primary.contact_name || 'Unnamed Contact'}
                              </span>
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                                KEEP
                              </span>
                            </div>
                            <div className="text-[11px] text-[#959494]">{group.primary.contact_email}</div>
                          </div>
                        </div>

                        {/* Duplicate contacts */}
                        {group.duplicates.map((dup) => (
                          <div
                            key={dup.id}
                            className="p-3 bg-white dark:bg-[#010120] border border-rose-500/20 rounded-[4px] flex items-center justify-between"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-black dark:text-white">
                                  {dup.contact_name || 'Unnamed Contact'}
                                </span>
                                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold">
                                  DUPLICATE
                                </span>
                              </div>
                              <div className="text-[11px] text-[#959494]">{dup.contact_email}</div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteContact(dup.id)}
                              className="mono-btn px-2.5 py-1 rounded-[3px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center space-x-1 text-[11px] transition"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>DELETE</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Email Quality & Proxy Cleaner Modal */}
      {showEmailAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#010120] border border-[#ebebeb] dark:border-white/[0.12] rounded-[4px] w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6">
            <div className="brand-gradient-h -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 mb-6" />

            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#ebebeb] dark:border-white/[0.08] gap-4">
              <div>
                <div className="flex items-center space-x-2 text-[10px] font-mono tracking-widest text-[#959494] uppercase mb-1">
                  <span className="flex items-center gap-1 text-[#71866e]">
                    <ShieldAlert className="w-3 h-3 text-[#71866e]" />
                    AI EMAIL QUALITY & DELIVERABILITY AUDIT
                  </span>
                  <span>•</span>
                  <span>INBOX HYGIENE</span>
                </div>
                <h3 className="text-xl font-medium tracking-tight text-black dark:text-white">
                  Fake, Proxy & Duplicate Email Cleaner
                </h3>
                <p className="text-xs text-[#959494] font-mono mt-0.5">
                  Filters aggregator delivery proxies (@swiggy.com, @redirect.foursquare.com), social profile handles (@instagram.com), fake placeholders, and duplicates.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                {totalFlaggedEmailsCount > 0 && (
                  <button
                    type="button"
                    onClick={handleArchiveAllFlagged}
                    disabled={cleaningFlagged}
                    className="mono-btn bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-[4px] text-xs font-mono uppercase tracking-wider flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <Archive className={`w-3.5 h-3.5 ${cleaningFlagged ? 'animate-spin' : ''}`} />
                    <span>ARCHIVE ALL FLAGGED ({totalFlaggedEmailsCount})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowEmailAuditModal(false)}
                  className="p-1 text-[#959494] hover:text-black dark:hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* KPI Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
              <div className="p-3.5 bg-neutral-50 dark:bg-[#14161f] border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px]">
                <div className="text-[10px] text-[#959494] uppercase tracking-wider">Total Flagged</div>
                <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                  {totalFlaggedEmailsCount}
                </div>
                <div className="text-[10px] text-[#959494] mt-0.5">Active leads affected</div>
              </div>

              <div className="p-3.5 bg-neutral-50 dark:bg-[#14161f] border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px]">
                <div className="text-[10px] text-[#959494] uppercase tracking-wider">Aggregator Proxies</div>
                <div className="text-xl font-bold text-amber-500 mt-1">
                  {emailAuditReport.flaggedByCategory.aggregator_proxy}
                </div>
                <div className="text-[10px] text-[#959494] mt-0.5">Swiggy, 4sq, Zomato</div>
              </div>

              <div className="p-3.5 bg-neutral-50 dark:bg-[#14161f] border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px]">
                <div className="text-[10px] text-[#959494] uppercase tracking-wider">Social Handles</div>
                <div className="text-xl font-bold text-purple-400 mt-1">
                  {emailAuditReport.flaggedByCategory.social_platform}
                </div>
                <div className="text-[10px] text-[#959494] mt-0.5">@instagram.com, FB</div>
              </div>

              <div className="p-3.5 bg-neutral-50 dark:bg-[#14161f] border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px]">
                <div className="text-[10px] text-[#959494] uppercase tracking-wider">Fake / Duplicates</div>
                <div className="text-xl font-bold text-blue-400 mt-1">
                  {emailAuditReport.flaggedByCategory.placeholder_fake + emailAuditReport.flaggedByCategory.duplicate_email + emailAuditReport.flaggedByCategory.non_email}
                </div>
                <div className="text-[10px] text-[#959494] mt-0.5">Test, malformed, shared</div>
              </div>
            </div>

            {/* Filter Pills & Selection Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs pt-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: `ALL (${totalFlaggedEmailsCount})` },
                  { id: 'aggregator_proxy', label: `PROXIES (${emailAuditReport.flaggedByCategory.aggregator_proxy})` },
                  { id: 'social_platform', label: `SOCIAL (${emailAuditReport.flaggedByCategory.social_platform})` },
                  { id: 'placeholder_fake', label: `FAKE / TEST (${emailAuditReport.flaggedByCategory.placeholder_fake})` },
                  { id: 'duplicate_email', label: `DUPLICATES (${emailAuditReport.flaggedByCategory.duplicate_email})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setAuditCategoryFilter(tab.id)}
                    className={`px-3 py-1 rounded-[4px] transition uppercase tracking-wider text-[11px] ${
                      auditCategoryFilter === tab.id
                        ? 'bg-black dark:bg-white text-white dark:text-black font-semibold'
                        : 'bg-neutral-100 dark:bg-white/[0.04] text-[#959494] hover:text-black dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {selectedFlaggedIds.size > 0 && (
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleArchiveFlagged(Array.from(selectedFlaggedIds))}
                    disabled={cleaningFlagged}
                    className="mono-btn px-3 py-1 bg-neutral-800 text-white dark:bg-white dark:text-black rounded-[4px] text-[11px] font-semibold flex items-center space-x-1"
                  >
                    <Archive className="w-3 h-3" />
                    <span>ARCHIVE SELECTED ({selectedFlaggedIds.size})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteFlagged(Array.from(selectedFlaggedIds))}
                    disabled={cleaningFlagged}
                    className="mono-btn px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-[4px] text-[11px] flex items-center space-x-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>DELETE</span>
                  </button>
                </div>
              )}
            </div>

            {/* List of Flagged Records */}
            <div className="space-y-3 font-mono text-xs">
              {emailAuditReport.flaggedLeads.length === 0 ? (
                <div className="text-center py-12 border border-[#ebebeb] dark:border-white/[0.08] rounded-[4px]">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <div className="text-sm font-semibold text-black dark:text-white">
                    Zero Fake or Proxy Emails Found
                  </div>
                  <div className="text-[11px] text-[#959494] mt-1">
                    All business emails in your active directory appear to be direct, verified inboxes.
                  </div>
                </div>
              ) : (
                (() => {
                  const filteredFlagged = emailAuditReport.flaggedLeads.filter((item) => {
                    if (auditCategoryFilter === 'all') return true;
                    return item.flag.category === auditCategoryFilter;
                  });

                  if (filteredFlagged.length === 0) {
                    return (
                      <div className="text-center py-8 text-neutral-500 text-xs">
                        No flagged emails match this specific category.
                      </div>
                    );
                  }

                  return filteredFlagged.map((item) => {
                    const isSelected = selectedFlaggedIds.has(item.leadId);
                    return (
                      <div
                        key={item.leadId}
                        className={`border rounded-[4px] p-4 transition ${
                          isSelected
                            ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-500/40'
                            : 'bg-[#f8fafc]/50 dark:bg-[#14161f]/50 border-[#ebebeb] dark:border-white/[0.08]'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start space-x-3">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedFlaggedIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(item.leadId)) next.delete(item.leadId);
                                  else next.add(item.leadId);
                                  return next;
                                });
                              }}
                              className="mt-1 text-neutral-400 hover:text-black dark:hover:text-white"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-black dark:text-white">
                                  {item.displayName}
                                </span>
                                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-semibold uppercase">
                                  {item.flag.categoryLabel}
                                </span>
                                {item.city && (
                                  <span className="text-[10px] text-neutral-500">• {item.city}</span>
                                )}
                              </div>

                              <div className="flex items-center space-x-2 text-xs">
                                <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold border border-rose-500/30">
                                  {item.email}
                                </span>
                                {item.officialWebsiteUrl && (
                                  <span className="text-[11px] text-neutral-400 truncate max-w-xs">
                                    {item.officialWebsiteUrl}
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] text-[#959494] mt-1 flex items-start gap-1.5">
                                <Info className="w-3.5 h-3.5 text-[#71866e] shrink-0 mt-0.5" />
                                <span>{item.flag.reason}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => handleArchiveFlagged([item.leadId])}
                              disabled={cleaningFlagged}
                              className="mono-btn px-2.5 py-1 rounded-[3px] bg-neutral-200 dark:bg-white/10 hover:bg-neutral-300 dark:hover:bg-white/20 text-black dark:text-white flex items-center space-x-1 text-[11px] transition"
                              title="Archive this lead to clean up active outreach directory"
                            >
                              <Archive className="w-3 h-3" />
                              <span>ARCHIVE</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteFlagged([item.leadId])}
                              disabled={cleaningFlagged}
                              className="mono-btn px-2.5 py-1 rounded-[3px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center space-x-1 text-[11px] transition"
                              title="Permanently delete lead"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>DELETE</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
