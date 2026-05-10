'use client';

import { useState, useEffect } from 'react';
import AuthPage from '@/components/auth/auth-page';
import DashboardPage from '@/components/dashboard/dashboard-page';

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      setToken(storedToken);
    }
    setLoading(false);
  }, []);

  const handleLogin = (authToken: string) => {
    localStorage.setItem('authToken', authToken);
    setToken(authToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setToken(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return token ? (
    <DashboardPage token={token} onLogout={handleLogout} />
  ) : (
    <AuthPage onLogin={handleLogin} />
  );
}
