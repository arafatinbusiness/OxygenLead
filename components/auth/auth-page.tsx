'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { apiUrl } from '@/lib/api';

interface AuthPageProps {
  onLogin: (token: string) => void;
}

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const response = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Authentication failed');
        return;
      }

      onLogin(data.token);
    } catch (err) {
      setError('Failed to connect to server. Make sure the API is running on port 3001.');
      console.error('Auth error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2 text-foreground">OxygenLead</h1>
          <p className="text-muted-foreground">
            B2B Lead Research & Scoring Platform
          </p>
        </div>

        {/* Auth Card */}
        <Card className="p-8 border-secondary/20 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-1">
                {isLogin ? 'Welcome Back' : 'Create Account'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isLogin
                  ? 'Sign in to access your leads'
                  : 'Get started with OxygenLead'}
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="bg-input/50 border-secondary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Password
                </label>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="bg-input/50 border-secondary/20"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {loading
                ? 'Loading...'
                : isLogin
                ? 'Sign In'
                : 'Create Account'}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-secondary/20"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-background text-muted-foreground">
                  {isLogin
                    ? "Don't have an account?"
                    : 'Already have an account?'}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="w-full border-secondary/20 hover:bg-secondary/5"
              disabled={loading}
            >
              {isLogin ? 'Create Account' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-muted-foreground space-y-2">
            <p>Demo credentials:</p>
            <p>Email: demo@oxygenlead.com</p>
            <p>Password: password123</p>
          </div>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground">
          <p>
            Research, score, and qualify e-commerce leads with founder
            intelligence.
          </p>
        </div>
      </div>
    </div>
  );
}
