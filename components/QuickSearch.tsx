'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Building2, MapPin, Mail, ExternalLink, ArrowRight, Loader2 } from 'lucide-react';

interface QuickSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickSearch({ isOpen, onClose }: QuickSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Live search debounced
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/businesses`);
        if (res.ok) {
          const data = await res.json();
          const q = query.toLowerCase().trim();
          const filtered = (data.businesses || [])
            .filter((b: any) => {
              const name = (b.display_name || '').toLowerCase();
              const email = (b.general_business_email || '').toLowerCase();
              const city = (b.city || '').toLowerCase();
              const site = (b.official_website_url || '').toLowerCase();
              return name.includes(q) || email.includes(q) || city.includes(q) || site.includes(q);
            })
            .slice(0, 8);
          setResults(filtered);
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error('Quick search error:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard navigation inside modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length > 0 && results[selectedIndex]) {
        handleSelectLead(results[selectedIndex]);
      } else if (query.trim()) {
        router.push(`/leads?search=${encodeURIComponent(query.trim())}`);
        onClose();
      }
    }
  };

  const handleSelectLead = (lead: any) => {
    onClose();
    router.push(`/leads/${lead.id}`);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-sm transition-all"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#0c0d1e] rounded-[4px] border border-[#ebebeb] dark:border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#ebebeb] dark:border-white/10 space-x-3 bg-neutral-50/50 dark:bg-white/[0.02]">
          <Search className="w-4 h-4 text-[#71866e]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a lead name, domain, city, or email address..."
            className="flex-1 bg-transparent text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none font-mono"
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />}
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="px-1.5 py-0.5 rounded-[2px] bg-black/5 dark:bg-white/10 text-[9px] font-mono text-neutral-500">
            ESC
          </kbd>
        </div>

        {/* Results Container */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-[#ebebeb] dark:divide-white/[0.06]">
          {query.trim() === '' ? (
            <div className="p-6 text-center">
              <p className="text-xs font-mono text-neutral-500 mb-4">QUICK NAVIGATION</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Leads Directory', href: '/leads' },
                  { label: 'Campaigns', href: '/campaigns' },
                  { label: 'Email Drafts', href: '/drafts' },
                  { label: 'Settings', href: '/settings' },
                ].map((item) => (
                  <button
                    key={item.href}
                    onClick={() => {
                      onClose();
                      router.push(item.href);
                    }}
                    className="p-2.5 rounded-[4px] bg-neutral-100 dark:bg-white/[0.04] hover:bg-neutral-200 dark:hover:bg-white/[0.08] text-left text-xs font-mono text-neutral-800 dark:text-neutral-200 transition"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="p-8 text-center text-xs font-mono text-neutral-500">
              No matching leads found for &quot;{query}&quot;.
              <button
                onClick={() => {
                  onClose();
                  router.push(`/leads?search=${encodeURIComponent(query)}`);
                }}
                className="mt-3 block mx-auto text-[#71866e] underline hover:text-[#d019a5]"
              >
                Search all leads in Directory &rarr;
              </button>
            </div>
          ) : (
            results.map((lead, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={lead.id}
                  onClick={() => handleSelectLead(lead)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-3.5 flex items-center justify-between cursor-pointer transition ${
                    isSelected
                      ? 'bg-neutral-100 dark:bg-white/[0.08]'
                      : 'hover:bg-neutral-50 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-8 h-8 rounded-[4px] bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                          {lead.display_name}
                        </span>
                        {lead.city && (
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded-[2px] bg-neutral-200 dark:bg-white/10 text-neutral-600 dark:text-neutral-400">
                            {lead.city}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-3 text-[11px] font-mono text-neutral-500 mt-0.5 truncate">
                        {lead.general_business_email && (
                          <span className="flex items-center space-x-1 truncate">
                            <Mail className="w-3 h-3 text-neutral-400 shrink-0" />
                            <span className="truncate">{lead.general_business_email}</span>
                          </span>
                        )}
                        {lead.official_website_url && (
                          <span className="flex items-center space-x-1 truncate text-neutral-400">
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">
                              {lead.official_website_url.replace(/^https?:\/\//, '')}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ArrowRight
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? 'text-[#71866e]' : 'text-neutral-300 dark:text-neutral-600'
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-2 border-t border-[#ebebeb] dark:border-white/10 bg-neutral-50 dark:bg-white/[0.02] flex items-center justify-between text-[10px] font-mono text-neutral-500">
          <div className="flex items-center space-x-3">
            <span>&uarr;&darr; to navigate</span>
            <span>&crarr; to select</span>
            <span>ESC to close</span>
          </div>
          <span className="text-[#71866e]">Search</span>
        </div>
      </div>
    </div>
  );
}
