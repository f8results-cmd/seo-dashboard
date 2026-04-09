'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function PortalLoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback?redirect=/portal` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-500">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-DEFAULT rounded-2xl mb-4">
            <span className="text-2xl font-bold text-white">F8</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Client Portal</h1>
          <p className="text-navy-200 mt-1 text-sm">Figure8 Results</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h2>
              <p className="text-sm text-gray-500">
                We sent a login link to <strong>{email}</strong>.<br />
                Click it to access your portal.
              </p>
              <button
                onClick={() => setSent(false)}
                className="mt-6 text-sm text-navy-500 hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Your email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourbusiness.com"
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
                />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-navy-500 text-white rounded-lg font-medium text-sm hover:bg-navy-600 disabled:opacity-60 transition-colors"
              >
                {loading ? 'Sending...' : 'Send Login Link'}
              </button>
              <p className="text-xs text-center text-gray-400">
                We&apos;ll email you a secure link — no password needed.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
