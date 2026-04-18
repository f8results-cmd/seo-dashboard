import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';
import { addDays, format } from 'date-fns';

type TaskInsert = {
  client_id: string;
  description: string;
  due_date: string;
  priority: 'high' | 'medium' | 'low';
  phase: 'gbp_setup' | 'website' | 'citations' | 'ongoing';
  completed: false;
};

// Phase 1 — GBP Setup (days relative to start, 1-indexed)
const GBP_SETUP_TASKS: { day: number; description: string; priority: 'high' | 'medium' | 'low' }[] = [
  { day: 1,  description: 'Run benchmarking scans and screenshot current state', priority: 'high' },
  { day: 2,  description: 'Create GHL sub-account and add location ID',           priority: 'high' },
  { day: 3,  description: 'Connect GBP to GHL',                                   priority: 'high' },
  { day: 4,  description: 'Set categories and description in GBP',                 priority: 'high' },
  { day: 5,  description: 'Add 30 services to GBP',                               priority: 'medium' },
  { day: 6,  description: 'Upload all photos to GBP',                             priority: 'medium' },
  { day: 7,  description: 'Add business hours and verify everything live in GBP',  priority: 'high' },
];

// Phase 2 — Website (days relative to start)
const WEBSITE_TASKS: { day: number; description: string; priority: 'high' | 'medium' | 'low' }[] = [
  { day: 3,  description: 'Upload client logo and photos to dashboard',    priority: 'medium' },
  { day: 4,  description: 'Set brand colours and update agency notes',     priority: 'low' },
  { day: 5,  description: 'Run full pipeline',                             priority: 'high' },
  { day: 7,  description: 'Review live website — check all pages load',   priority: 'high' },
  { day: 8,  description: 'Check mobile, title tags, and schema markup',   priority: 'medium' },
  { day: 10, description: 'Submit sitemap to Google Search Console',       priority: 'medium' },
];

// Phase 3 — Citations (days relative to start)
const CITATION_TASKS: { day: number; description: string; priority: 'high' | 'medium' | 'low' }[] = [
  { day: 8,  description: 'Confirm LeadSnap citation submission',          priority: 'high' },
  { day: 10, description: 'Review backlink opportunities report',           priority: 'medium' },
  { day: 14, description: 'Action top 3 local organisation links manually', priority: 'medium' },
  { day: 21, description: 'First citation audit check',                     priority: 'low' },
];

// Phase 4 — Ongoing (generate 4 weekly + 2 fortnightly + 1 monthly)
function buildOngoingTasks(): { day: number; description: string; priority: 'high' | 'medium' | 'low' }[] {
  const tasks = [];
  // Weekly: days 7, 14, 21, 28
  for (const week of [7, 14, 21, 28]) {
    tasks.push({ day: week, description: 'Check GBP posts publishing',  priority: 'medium' as const });
    tasks.push({ day: week, description: 'Send Friday client update',   priority: 'high' as const });
  }
  // Fortnightly: days 14, 28
  tasks.push({ day: 14, description: 'Upload rank tracking screenshots', priority: 'medium' as const });
  tasks.push({ day: 28, description: 'Upload rank tracking screenshots', priority: 'medium' as const });
  // Monthly: day 30
  tasks.push({ day: 30, description: 'Review monthly SEO report',        priority: 'medium' as const });
  return tasks;
}

function dayToDate(startDate: Date, day: number): string {
  return format(addDays(startDate, day - 1), 'yyyy-MM-dd');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { client_id, start_date, replace = false } = body as {
      client_id: string;
      start_date?: string;
      replace?: boolean;
    };

    if (!client_id) {
      return NextResponse.json({ error: 'client_id is required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const startDate = start_date ? new Date(start_date) : new Date();

    if (replace) {
      await supabase
        .from('client_tasks')
        .delete()
        .eq('client_id', client_id)
        .eq('completed', false)
        .in('phase', ['gbp_setup', 'website', 'citations', 'ongoing']);
    }

    const tasks: TaskInsert[] = [];

    for (const t of GBP_SETUP_TASKS) {
      tasks.push({ client_id, description: t.description, due_date: dayToDate(startDate, t.day), priority: t.priority, phase: 'gbp_setup', completed: false });
    }
    for (const t of WEBSITE_TASKS) {
      tasks.push({ client_id, description: t.description, due_date: dayToDate(startDate, t.day), priority: t.priority, phase: 'website', completed: false });
    }
    for (const t of CITATION_TASKS) {
      tasks.push({ client_id, description: t.description, due_date: dayToDate(startDate, t.day), priority: t.priority, phase: 'citations', completed: false });
    }
    for (const t of buildOngoingTasks()) {
      tasks.push({ client_id, description: t.description, due_date: dayToDate(startDate, t.day), priority: t.priority, phase: 'ongoing', completed: false });
    }

    const { data, error } = await supabase.from('client_tasks').insert(tasks).select();

    if (error) {
      console.error('[tasks/generate] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ created: tasks.length, tasks: data }, { status: 201 });
  } catch (err) {
    console.error('[tasks/generate] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
