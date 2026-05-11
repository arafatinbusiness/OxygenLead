'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, TrendingUp, Calendar } from 'lucide-react';
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
}

interface StoresGridProps {
  stores: Store[];
  loading: boolean;
  token: string;
  onAddStore: (url: string) => void;
  onSelectStore: (store: Store) => void;
  onDeleteStore: (id: string) => void;
  onStoreUpdated?: () => void;
}

export function StoresGrid({
  stores,
  loading,
  token,
  onAddStore,
  onSelectStore,
  onDeleteStore,
  onStoreUpdated,
}: StoresGridProps) {
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;

    setAdding(true);
    try {
      await onAddStore(newUrl);
      setNewUrl('');
    } finally {
      setAdding(false);
    }
  };

  const getScoreColor = (score: number | undefined) => {
    if (!score) return 'text-muted-foreground';
    if (score >= 80) return 'text-red-500';
    if (score >= 60) return 'text-orange-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-gray-500';
  };

  const getScoreBg = (score: number | undefined) => {
    if (!score) return 'bg-muted/20';
    if (score >= 80) return 'bg-red-500/20';
    if (score >= 60) return 'bg-orange-500/20';
    if (score >= 40) return 'bg-yellow-500/20';
    return 'bg-gray-500/20';
  };

  return (
    <div className="space-y-6">
      {/* Add Store Form */}
      <div className="max-w-2xl">
        <Card className="p-6 border-secondary/20">
          <h2 className="text-lg font-semibold mb-4">Add New Store</h2>
          <form onSubmit={handleAdd} className="flex gap-2">
            <Input
              type="url"
              placeholder="https://example.com"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              disabled={adding}
              className="flex-1 bg-input/50 border-secondary/20"
            />
            <Button
              type="submit"
              disabled={adding || !newUrl.trim()}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Store
            </Button>
          </form>
        </Card>
      </div>

      {/* Stores Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Your Stores</h2>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="p-6 border-secondary/20 animate-pulse">
                <div className="h-8 bg-muted rounded mb-4"></div>
                <div className="h-4 bg-muted rounded mb-2"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </Card>
            ))}
          </div>
        ) : stores.length === 0 ? (
          <Card className="p-12 text-center border-secondary/20">
            <p className="text-muted-foreground">No stores yet. Add your first store to get started!</p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => (
              <Card
                key={store.id}
                className="p-6 border-secondary/20 hover:border-primary/50 transition cursor-pointer group"
                onClick={() => onSelectStore(store)}
              >
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition">
                        {store.storeName || store.domain}
                      </h3>
                      <p className="text-sm text-muted-foreground">{store.domain}</p>
                    </div>

                    {/* Score Badge */}
                    {store.leadScore !== undefined && (
                      <div
                        className={`rounded-lg px-3 py-2 text-sm font-bold ${getScoreBg(store.leadScore)} ${getScoreColor(store.leadScore)}`}
                      >
                        {store.leadScore}
                      </div>
                    )}
                  </div>

                  {/* Stats / Progress */}
                  <div className="space-y-2 text-xs">
                    {store.scrapingStatus && store.scrapingStatus !== 'idle' && store.scrapingStatus !== 'complete' ? (
                      <ScrapingProgressBar
                        storeId={store.id}
                        token={token}
                        initialStatus={store.scrapingStatus as any}
                        initialProgress={store.scrapingProgress || 0}
                        initialStatusText={store.scrapingStatusText || ''}
                        compact
                      />
                    ) : store.scrapedAt ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        Scraped {new Date(store.scrapedAt).toLocaleDateString()}
                      </div>
                    ) : null}
                    {store.leadScoreCalculatedAt && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <TrendingUp className="w-3 h-3" />
                        Score calculated
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-secondary/20">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-secondary/20 hover:bg-secondary/5"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectStore(store);
                      }}
                    >
                      View Details
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          confirm(
                            `Delete ${store.storeName || store.domain}?`
                          )
                        ) {
                          onDeleteStore(store.id);
                        }
                      }}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
