import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function RootPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user?.email === 'sebastian@figure8results.com') {
    redirect('/agency');
  }
  if (user) {
    redirect('/portal');
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-navy-500">
      <div className="text-center text-white">
        <div className="mb-8">
          <h1 className="text-4xl font-bold">Figure8 Results</h1>
          <p className="text-navy-200 mt-2">SEO Platform</p>
        </div>
        <div className="flex gap-4 justify-center">
          <a
            href="/auth/agency"
            className="px-6 py-3 bg-orange-DEFAULT text-white rounded-lg font-medium hover:bg-orange-500 transition-colors"
          >
            Agency Login
          </a>
          <a
            href="/auth/portal"
            className="px-6 py-3 bg-white/10 text-white border border-white/20 rounded-lg font-medium hover:bg-white/20 transition-colors"
          >
            Client Portal
          </a>
        </div>
      </div>
    </main>
  );
}
