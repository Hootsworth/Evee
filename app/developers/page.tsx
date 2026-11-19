'use client';

import { useEffect, useState } from 'react';

type ApiKey = { id: string; name: string; key_prefix: string; scopes: string[]; created_at: string; last_used_at: string | null; revoked_at: string | null };
const scopeOptions = ['accounts:read', 'work:read', 'leads:write'];

export default function DevelopersPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['accounts:read']);
  const [newToken, setNewToken] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh() { const response = await fetch('/api/api-keys'); const data = await response.json(); if (response.ok) setKeys(data.keys || []); else setNotice(data.error); }
  useEffect(() => { void refresh(); }, []);
  async function createKey(event: React.FormEvent) { event.preventDefault(); setBusy(true); setNotice(''); try { const response = await fetch('/api/api-keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, scopes }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setNewToken(data.token); setName(''); await refresh(); } catch (error: any) { setNotice(error.message); } finally { setBusy(false); } }
  async function revoke(id: string) { setBusy(true); try { const response = await fetch(`/api/api-keys?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); const data = await response.json(); if (!response.ok) throw new Error(data.error); await refresh(); } catch (error: any) { setNotice(error.message); } finally { setBusy(false); } }
  return <main className="max-w-4xl mx-auto p-6 md:p-10 space-y-8"><header><p className="text-xs uppercase tracking-widest text-[#71866e] font-mono">Integrations</p><h1 className="text-3xl font-semibold mt-2">Developer API</h1><p className="text-sm text-[#777] mt-2">Create scoped keys for read access to accounts and work items. Keys are shown once and can be revoked by a manager.</p></header>
    {notice && <p role="status" className="text-sm text-rose-600">{notice}</p>}{newToken && <div className="rounded border border-amber-500/40 bg-amber-500/5 p-4"><p className="text-sm font-medium">Copy this key now. It cannot be shown again.</p><code className="block break-all mt-2 text-xs">{newToken}</code><button onClick={() => navigator.clipboard.writeText(newToken)} className="mt-3 rounded border px-3 py-1 text-xs">Copy key</button></div>}
    <form onSubmit={createKey} className="rounded border border-black/10 dark:border-white/10 p-5 space-y-4"><h2 className="font-semibold text-sm">Create API key</h2><input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Reporting integration" className="w-full rounded border border-black/15 dark:border-white/15 bg-transparent p-3 text-sm"/><div className="flex flex-wrap gap-4">{scopeOptions.map((scope) => <label key={scope} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={scopes.includes(scope)} onChange={() => setScopes((old) => old.includes(scope) ? old.filter((item) => item !== scope) : [...old, scope])}/>{scope}</label>)}</div><button disabled={busy || !scopes.length} className="rounded bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-xs disabled:opacity-40">Create key</button></form>
    <section className="space-y-3"><h2 className="font-semibold text-sm">API keys</h2>{keys.map((key) => <article key={key.id} className="flex items-center justify-between gap-4 rounded border border-black/10 dark:border-white/10 p-4"><div><p className="text-sm font-medium">{key.name} <code className="text-xs text-[#777]">{key.key_prefix}…</code></p><p className="text-xs text-[#777] mt-1">{key.scopes.join(', ')} · {key.revoked_at ? 'Revoked' : key.last_used_at ? `Last used ${new Date(key.last_used_at).toLocaleString()}` : 'Never used'}</p></div>{!key.revoked_at && <button disabled={busy} onClick={() => revoke(key.id)} className="text-xs text-rose-600">Revoke</button>}</article>)}{!keys.length && <p className="text-sm text-[#777]">No API keys created.</p>}</section>
    <section className="rounded border border-black/10 dark:border-white/10 p-5 space-y-2"><h2 className="font-semibold text-sm">Read endpoints</h2><code className="block text-xs">GET /api/v1/accounts</code><code className="block text-xs">GET /api/v1/work-items</code><p className="text-xs text-[#777]">Send the key as <code>Authorization: Bearer evee_live_…</code>. Request a key with only the scopes your integration needs.</p></section>
  </main>;
}
