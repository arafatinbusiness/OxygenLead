'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  ArrowLeft, Trash2, ExternalLink, Users, Globe, TrendingUp,
  Search, Mail, Copy, CheckCircle2, ClipboardList
} from 'lucide-react';
import { ScrapingProgressBar } from './scraping-progress';

interface Store {
  id: string;
  url: string;
  domain: string;
  storeName?: string;
  leadScore?: number;
  leadScoreCalculatedAt?: string;
  scrapedAt?: string;
  createdAt: string;
  scrapingStatus?: string;
  scrapingProgress?: number;
  scrapingStatusText?: string;
  contacts?: any[];
  founders?: any[];
  socialAccounts?: any[];
  linkedinMatches?: any[];
  jobListings?: any[];
  history?: any[];
}

interface ManualContact {
  id: string;
  email: string;
  status: string;
  personName?: string;
  createdAt: string;
}

interface StoreDetailProps {
  store: Store;
  token: string;
  onBack: () => void;
  onDelete: () => void;
}

/**
 * Sub-component for the custom name search form
 */
function CustomNameSearch({ storeId, token, domain, onSearchName }: { storeId: string; token: string; domain: string; onSearchName: (name: string) => void }) {
  const [searchName, setSearchName] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchName.trim()) return;

    // Save to database
    try {
      await fetch(`http://localhost:3001/api/stores/${storeId}/manual-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: `${searchName.trim()} linkedin`,
          type: 'custom',
        }),
      });
    } catch (err) {
      console.error('Failed to save search:', err);
    }

    // Auto-fill the person name in the email form below
    onSearchName(searchName.trim());

    // Open Google search in new tab
    const query = encodeURIComponent(`${searchName.trim()} linkedin`);
    window.open(`https://www.google.com/search?q=${query}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <form onSubmit={handleSearch} className="flex gap-2">
      <Input
        type="text"
        placeholder="Enter name (e.g. John Doe)"
        value={searchName}
        onChange={(e) => setSearchName(e.target.value)}
        className="flex-1 bg-input/50 border-secondary/20"
      />
      <Button
        type="submit"
        disabled={!searchName.trim()}
        variant="outline"
        className="shrink-0 border-secondary/20 hover:bg-secondary/5"
      >
        <Search className="w-4 h-4 mr-2" />
        Search
      </Button>
    </form>
  );
}

/**
 * Sub-component for the email entry form
 */
