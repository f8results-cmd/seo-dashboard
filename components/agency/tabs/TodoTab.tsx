'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Check, AlertCircle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format, isPast, isToday, parseISO } from 'date-fns';
import type { Client, ClientTask, TaskPriority, StaffChecklistKey, ChecklistItemMeta } from '@/lib/types';

// ---- Standard delivery tasks ----
const STAFF_TASKS: { key: StaffChecklistKey; label: string; category: string }[] = [
  // GBP
  { key: 'gbp_primary_category',     label: 'Set primary GBP category in Google Business Profile', category: 'GBP' },
  { key: 'gbp_secondary_categories', label: 'Add secondary GBP categories (4-5 max)',               category: 'GBP' },
  { key: 'gbp_description',          label: 'Update business description in GBP (under 750 chars)', category: 'GBP' },
  { key: 'gbp_services',             label: 'Add all 30 services to GBP services section',          category: 'GBP' },
  { key: 'gbp_hours',                label: 'Set business hours in GBP',                            category: 'GBP' },
  { key: 'gbp_logo',                 label: 'Upload logo to GBP profile photo',                     category: 'GBP' },
  { key: 'gbp_cover_photo',          label: 'Upload cover photo to GBP',                            category: 'GBP' },
  { key: 'gbp_photos',               label: 'Upload 10+ photos to GBP',                             category: 'GBP' },
  { key: 'gbp_ghl_connected',        label: 'Connect GBP to GHL sub-account for auto posting',      category: 'GBP' },
  // Website
  { key: 'website_reviewed',         label: 'Review live website and check all pages load',          category: 'Website' },
  { key: 'website_title_tags',       label: 'Verify title tags on homepage and key pages',           category: 'Website' },
  { key: 'website_mobile_check',     label: 'Check phone number is clickable on mobile',             category: 'Website' },
  { key: 'website_sitemap',          label: 'Submit sitemap to Google Search Console',               category: 'Website' },
  { key: 'website_schema',           label: 'Verify schema markup is working',                       category: 'Website' },
  // SEO
  { key: 'seo_services_approved',    label: 'Review and approve 30 services list',                   category: 'SEO' },
  { key: 'seo_category_pages',       label: 'Check all secondary category pages are live',           category: 'SEO' },
  { key: 'seo_internal_linking',     label: 'Verify internal linking between pages',                 category: 'SEO' },
  { key: 'seo_suburb_pages',         label: 'Review suburb pages for local content accuracy',        category: 'SEO' },
  // Citations
  { key: 'citations_leadsnap',           label: 'Confirm LeadSnap citation submission',                   category: 'Citations' },
  { key: 'citations_backlinks_reviewed', label: 'Review backlink opportunities report',                    category: 'Citations' },
  { key: 'citations_top3_actioned',      label: 'Action top 3 local organisation links manually',         category: 'Citations' },
  { key: 'citations_nap_check',          label: 'Check NAP consistency across all citations',              category: 'Citations' },
  // Client
  { key: 'client_welcome_email',     label: 'Send welcome email to client',                          category: 'Client' },
  { key: 'client_gbp_guide',         label: 'Send GBP setup guide to client',                        category: 'Client' },
  { key: 'client_first_update',      label: 'Send first Friday update',                              category: 'Client' },
  { key: 'client_onboarding_call',   label: 'Schedule onboarding call if needed',                    category: 'Client' },
];

const CATEGORIES = ['GBP', 'Website', 'SEO', 'Citations', 'Client'] as const;

const CATEGORY_STYLES: Record<string, { badge: string; bar: string }> = {
  GBP:       { badge: 'bg-blue-50 text-blue-700',    bar: '#3b82f6' },
  Website:   { badge: 'bg-purple-50 text-purple-700', bar: '#8b5cf6' },
  SEO:       { badge: 'bg-green-50 text-green-700',   bar: '#22c55e' },
  Citations: { badge: 'bg-orange-50 text-orange-700', bar: '#f97316' },
  Client:    { badge: 'bg-rose-50 text-rose-700',     bar: '#f43f5e' },
};

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  high: 'bg-red-500', medium: 'bg-amber-400', low: 'bg-blue-400',
};

type CheckState = Partial<Record<StaffChecklistKey, boolean>>;
type MetaState  = Partial<Record<StaffChecklistKey, ChecklistItemMeta>>;

