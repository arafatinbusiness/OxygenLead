'use client';

import { useState, useEffect } from 'react';
import { Header } from './header';
import { Sidebar } from './sidebar';
import { StoresGrid } from './stores-grid';
import { StoreDetail } from './store-detail';
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
}

interface DashboardPageProps {
  token: string;
  onLogout: () => void;
}

export default function DashboardPage({ token, onLogout }: DashboardPageProps) {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'list' | 'detail'>('list');

  const fetchStores = async () => {
    try {
      setLoading(true);
      const response = await fetch(apiUrl('/api/stores'), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 401) {
          onLogout();
          return;
        }
        throw new Error('Failed to fetch stores');
      }

      const data = await response.json();
      setStores(data.stores || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stores');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const handleAddStore = async (url: string) => {
    // Extract domain from URL immediately (before any await) to open search tab
    let domain = '';
    try {
      const urlObj = new URL(url);
      domain = urlObj.hostname.replace('www.', '');
    } catch {
      // fallback: use raw url
      domain = url.replace(/https?:\/\//, '').replace(/\/.*$/, '').replace('www.', '');
    }
    const query = `${domain} founder owner ceo linkedin`;

    // Open Google search in new tab immediately (before any await to avoid popup blocker)
    window.open(
      `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      '_blank',
      'noopener,noreferrer'
    );

    try {
      const response = await fetch(apiUrl('/api/stores'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add store');
      }

      const newStore = await response.json();
      setStores([newStore, ...stores]);

      // Auto-navigate to store detail view
      setSelectedStore(newStore);
      setView('detail');

      // Save the search to database
      try {
        await fetch(apiUrl(`/api/stores/${newStore.id}/manual-search`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ query, type: 'founder' }),
        });
      } catch (err) {
        console.error('Failed to save auto search:', err);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add store');
    }
  };



  const handleDeleteStore = async (storeId: string) => {
    try {
      const response = await fetch(apiUrl(`/api/stores/${storeId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to delete store');
      }

      setStores(stores.filter((s) => s.id !== storeId));
      if (selectedStore?.id === storeId) {
        setSelectedStore(null);
        setView('list');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete store');
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar onLogout={onLogout} stores={stores} token={token} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <Header onLogout={onLogout} />

        <main className="flex-1 overflow-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              {error}
              <button
                onClick={() => setError('')}
                className="ml-4 underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {view === 'list' ? (
            <StoresGrid
              stores={stores}
              loading={loading}
              token={token}
              onAddStore={handleAddStore}
              onSelectStore={(store) => {
                setSelectedStore(store);
                setView('detail');
              }}
              onDeleteStore={handleDeleteStore}
              onStoreUpdated={fetchStores}
            />
          ) : selectedStore ? (
            <StoreDetail
              store={selectedStore}
              token={token}
              onBack={() => {
                setView('list');
                setSelectedStore(null);
              }}
              onDelete={() => handleDeleteStore(selectedStore.id)}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