function EmailEntryForm({
  storeId,
  token,
  storeName,
  domain,
  defaultPersonName,
  onSaved,
}: {
  storeId: string;
  token: string;
  storeName?: string;
  domain: string;
  defaultPersonName?: string;
  onSaved: (contact: ManualContact) => void;
}) {
  const [email, setEmail] = useState('');
  const [personName, setPersonName] = useState(defaultPersonName || '');
  const [contactStatus, setContactStatus] = useState('founder');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Sync defaultPersonName prop to state when it changes (e.g. after a name search)
  useEffect(() => {
    if (defaultPersonName) {
      setPersonName(defaultPersonName);
    }
  }, [defaultPersonName]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSaving(true);
    setError('');

    try {
      const response = await fetch(`http://localhost:3001/api/stores/${storeId}/manual-contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: email.trim(),
          status: contactStatus,
          personName: personName.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      const saved = await response.json();
      onSaved(saved);
      setEmail('');
      setPersonName('');
      setContactStatus('founder');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save contact');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 bg-input/50 border-secondary/20"
          required
        />
        <select
          value={contactStatus}
          onChange={(e) => setContactStatus(e.target.value)}
          className="px-3 py-2 rounded-md border border-secondary/20 bg-input/50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="owner">Owner</option>
          <option value="ceo">CEO</option>
          <option value="founder">Founder</option>
          <option value="manager">Manager</option>
        </select>
        <Button
          type="submit"
          disabled={saving || !email.trim()}
          variant="outline"
          className="shrink-0 border-secondary/20 hover:bg-secondary/5"
        >
          <Mail className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
      <Input
        type="text"
        placeholder="Person name (optional)"
        value={personName}
        onChange={(e) => setPersonName(e.target.value)}
        className="bg-input/50 border-secondary/20"
      />
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </form>
  );
}

/**
 * Sub-component for displaying a saved contact with copyable data
 */
function SavedContactCard({
  contact,
  storeName,
  domain,
}: {
  contact: ManualContact;
  storeName?: string;
  domain: string;
}) {
  const [copied, setCopied] = useState(false);

  const copyData = () => {
    const text = [
      `Company Name: ${storeName || domain}`,
      `Website: https://${domain}`,
      `Person Name: ${contact.personName || 'N/A'}`,
      `Status: ${contact.status.charAt(0).toUpperCase() + contact.status.slice(1)}`,
      `Email: ${contact.email}`,
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="p-4 rounded-lg bg-secondary/5 border border-secondary/20">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-medium text-sm">{contact.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
              {contact.status}
            </span>
            {contact.personName && (
              <span className="text-xs text-muted-foreground">
                {contact.personName}
              </span>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={copyData}
          className="text-muted-foreground hover:text-foreground"
        >
          {copied ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Copyable data preview */}
      <div className="text-xs text-muted-foreground bg-background/50 rounded p-3 font-mono space-y-1">
        <p>Company Name: {storeName || domain}</p>
        <p>Website: https://{domain}</p>
        <p>Person Name: {contact.personName || 'N/A'}</p>
        <p>Status: {contact.status.charAt(0).toUpperCase() + contact.status.slice(1)}</p>
        <p>Email: {contact.email}</p>
      </div>
    </div>
  );
}

export function StoreDetail({ store, token, onBack, onDelete }: StoreDetailProps) {
  const [detailedStore, setDetailedStore] = useState<Store>(store);
  const [loading, setLoading] = useState(true);
  const [manualContacts, setManualContacts] = useState<ManualContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [searchedPersonName, setSearchedPersonName] = useState('');

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const response = await fetch(
          `http://localhost:3001/api/stores/${store.id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setDetailedStore(data);
        }
      } catch (err) {
        console.error('Failed to fetch store details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [store.id, token]);

  // Fetch manual contacts
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const response = await fetch(
          `http://localhost:3001/api/stores/${store.id}/manual-contacts`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setManualContacts(data);
        }
      } catch (err) {
        console.error('Failed to fetch manual contacts:', err);
      } finally {
        setContactsLoading(false);
      }
    };

    fetchContacts();
  }, [store.id, token]);

  const handleSaveSearch = async (type: string, query: string) => {
    try {
      await fetch(`http://localhost:3001/api/stores/${store.id}/manual-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query, type }),
      });
    } catch (err) {
      console.error('Failed to save search:', err);
    }
  };

  const getScoreBadge = (score?: number) => {
    if (!score) return null;
    if (score >= 80)
      return { label: 'Hot', color: 'text-red-500', bg: 'bg-red-500/20' };
    if (score >= 60)
      return {
        label: 'Warm',
        color: 'text-orange-500',
        bg: 'bg-orange-500/20',
      };
    if (score >= 40)
      return {
        label: 'Lukewarm',
        color: 'text-yellow-500',
        bg: 'bg-yellow-500/20',
      };
    return { label: 'Cold', color: 'text-gray-500', bg: 'bg-gray-500/20' };
  };

  const badge = getScoreBadge(detailedStore.leadScore);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Stores
        </Button>

        <Button
          onClick={() => {
            if (confirm('Delete this store?')) {
              onDelete();
            }
          }}
          variant="ghost"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </Button>
      </div>

      {/* Store Info Card */}
      <Card className="p-8 border-secondary/20">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {detailedStore.storeName || detailedStore.domain}
            </h1>
            <a
              href={detailedStore.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-2 mt-2"
            >
              {detailedStore.url}
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {badge && (
            <div
              className={`rounded-lg px-4 py-2 text-center ${badge.bg}`}
            >
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Lead Score
              </p>
              <p className={`text-3xl font-bold ${badge.color}`}>
                {detailedStore.leadScore}
              </p>
              <p className={`text-xs font-semibold mt-1 ${badge.color}`}>
                {badge.label}
              </p>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-3 gap-4 pt-6 border-t border-secondary/20">
          <div>
            <p className="text-xs text-muted-foreground uppercase mb-1">Added</p>
            <p className="text-sm font-medium">
              {new Date(detailedStore.createdAt).toLocaleDateString()}
            </p>
          </div>
          {detailedStore.scrapedAt && (
            <div>
              <p className="text-xs text-muted-foreground uppercase mb-1">
                Last Scraped
              </p>
              <p className="text-sm font-medium">
                {new Date(detailedStore.scrapedAt).toLocaleDateString()}
              </p>
            </div>
          )}
          {detailedStore.leadScoreCalculatedAt && (
            <div>
              <p className="text-xs text-muted-foreground uppercase mb-1">
                Score Updated
              </p>
              <p className="text-sm font-medium">
                {new Date(detailedStore.leadScoreCalculatedAt).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Manual Search Tools */}
      <Card className="p-6 border-secondary/20">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" />
          Manual Search
        </h2>
        <div className="space-y-4">
          {/* Quick Google Search */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">
                Search for founder on Google
              </p>
              <p className="text-xs text-muted-foreground/60">
                Opens a new tab searching: &ldquo;{detailedStore.domain} founder name linkedin&rdquo;
              </p>
            </div>
            <Button
              variant="outline"
              className="shrink-0 border-secondary/20 hover:bg-secondary/5"
              onClick={() => {
                const query = `${detailedStore.domain} founder name linkedin`;
                handleSaveSearch('founder', query);
                window.open(
                  `https://www.google.com/search?q=${encodeURIComponent(query)}`,
                  '_blank',
                  'noopener,noreferrer'
                );
              }}
            >
              <Search className="w-4 h-4 mr-2" />
              Search Founder
            </Button>
          </div>

          {/* Custom Name Search */}
          <div className="pt-3 border-t border-secondary/20">
            <p className="text-sm text-muted-foreground mb-2">
              Or enter a name to search on Google
            </p>
            <CustomNameSearch
              storeId={store.id}
              token={token}
              domain={detailedStore.domain}
              onSearchName={(name) => setSearchedPersonName(name)}
            />
          </div>
        </div>
      </Card>

      {/* Email Entry Form */}
      <Card className="p-6 border-secondary/20">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          Add Contact Email
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Found an email? Enter it here along with the person's role. After saving, you can copy the formatted data.
        </p>
        <EmailEntryForm
          storeId={store.id}
          token={token}
          storeName={detailedStore.storeName || undefined}
          domain={detailedStore.domain}
          defaultPersonName={searchedPersonName}
          onSaved={(contact) => {
            setManualContacts([contact, ...manualContacts]);
          }}
        />
      </Card>

      {/* Saved Contacts with Copyable Data */}
      {manualContacts.length > 0 && (
        <Card className="p-6 border-secondary/20">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Saved Contacts ({manualContacts.length})
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Click the copy icon on any contact to copy formatted data for pasting into a Word file.
          </p>
          <div className="space-y-3">
            {manualContacts.map((contact) => (
              <SavedContactCard
                key={contact.id}
                contact={contact}
                storeName={detailedStore.storeName || undefined}
                domain={detailedStore.domain}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Scraping Progress (shown when actively scraping) */}
      {detailedStore.scrapingStatus && 
       detailedStore.scrapingStatus !== 'idle' && 
       detailedStore.scrapingStatus !== 'complete' && (
        <ScrapingProgressBar
          storeId={detailedStore.id}
          token={token}
          initialStatus={detailedStore.scrapingStatus as any}
          initialProgress={detailedStore.scrapingProgress || 0}
          initialStatusText={detailedStore.scrapingStatusText || ''}
          onComplete={() => {
            // Re-fetch details when scraping completes
            const refetch = async () => {
              try {
                const response = await fetch(
                  `http://localhost:3001/api/stores/${store.id}`,
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                if (response.ok) {
                  const data = await response.json();
                  setDetailedStore(data);
                }
              } catch {}
            };
            refetch();
          }}
        />
      )}

      {/* Content Sections */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-6 border-secondary/20 animate-pulse">
              <div className="h-6 bg-muted rounded mb-4 w-1/4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-muted rounded"></div>
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Founders */}
          {detailedStore.founders && detailedStore.founders.length > 0 && (
            <Card className="p-6 border-secondary/20">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Founders ({detailedStore.founders.length})
              </h2>
              <div className="space-y-3">
                {detailedStore.founders.map((founder) => (
                  <div key={founder.id} className="p-4 rounded-lg bg-secondary/5">
                    <p className="font-medium">{founder.name}</p>
                    {founder.role && (
                      <p className="text-sm text-muted-foreground">
                        {founder.role}
                      </p>
                    )}
                    {founder.bio && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {founder.bio.substring(0, 200)}...
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Social Accounts */}
          {detailedStore.socialAccounts &&
            detailedStore.socialAccounts.length > 0 && (
              <Card className="p-6 border-secondary/20">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" />
                  Social Accounts ({detailedStore.socialAccounts.length})
                </h2>
                <div className="flex flex-wrap gap-2">
                  {detailedStore.socialAccounts.map((social) => (
                    <a
                      key={social.id}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition capitalize text-sm font-medium"
                    >
                      {social.platform}
                    </a>
                  ))}
                </div>
              </Card>
            )}

          {/* LinkedIn Matches */}
          {detailedStore.linkedinMatches &&
            detailedStore.linkedinMatches.length > 0 && (
              <Card className="p-6 border-secondary/20">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  LinkedIn Matches ({detailedStore.linkedinMatches.length})
                </h2>
                <div className="space-y-3">
                  {detailedStore.linkedinMatches.map((match) => (
                    <div key={match.id} className="p-4 rounded-lg bg-secondary/5">
                      <p className="font-medium">{match.name}</p>
                      {match.title && (
                        <p className="text-sm text-muted-foreground">
                          {match.title}
                        </p>
                      )}
                      {match.company && (
                        <p className="text-sm text-muted-foreground">
                          {match.company}
                        </p>
                      )}
                      <p className="text-xs text-primary mt-2">
                        {Math.round(match.matchConfidence * 100)}% confidence
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

          {/* Activity History */}
          {detailedStore.history && detailedStore.history.length > 0 && (
            <Card className="p-6 border-secondary/20">
              <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
              <div className="space-y-2">
                {detailedStore.history.slice(0, 10).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/5 text-sm"
                  >
                    <span className="capitalize font-medium">
                      {entry.action.replace(/_/g, ' ')}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
