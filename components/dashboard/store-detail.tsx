'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowLeft, Trash2, ExternalLink, Users, Globe, TrendingUp,
  Search, Mail, Copy, CheckCircle2, ClipboardList, Plus, Save,
  ThumbsUp, MessageSquare, FileText, HelpCircle, Link, Image,
  Lightbulb, X
} from 'lucide-react';
import { ScrapingProgressBar } from './scraping-progress';
import { apiUrl } from '@/lib/api';

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

interface LeadExportData {
  positivePoint1?: string;
  positivePoint2?: string;
  positivePoint3?: string;
  positivePoint4?: string;
  positivePoint5?: string;
  positivePoint6?: string;
  positivePoint7?: string;
  positivePoint8?: string;
  positivePoint9?: string;
  positivePoint10?: string;
  improvement1?: string;
  improvement2?: string;
  improvement3?: string;
  improvement4?: string;
  improvement5?: string;
  improvement6?: string;
  improvement7?: string;
  improvement8?: string;
  improvement9?: string;
  improvement10?: string;
  customNotes?: string;
  quickQuestion?: string;
  videoLink?: string;
  imageLink?: string;
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
      await fetch(apiUrl(`/api/stores/${storeId}/manual-search`), {
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
      const response = await fetch(apiUrl(`/api/stores/${storeId}/manual-contact`), {
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

/**
 * Lead Export Data Form - appears after email is saved
 */
function LeadExportForm({
  storeId,
  token,
  domain,
  storeName,
}: {
  storeId: string;
  token: string;
  domain: string;
  storeName?: string;
}) {
  const [leadExport, setLeadExport] = useState<LeadExportData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPositivePoints, setShowPositivePoints] = useState(2); // Show first 2 by default
  const [showImprovements, setShowImprovements] = useState(1); // Show first 1 by default

  // Positive Point 1 checkboxes
  const [pp1Great, setPp1Great] = useState(false);
  const [pp1BumpOffers, setPp1BumpOffers] = useState(false);
  const [pp1Upsell, setPp1Upsell] = useState(false);

  // Positive Point 2 checkboxes
  const [pp2Visual, setPp2Visual] = useState(false);
  const [pp2JLAction, setPp2JLAction] = useState(false);

  // FB Ads scanning
  const [scanningFbAds, setScanningFbAds] = useState(false);
  const [fbAdsScanned, setFbAdsScanned] = useState(false);
  const [fbAdsError, setFbAdsError] = useState('');

  // Improvement 1 radio-like selection
  const [imp1NoAds, setImp1NoAds] = useState(false);
  const [imp1AdCount, setImp1AdCount] = useState<number | null>(null);
  const [imp1AutoDetected, setImp1AutoDetected] = useState(false);

  // Improvement 2 checkbox
  const [imp2PdpProfessional, setImp2PdpProfessional] = useState(false);

  // Quick Question
  const [useDefaultQuestion, setUseDefaultQuestion] = useState(true);
  const [customQuestion, setCustomQuestion] = useState('');

  const DEFAULT_QUICK_QUESTION = "Out of curiosity, how are you currently handling Shopify updates, app integrations, and ongoing store improvements?";
  const DEFAULT_CUSTOM_NOTES = "I work with Shopify brands that already have strong stores but want someone reliable to handle the technical side as they continue growing.";

  // Load existing data
  useEffect(() => {
    const fetchLeadExport = async () => {
      try {
        const response = await fetch(apiUrl(`/api/stores/${storeId}/lead-export`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          if (data && data.id) {
            setLeadExport(data);
            // Restore checkbox states from saved data
            if (data.positivePoint1) {
              setPp1Great(data.positivePoint1.includes('really great'));
              setPp1BumpOffers(data.positivePoint1.includes('Buy More Save More'));
              setPp1Upsell(data.positivePoint1.includes('not all pdp will have that'));
            }
            if (data.positivePoint2) {
              setPp2Visual(data.positivePoint2.includes('visual'));
              setPp2JLAction(data.positivePoint2.includes('J&L in Action'));
            }
            if (data.improvement1) {
              if (data.improvement1.includes("don't see you're running any meta ads")) {
                setImp1NoAds(true);
                setImp1AdCount(null);
              } else {
                // Try to extract ad count from text like "only got 3 active meta ads"
                const match = data.improvement1.match(/only got (\d+) active/);
                if (match) {
                  const count = parseInt(match[1]);
                  if (count >= 1 && count <= 5) {
                    setImp1AdCount(count);
                  }
                }
              }
            }
            if (data.improvement2) {
              setImp2PdpProfessional(data.improvement2.includes('Product detail page can be made more professional'));
            }
            if (data.quickQuestion) {
              if (data.quickQuestion === DEFAULT_QUICK_QUESTION) {
                setUseDefaultQuestion(true);
              } else {
                setUseDefaultQuestion(false);
                setCustomQuestion(data.quickQuestion);
              }
            }
            // Show how many positive points and improvements are filled
            const ppCount = [1,2,3,4,5,6,7,8,9,10].filter(i => data[`positivePoint${i}` as keyof LeadExportData]).length;
            const impCount = [1,2,3,4,5,6,7,8,9,10].filter(i => data[`improvement${i}` as keyof LeadExportData]).length;
            setShowPositivePoints(Math.max(2, ppCount));
            setShowImprovements(Math.max(1, impCount));
          }
        }
      } catch (err) {
        console.error('Failed to fetch lead export:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeadExport();
  }, [storeId, token]);

  // Build positive point 1 text from checkboxes
  const buildPositivePoint1 = (): string => {
    const parts: string[] = [];
    if (pp1Great) parts.push("The product detail page is really great");
    if (pp1BumpOffers) parts.push("has Buy More Save More & bump offers");
    if (pp1Upsell) parts.push("upsell but not all pdp will have that.");
    if (parts.length === 0) return leadExport.positivePoint1 || "";
    if (parts.length === 1) return parts[0];
    // Combine: first part + " and " + rest joined with " & "
    const last = parts.pop()!;
    return parts.join(", ") + " and " + last;
  };

  // Build positive point 2 text from checkboxes
  const buildPositivePoint2 = (): string => {
    const parts: string[] = [];
    if (pp2Visual) parts.push(`Loved the overall visual of ${domain}`);
    if (pp2JLAction) parts.push("Your store has See J&L in Action Section which is really cool");
    if (parts.length === 0) return leadExport.positivePoint2 || "";
    return parts.join(". ") + ".";
  };

  // Build improvement 1 text
  const buildImprovement1 = (): string => {
    if (imp1NoAds) {
      return "I don't see you're running any meta ads for selling your products. There's a high chance that your current priority is totally on organic sales.";
    }
    if (imp1AdCount !== null) {
      const adWord = imp1AdCount === 1 ? "ad" : "ads";
      return `You've only got ${imp1AdCount} active meta ${adWord} scheduled and maybe your current priorities are from organic sales.`;
    }
    return leadExport.improvement1 || "";
  };

  // Build improvement 2 text from checkbox
  const buildImprovement2 = (): string => {
    if (imp2PdpProfessional) {
      return "Product detail page can be made more professional.";
    }
    return leadExport.improvement2 || "";
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);

    const data: LeadExportData = {
      positivePoint1: buildPositivePoint1() || leadExport.positivePoint1 || undefined,
      positivePoint2: buildPositivePoint2() || leadExport.positivePoint2 || undefined,
      positivePoint3: leadExport.positivePoint3 || undefined,
      positivePoint4: leadExport.positivePoint4 || undefined,
      positivePoint5: leadExport.positivePoint5 || undefined,
      positivePoint6: leadExport.positivePoint6 || undefined,
      positivePoint7: leadExport.positivePoint7 || undefined,
      positivePoint8: leadExport.positivePoint8 || undefined,
      positivePoint9: leadExport.positivePoint9 || undefined,
      positivePoint10: leadExport.positivePoint10 || undefined,
      improvement1: buildImprovement1() || leadExport.improvement1 || undefined,
      improvement2: buildImprovement2() || leadExport.improvement2 || undefined,
      improvement3: leadExport.improvement3 || undefined,
      improvement4: leadExport.improvement4 || undefined,
      improvement5: leadExport.improvement5 || undefined,
      improvement6: leadExport.improvement6 || undefined,
      improvement7: leadExport.improvement7 || undefined,
      improvement8: leadExport.improvement8 || undefined,
      improvement9: leadExport.improvement9 || undefined,
      improvement10: leadExport.improvement10 || undefined,
      customNotes: leadExport.customNotes || DEFAULT_CUSTOM_NOTES,
      quickQuestion: useDefaultQuestion ? DEFAULT_QUICK_QUESTION : (customQuestion || DEFAULT_QUICK_QUESTION),
      videoLink: leadExport.videoLink || undefined,
      imageLink: leadExport.imageLink || undefined,
    };

    try {
      const response = await fetch(apiUrl(`/api/stores/${storeId}/lead-export`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const savedData = await response.json();
        setLeadExport(savedData);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save lead export:', err);
    } finally {
      setSaving(false);
    }
  };

  const updatePositivePoint = (index: number, value: string) => {
    setLeadExport(prev => ({ ...prev, [`positivePoint${index}`]: value }));
  };

  const updateImprovement = (index: number, value: string) => {
    setLeadExport(prev => ({ ...prev, [`improvement${index}`]: value }));
  };

  if (loading) {
    return (
      <Card className="p-6 border-secondary/20 animate-pulse">
        <div className="h-6 bg-muted rounded mb-4 w-1/3"></div>
        <div className="space-y-3">
          <div className="h-4 bg-muted rounded"></div>
          <div className="h-4 bg-muted rounded w-3/4"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-secondary/20">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Lead Export Data
        </h2>
        <Button
          onClick={handleSave}
          disabled={saving}
          variant="default"
          className="bg-primary hover:bg-primary/90"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Export Data'}
        </Button>
      </div>

      <div className="space-y-6">
        {/* ===== POSITIVE POINTS ===== */}
        <div className="space-y-4">
          <h3 className="text-md font-semibold flex items-center gap-2 text-green-600">
            <ThumbsUp className="w-4 h-4" />
            Positive Points
          </h3>

          {/* Positive Point 1 */}
          <div className="p-4 rounded-lg bg-secondary/5 border border-secondary/10">
            <p className="text-sm font-medium mb-3">Positive Point 1</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={pp1Great}
                  onCheckedChange={(checked) => setPp1Great(checked === true)}
                />
                <span>The product detail page is really great</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={pp1BumpOffers}
                  onCheckedChange={(checked) => setPp1BumpOffers(checked === true)}
                />
                <span>has Buy More Save More & bump offers</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={pp1Upsell}
                  onCheckedChange={(checked) => setPp1Upsell(checked === true)}
                />
                <span>upsell</span>
              </label>
            </div>
            {/* Preview */}
            {(pp1Great || pp1BumpOffers || pp1Upsell) && (
              <div className="mt-3 p-2 rounded bg-background/50 text-xs text-muted-foreground italic">
                Preview: {buildPositivePoint1()}
              </div>
            )}
          </div>

          {/* Positive Point 2 */}
          <div className="p-4 rounded-lg bg-secondary/5 border border-secondary/10">
            <p className="text-sm font-medium mb-3">Positive Point 2</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={pp2Visual}
                  onCheckedChange={(checked) => setPp2Visual(checked === true)}
                />
                <span>Loved the overall visual of {domain}</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={pp2JLAction}
                  onCheckedChange={(checked) => setPp2JLAction(checked === true)}
                />
                <span>Your store has See J&L in Action Section which is really cool</span>
              </label>
            </div>
            {/* Preview */}
            {(pp2Visual || pp2JLAction) && (
              <div className="mt-3 p-2 rounded bg-background/50 text-xs text-muted-foreground italic">
                Preview: {buildPositivePoint2()}
              </div>
            )}
          </div>

          {/* Positive Points 3-10 (dynamic) */}
          {Array.from({ length: Math.max(0, showPositivePoints - 2) }, (_, i) => i + 3).map((index) => (
            <div key={`pp-${index}`} className="p-4 rounded-lg bg-secondary/5 border border-secondary/10">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Positive Point {index}</p>
                {index > 3 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      updatePositivePoint(index, '');
                      setShowPositivePoints(prev => Math.max(2, prev - 1));
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
              <Input
                placeholder="Enter custom positive point..."
                value={leadExport[`positivePoint${index}` as keyof LeadExportData] || ''}
                onChange={(e) => updatePositivePoint(index, e.target.value)}
                className="bg-input/50 border-secondary/20"
              />
            </div>
          ))}

          {/* Add Positive Point Button */}
          {showPositivePoints < 10 && (
            <Button
              variant="outline"
              size="sm"
              className="border-secondary/20 hover:bg-secondary/5 w-full"
              onClick={() => setShowPositivePoints(prev => Math.min(10, prev + 1))}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Positive Point {showPositivePoints + 1}
            </Button>
          )}
        </div>

        {/* ===== IMPROVEMENTS ===== */}
        <div className="space-y-4 pt-4 border-t border-secondary/20">
          <h3 className="text-md font-semibold flex items-center gap-2 text-orange-600">
            <Lightbulb className="w-4 h-4" />
            Improvements
          </h3>

          {/* Improvement 1 */}
          <div className="p-4 rounded-lg bg-secondary/5 border border-secondary/10">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Improvement 1</p>
              <Button
                size="sm"
                variant="outline"
                className="border-blue-500/30 text-blue-600 hover:bg-blue-500/10 text-xs"
                disabled={scanningFbAds}
                onClick={async () => {
                  setScanningFbAds(true);
                  setFbAdsError('');
                  setFbAdsScanned(false);
                  try {
                    const response = await fetch(apiUrl(`/api/stores/${storeId}/scan-fb-ads`), {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    if (response.ok) {
                      const data = await response.json();
                      if (data.totalAds === 0) {
                        setImp1NoAds(true);
                        setImp1AdCount(null);
                      } else {
                        setImp1AdCount(Math.min(data.totalAds, 5));
                        setImp1NoAds(false);
                      }
                      setImp1AutoDetected(true);
                      setFbAdsScanned(true);
                    } else {
                      const err = await response.json();
                      setFbAdsError(err.error || 'Scan failed');
                    }
                  } catch (err) {
                    setFbAdsError('Failed to connect to server');
                  } finally {
                    setScanningFbAds(false);
                  }
                }}
              >
                {scanningFbAds ? (
                  <>Scanning...</>
                ) : (
                  <>
                    <Search className="w-3 h-3 mr-1" />
                    Scan FB Ads
                  </>
                )}
              </Button>
            </div>
            {fbAdsError && (
              <p className="text-xs text-red-500 mb-2">{fbAdsError}</p>
            )}
            {fbAdsScanned && (
              <p className="text-xs text-green-600 mb-2 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Auto-detected! You can adjust below if needed.
              </p>
            )}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="improvement1"
                  checked={imp1NoAds}
                  onChange={() => { setImp1NoAds(true); setImp1AdCount(null); }}
                  className="accent-primary"
                />
                <span>No Meta Ads</span>
              </label>
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-2">Has Meta Ads (select count):</p>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((count) => (
                    <label key={count} className="flex items-center gap-1.5 text-sm cursor-pointer px-3 py-1.5 rounded border border-secondary/20 hover:bg-secondary/5">
                      <input
                        type="radio"
                        name="improvement1"
                        checked={imp1AdCount === count}
                        onChange={() => { setImp1AdCount(count); setImp1NoAds(false); }}
                        className="accent-primary"
                      />
                      <span>{count} {count === 1 ? 'ad' : 'ads'}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            {/* Preview */}
            {(imp1NoAds || imp1AdCount !== null) && (
              <div className="mt-3 p-2 rounded bg-background/50 text-xs text-muted-foreground italic">
                Preview: {buildImprovement1()}
              </div>
            )}
          </div>

          {/* Improvement 2 */}
          <div className="p-4 rounded-lg bg-secondary/5 border border-secondary/10">
            <p className="text-sm font-medium mb-3">Improvement 2</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={imp2PdpProfessional}
                  onCheckedChange={(checked) => setImp2PdpProfessional(checked === true)}
                />
                <span>Product detail page can be made more professional</span>
              </label>
            </div>
            {/* Preview */}
            {imp2PdpProfessional && (
              <div className="mt-3 p-2 rounded bg-background/50 text-xs text-muted-foreground italic">
                Preview: {buildImprovement2()}
              </div>
            )}
          </div>

          {/* Improvements 3-10 (dynamic) */}
          {Array.from({ length: Math.max(0, showImprovements - 2) }, (_, i) => i + 3).map((index) => (
            <div key={`imp-${index}`} className="p-4 rounded-lg bg-secondary/5 border border-secondary/10">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Improvement {index}</p>
                {index > 3 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      updateImprovement(index, '');
                      setShowImprovements(prev => Math.max(2, prev - 1));
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
              <Input
                placeholder="Enter custom improvement..."
                value={leadExport[`improvement${index}` as keyof LeadExportData] || ''}
                onChange={(e) => updateImprovement(index, e.target.value)}
                className="bg-input/50 border-secondary/20"
              />
            </div>
          ))}

          {/* Add Improvement Button */}
          {showImprovements < 10 && (
            <Button
              variant="outline"
              size="sm"
              className="border-secondary/20 hover:bg-secondary/5 w-full"
              onClick={() => setShowImprovements(prev => Math.min(10, prev + 1))}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Improvement {showImprovements + 1}
            </Button>
          )}
        </div>

        {/* ===== CUSTOM NOTES ===== */}
        <div className="space-y-2 pt-4 border-t border-secondary/20">
          <h3 className="text-md font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            Custom Notes
          </h3>
          <Textarea
            placeholder="Enter custom notes..."
            value={leadExport.customNotes ?? DEFAULT_CUSTOM_NOTES}
            onChange={(e) => setLeadExport(prev => ({ ...prev, customNotes: e.target.value }))}
            className="bg-input/50 border-secondary/20 min-h-[80px]"
          />
        </div>

        {/* ===== QUICK QUESTION ===== */}
        <div className="space-y-2 pt-4 border-t border-secondary/20">
          <h3 className="text-md font-semibold flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-primary" />
            Quick Question
          </h3>
          <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
            <Checkbox
              checked={useDefaultQuestion}
              onCheckedChange={(checked) => setUseDefaultQuestion(checked === true)}
            />
            <span>Use default question</span>
          </label>
          {useDefaultQuestion ? (
            <div className="p-3 rounded bg-secondary/5 border border-secondary/10 text-sm text-muted-foreground italic">
              {DEFAULT_QUICK_QUESTION}
            </div>
          ) : (
            <Input
              placeholder="Enter your custom question..."
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              className="bg-input/50 border-secondary/20"
            />
          )}
        </div>

        {/* ===== VIDEO & IMAGE LINKS ===== */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-secondary/20">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Link className="w-4 h-4 text-primary" />
              Video Link
            </h3>
            <Input
              type="url"
              placeholder="https://..."
              value={leadExport.videoLink || ''}
              onChange={(e) => setLeadExport(prev => ({ ...prev, videoLink: e.target.value }))}
              className="bg-input/50 border-secondary/20"
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Image className="w-4 h-4 text-primary" />
              Image Link
            </h3>
            <Input
              type="url"
              placeholder="https://..."
              value={leadExport.imageLink || ''}
              onChange={(e) => setLeadExport(prev => ({ ...prev, imageLink: e.target.value }))}
              className="bg-input/50 border-secondary/20"
            />
          </div>
        </div>
      </div>
    </Card>
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
          apiUrl(`/api/stores/${store.id}`),
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
          apiUrl(`/api/stores/${store.id}/manual-contacts`),
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
      await fetch(apiUrl(`/api/stores/${store.id}/manual-search`), {
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
                Opens a new tab searching: &ldquo;{detailedStore.domain} founder owner ceo linkedin&rdquo;
              </p>

            </div>
            <Button
              variant="outline"
              className="shrink-0 border-secondary/20 hover:bg-secondary/5"
              onClick={() => {
                const query = `${detailedStore.domain} founder owner ceo linkedin`;
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

      {/* Lead Export Data Form - shown when there are saved contacts */}
      {manualContacts.length > 0 && (
        <LeadExportForm
          storeId={store.id}
          token={token}
          domain={detailedStore.domain}
          storeName={detailedStore.storeName || undefined}
        />
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
                  apiUrl(`/api/stores/${store.id}`),
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
          {/* Founders - Enhanced with Gemini source badge */}
          {detailedStore.founders && detailedStore.founders.length > 0 && (
            <Card className="p-6 border-secondary/20">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Founder Information
              </h2>
              <div className="space-y-3">
                {detailedStore.founders.map((founder) => (
                  <div key={founder.id} className="p-4 rounded-lg bg-secondary/5 border border-secondary/10">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-lg">{founder.name}</p>
                        {founder.role && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {founder.role}
                          </p>
                        )}
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                        AI Detected
                      </span>
                    </div>
                    {founder.bio && (
                      <p className="text-sm text-muted-foreground mt-3 border-t border-secondary/10 pt-3">
                        {founder.bio.substring(0, 300)}
                      </p>
                    )}
                    {/* Quick search button */}
                    <div className="mt-3 pt-3 border-t border-secondary/10">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-secondary/20 hover:bg-secondary/5"
                        onClick={() => {
                          const query = `${founder.name} ${detailedStore.domain} linkedin`;
                          window.open(
                            `https://www.google.com/search?q=${encodeURIComponent(query)}`,
                            '_blank',
                            'noopener,noreferrer'
                          );
                        }}
                      >
                        <Search className="w-3 h-3 mr-2" />
                        Search {founder.name} on LinkedIn
                      </Button>
                    </div>
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