interface Props {
  client: Client;
  onUpdate?: () => void;
}

export default function TodoTab({ client, onUpdate }: Props) {
  const supabase = createClient();

  // ---- Section 1: Standard checklist local state ----
  const [checks, setChecks]     = useState<CheckState>(client.onboarding_checklist?.checklist ?? {});
  const [meta,   setMeta]       = useState<MetaState>(client.onboarding_checklist?.checklist_meta ?? {});
  const [savingKey, setSavingKey] = useState<StaffChecklistKey | null>(null);
  const metaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function persistChecklist(newChecks: CheckState, newMeta: MetaState) {
    const existing = client.onboarding_checklist ?? {};
    await supabase
      .from('clients')
      .update({ onboarding_checklist: { ...existing, checklist: newChecks, checklist_meta: newMeta } })
      .eq('id', client.id);
  }

  async function toggleCheck(key: StaffChecklistKey) {
    const newChecks = { ...checks, [key]: !checks[key] };
    setSavingKey(key);
    setChecks(newChecks);
    await persistChecklist(newChecks, meta);
    setSavingKey(null);
    onUpdate?.();
  }

  function updateMeta(key: StaffChecklistKey, field: keyof ChecklistItemMeta, value: string) {
    const newMeta: MetaState = { ...meta, [key]: { ...(meta[key] ?? {}), [field]: value || undefined } };
    setMeta(newMeta);
    if (metaTimer.current) clearTimeout(metaTimer.current);
    metaTimer.current = setTimeout(() => persistChecklist(checks, newMeta), 800);
  }

  const totalTasks    = STAFF_TASKS.length;
  const completedCount = STAFF_TASKS.filter(t => checks[t.key]).length;
  const overallPct    = Math.round((completedCount / totalTasks) * 100);

  // ---- Section 2: Custom tasks ----
  const [tasks,       setTasks]      = useState<ClientTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [showForm,    setShowForm]   = useState(false);
  const [desc,        setDesc]       = useState('');
  const [dueDate,     setDueDate]    = useState('');
  const [priority,    setPriority]   = useState<TaskPriority>('medium');
  const [saving,      setSaving]     = useState(false);

  const loadTasks = useCallback(async () => {
    const { data } = await supabase
      .from('client_tasks')
      .select('*')
      .eq('client_id', client.id)
      .order('due_date', { ascending: true, nullsFirst: false });
    setTasks((data ?? []) as ClientTask[]);
    setLoadingTasks(false);
  }, [client.id]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!desc.trim()) return;
    setSaving(true);
    await supabase.from('client_tasks').insert({
      client_id: client.id,
      description: desc.trim(),
      due_date: dueDate || null,
      priority,
    });
    setDesc(''); setDueDate(''); setPriority('medium'); setShowForm(false);
    setSaving(false);
    loadTasks();
  }

  async function toggleTask(task: ClientTask) {
    await supabase.from('client_tasks').update({ completed: !task.completed }).eq('id', task.id);
    loadTasks();
  }

  const openTasks = tasks.filter(t => !t.completed);
  const doneTasks = tasks.filter(t => t.completed);

  function isOverdue(t: ClientTask) {
    return !t.completed && !!t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date));
  }

  return (
    <div className="p-6 space-y-8">

      {/* ======================================================
          SECTION 1 — Standard Delivery Checklist
         ====================================================== */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-900">Standard Delivery Checklist</h2>
          <span className="text-sm font-medium text-gray-600">
            {completedCount} / {totalTasks} &nbsp;
            <span className={overallPct === 100 ? 'text-green-600' : 'text-[#E8622A]'}>{overallPct}%</span>
          </span>
        </div>

        {/* Overall progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-2.5 mb-6">
          <div
            className="h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${overallPct}%`, backgroundColor: overallPct === 100 ? '#22c55e' : '#E8622A' }}
          />
        </div>

        <div className="space-y-5">
          {CATEGORIES.map(cat => {
            const catTasks  = STAFF_TASKS.filter(t => t.category === cat);
            const catDone   = catTasks.filter(t => checks[t.key]).length;
            const catPct    = Math.round((catDone / catTasks.length) * 100);
            const styles    = CATEGORY_STYLES[cat];

            return (
              <div key={cat} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Category header */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center gap-2.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles.badge}`}>{cat}</span>
                    <span className="text-xs text-gray-400">{catDone} of {catTasks.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${catPct}%`, backgroundColor: styles.bar }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-7 text-right">{catPct}%</span>
                  </div>
                </div>

                {/* Task rows */}
                <div className="divide-y divide-gray-50">
                  {catTasks.map(task => {
                    const done     = !!checks[task.key];
                    const taskMeta = meta[task.key] ?? {};
                    const isSaving = savingKey === task.key;

                    return (
                      <div
                        key={task.key}
                        className={`flex items-center gap-3 px-4 py-2.5 ${done ? 'bg-gray-50/60' : 'bg-white'}`}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => !isSaving && toggleCheck(task.key)}
                          disabled={isSaving}
                          className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            done
                              ? 'bg-green-500 border-green-500'
                              : 'border-gray-300 hover:border-green-400 bg-white'
                          } disabled:opacity-50`}
                          aria-label={done ? 'Mark incomplete' : 'Mark complete'}
                        >
                          {isSaving
                            ? <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
                            : done && <Check className="w-3 h-3 text-white" strokeWidth={3} />
                          }
                        </button>

                        {/* Label */}
                        <span className={`flex-1 text-sm min-w-0 ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {task.label}
                        </span>

                        {/* Assigned to */}
                        <select
                          value={taskMeta.assigned_to ?? ''}
                          onChange={e => updateMeta(task.key, 'assigned_to', e.target.value)}
                          className="flex-shrink-0 text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-[#E8622A]/30 w-28"
                        >
                          <option value="">Unassigned</option>
                          <option value="Sebastian">Sebastian</option>
                        </select>

                        {/* Due date */}
                        <input
                          type="date"
                          value={taskMeta.due_date ?? ''}
                          onChange={e => updateMeta(task.key, 'due_date', e.target.value)}
                          className="flex-shrink-0 text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-[#E8622A]/30 w-32"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* ======================================================
          SECTION 2 — Additional Tasks
         ====================================================== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Additional Tasks</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 text-sm bg-[#E8622A] text-white px-3 py-1.5 rounded-lg hover:bg-[#d05520] transition-colors"
          >
            <Plus className="w-4 h-4" /> Add task
          </button>
        </div>

        {showForm && (
          <form onSubmit={addTask} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
            <input
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Task description…"
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
              required
            />
            <div className="flex gap-3 flex-wrap">
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
              />
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as TaskPriority)}
                className="border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8622A]/30"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <button
                type="submit"
                disabled={saving}
                className="ml-auto bg-[#1a2744] text-white px-4 py-2 rounded text-sm hover:bg-[#243460] transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}

        {loadingTasks ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : openTasks.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No additional tasks — add one above.</p>
        ) : (
          <div className="space-y-2">
            {openTasks.map(task => (
              <div
                key={task.id}
                className={`flex items-start gap-3 bg-white border rounded-lg px-4 py-3 ${
                  isOverdue(task) ? 'border-red-200 bg-red-50' : 'border-gray-200'
                }`}
              >
                <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${PRIORITY_STYLES[task.priority]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{task.description}</p>
                  {task.due_date && (
                    <span className={`text-xs mt-0.5 flex items-center gap-1 ${
                      isOverdue(task) ? 'text-red-600 font-medium' : 'text-gray-400'
                    }`}>
                      {isOverdue(task) && <AlertCircle className="w-3 h-3" />}
                      {format(parseISO(task.due_date), 'd MMM yyyy')}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => toggleTask(task)}
                  className="flex-shrink-0 w-5 h-5 border-2 border-gray-300 rounded hover:border-green-500 transition-colors mt-0.5"
                  aria-label="Mark done"
                />
              </div>
            ))}
          </div>
        )}

        {doneTasks.length > 0 && (
          <details className="mt-2">
            <summary className="text-sm text-gray-400 cursor-pointer select-none">
              {doneTasks.length} completed task{doneTasks.length !== 1 ? 's' : ''}
            </summary>
            <div className="space-y-2 mt-2">
              {doneTasks.map(task => (
                <div key={task.id} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 opacity-60">
                  <button onClick={() => toggleTask(task)} className="flex-shrink-0 text-green-500">
                    <Check className="w-5 h-5" />
                  </button>
                  <p className="text-sm text-gray-500 line-through">{task.description}</p>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
