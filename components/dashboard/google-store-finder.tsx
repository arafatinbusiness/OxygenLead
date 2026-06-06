'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { apiUrl } from '@/lib/api';
import {
  Search,
  Globe,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface FoundStore {
  url: string;
  domain: string;
  storeName: string | null;
  isShopify: boolean;
  error?: string;
}

interface BatchImportResult {
  url: string;
  domain: string;
  status: 'added' | 'skipped' | 'error';
  error?: string;
  storeId?: string;
}

interface GoogleStoreFinderProps {
  token: string;
  onStoresAdded: () => void;
}

export function GoogleStoreFinder({ token, onStoresAdded }: GoogleStoreFinderProps) {
  const [query, setQuery] = useState('');
  const [pages, setPages] = useState(1);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [foundStores, setFoundStores] = useState<FoundStore[]>([]);
  const [allResults, setAllResults] = useState<FoundStore[]>([]);
  const [importResults, setImportResults] = useState<BatchImportResult[]>([]);
  const [showAllResults, setShowAllResults] = useState(false);
  const [searchStats, setSearchStats] = useState<{
    totalFound: number;
    totalValidated: number;
    totalShopify: number;
  } | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setSearching(true);
    setError('');
    setFoundStores([]);
    setAllResults([]);
    setImportResults([]);
    setSearchStats(null);

    try {
      const response = await fetch(apiUrl('/api/stores/google-search'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: query.trim(), pages }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Search failed');
      }

      const data = await response.json();
      setFoundStores(data.stores || []);
      setAllResults(data.allResults || []);
      setSearchStats({
        totalFound: data.totalFound,
        totalValidated: data.totalValidated,
        totalShopify: data.totalShopify,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search Google');
    } finally {
      setSearching(false);
    }
  };

  const handleImportAll = async () => {
    const shopifyUrls = foundStores.map((s) => s.url);
    if (shopifyUrls.length === 0) return;

    setImporting(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/stores/batch-import'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ urls: shopifyUrls }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Import failed');
      }

      const data = await response.json();
      setImportResults(data.results || []);
      onStoresAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import stores');
    } finally {
      setImporting(false);
    }
  };

  const handleImportSelected = async (urls: string[]) => {
    if (urls.length === 0) return;

    setImporting(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/stores/batch-import'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ urls }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Import failed');
      }

      const data = await response.json();
      setImportResults((prev) => [...prev, ...(data.results || [])]);
      onStoresAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import stores');
    } finally {
      setImporting(false);
    }
  };

  const getImportStatusIcon = (status: string) => {
    switch (status) {
      case 'added':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'skipped':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getImportStatusText = (result: BatchImportResult) => {
    switch (result.status) {
      case 'added':
        return 'Added successfully';
      case 'skipped':
        return 'Already exists';
      case 'error':
        return result.error || 'Failed to add';
      default:
        return '';
    }
  };

  return (
    <Card className="p-6 border-secondary/20">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Google Store Finder
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Search Google for Shopify stores using advanced queries and auto-import them.
          </p>
        </div>

        {/* Search Form */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Google Search Query</label>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='e.g. site:myshopify.com "skincare" -site:shopify.com'
              disabled={searching || importing}
              className="bg-input/50 border-secondary/20 font-mono text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use Google dork queries like{' '}
              <code className="bg-secondary/10 px-1 rounded text-xs">
                site:myshopify.com "skincare" -site:shopify.com
              </code>
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Pages:</label>
              <select
                value={pages}
                onChange={(e) => setPages(parseInt(e.target.value))}
                disabled={searching || importing}
                className="bg-input/50 border border-secondary/20 rounded px-2 py-1 text-sm"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <Button
              onClick={handleSearch}
              disabled={searching || importing || !query.trim()}
              className="bg-primary hover:bg-primary/90"
            >
              {searching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Search Google
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Search Stats */}
        {searchStats && (
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
              <p className="text-2xl font-bold text-blue-600">{searchStats.totalFound}</p>
              <p className="text-xs text-muted-foreground">URLs Found</p>
            </div>
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-center">
              <p className="text-2xl font-bold text-yellow-600">{searchStats.totalValidated}</p>
              <p className="text-xs text-muted-foreground">Validated</p>
            </div>
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
              <p className="text-2xl font-bold text-green-600">{searchStats.totalShopify}</p>
              <p className="text-xs text-muted-foreground">Shopify Stores</p>
            </div>
          </div>
        )}

        {/* Found Stores */}
        {foundStores.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-green-500" />
                {foundStores.length} Shopify Store{foundStores.length !== 1 ? 's' : ''} Found
              </h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleImportAll}
                  disabled={importing}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3 mr-1" />
                      Import All ({foundStores.length})
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {foundStores.map((store, idx) => {
                const importResult = importResults.find((r) => r.url === store.url);
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border text-sm ${
                      importResult
                        ? importResult.status === 'added'
                          ? 'border-green-500/30 bg-green-500/5'
                          : importResult.status === 'skipped'
                          ? 'border-yellow-500/30 bg-yellow-500/5'
                          : 'border-red-500/30 bg-red-500/5'
                        : 'border-secondary/20 hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {store.storeName || store.domain}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{store.domain}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {importResult ? (
                          <div className="flex items-center gap-1 text-xs">
                            {getImportStatusIcon(importResult.status)}
                            <span
                              className={
                                importResult.status === 'added'
                                  ? 'text-green-600'
                                  : importResult.status === 'skipped'
                                  ? 'text-yellow-600'
                                  : 'text-red-600'
                              }
                            >
                              {getImportStatusText(importResult)}
                            </span>
                          </div>
                        ) : (
                          <>
                            <a
                              href={store.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleImportSelected([store.url])}
                              disabled={importing}
                              className="h-7 px-2 text-xs"
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Import
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* All Results (including non-Shopify) */}
        {allResults.length > 0 && (
          <div>
            <button
              onClick={() => setShowAllResults(!showAllResults)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {showAllResults ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              Show all {allResults.length} results (including non-Shopify)
            </button>

            {showAllResults && (
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {allResults.map((result, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded text-xs border border-secondary/10"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{result.domain}</p>
                      {result.storeName && (
                        <p className="text-muted-foreground truncate">{result.storeName}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {result.isShopify ? (
                        <span className="text-green-500 text-[10px] font-medium px-1.5 py-0.5 bg-green-500/10 rounded">
                          Shopify
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">Not Shopify</span>
                      )}
                      {result.error && (
                        <span className="text-red-500 text-[10px]" title={result.error}>
                          Error
                        </span>
                      )}
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Import Summary */}
        {importResults.length > 0 && (
          <div className="p-3 rounded-lg bg-secondary/5 border border-secondary/20">
            <p className="text-sm font-medium mb-1">Import Summary</p>
            <div className="flex gap-4 text-xs">
              <span className="text-green-600">
                {importResults.filter((r) => r.status === 'added').length} added
              </span>
              <span className="text-yellow-600">
                {importResults.filter((r) => r.status === 'skipped').length} skipped
              </span>
              <span className="text-red-600">
                {importResults.filter((r) => r.status === 'error').length} errors
              </span>
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="p-3 rounded-lg bg-secondary/5 border border-secondary/10">
          <p className="text-xs font-medium mb-2">💡 Search Tips</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>
              <code className="bg-secondary/10 px-1 rounded">site:myshopify.com "skincare" -site:shopify.com</code>
              {' '}- Find Shopify stores in a niche
            </li>
            <li>
              <code className="bg-secondary/10 px-1 rounded">site:myshopify.com "free shipping" "jewelry"</code>
              {' '}- Find jewelry stores with free shipping
            </li>
            <li>
              <code className="bg-secondary/10 px-1 rounded">inurl:myshopify.com "about us" "skincare"</code>
              {' '}- Find stores with About Us pages
            </li>
            <li>
              <code className="bg-secondary/10 px-1 rounded">site:myshopify.com "contact" "fashion" -site:shopify.com</code>
              {' '}- Find fashion stores with contact pages
            </li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
