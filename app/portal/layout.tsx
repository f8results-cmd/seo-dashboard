import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import PortalSidebar from '@/components/portal/Sidebar';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/portal');

  // Look up client by email
  const { data: client } = await supabase
    .from('clients')
    .select('business_name')
    .eq('email', user.email ?? '')
    .single();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <PortalSidebar businessName={client?.business_name} />
      <main className="flex-1 overflow-auto pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
