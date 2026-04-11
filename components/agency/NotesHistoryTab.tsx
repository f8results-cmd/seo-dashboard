'use client';

import { useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import type { Client, Job, ScheduledJob, RankTracking, GbpPost, MonthlyReport } from '@/lib/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENT_LABELS: Record<string, string> = {
  research_agent:  'Research',
  content_agent:   'Content',
  design_agent:    'Design',
  deploy_agent:    'Deploy',
  suburb_agent:    'Suburb Pages',
  gbp_agent:       'Google Business Profile',
  citation_agent:  'Citations',
  report_agent:    'Report',
};

const SCHEDULED_JOB_LABELS: Record<string, string> = {
  weekly_gbp_post:       'Weekly GBP Post',
  weekly_review_check:   'Weekly Review Check',
  monthly_blog_post:     'Monthly Blog Post',
  monthly_report:        'Monthly Report',
  monthly_citation_audit:'Monthly Citation Audit',
  rank_check:            'Rank Check',
};

const PAGE_SIZE = 20;

// ─── Timeline item type ───────────────────────────────────────────────────────

type ItemType = 'job' | 'scheduled_job' | 'ranking' | 'gbp_post' | 'monthly_report';

interface TimelineItem {
  id:     string;
  type:   ItemType;
  date:   string;
  title:  string;
  status: string;
  detail: unknown;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  client:        Client;
  jobs:          Job[];
  scheduledJobs: ScheduledJob[];
  rankings:      RankTracking[];
  gbpPosts:      GbpPost[];
  monthlyReports:MonthlyReport[];
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NotesHistoryTab({
  client,
  jobs,
  scheduledJobs,
  rankings,
  gbpPosts,
  monthlyReports,
}: Props) {
  return (
    <div className="space-y-5">
      <ClientNotesSection client={client} />
      <OnboardingSnapshotSection client={client} />
      <ActivityTimelineSection
        jobs={jobs}
        scheduledJobs={scheduledJobs}
        rankings={rankings}
        gbpPosts={gbpPosts}
        monthlyReports={monthlyReports}
      />
    </div>
  );
}

// ─── Section 1: Client Notes ──────────────────────────────────────────────────

function ClientNotesSection({ client }: { client: Client }) {
  const [editing,  setEditing]  = useState(false);
  const [value,    setValue]    = useState(client.agency_notes ?? '');
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState('');

  async function save() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agency_notes: value || null }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Save failed');
        return;
      }
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setValue(client.agency_notes ?? '');
    setEditing(false);
    setError('');
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">Client Notes</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Added {format(parseISO(client.created_at), 'dd MMM yyyy')}
          </p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            <PencilIcon />
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <textarea
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-300 focus:border-transparent resize-none leading-relaxed"
            rows={8}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Internal notes about this client — services, constraints, agency instructions..."
            autoFocus
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 bg-navy-500 text-white text-sm font-medium rounded-lg hover:bg-navy-600 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={cancel}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          {value ? (
            <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
              {value}
            </pre>
          ) : (
            <p className="text-sm text-gray-400 italic">No notes yet — click Edit to add agency notes.</p>
          )}
          {saved && (
            <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Saved
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section 2: Onboarding Snapshot ──────────────────────────────────────────

function OnboardingSnapshotSection({ client }: { client: Client }) {
  const fields = [
    { label: 'Business Name', value: client.business_name },
    { label: 'Owner',         value: client.owner_name },
    { label: 'Email',         value: client.email },
    { label: 'Phone',         value: client.phone },
    { label: 'City',          value: [client.city, client.state].filter(Boolean).join(', ') || null },
    { label: 'Niche',         value: client.niche },
    { label: 'Website URL',   value: client.website_url },
    { label: 'Date Added',    value: format(parseISO(client.created_at), 'dd MMM yyyy') },
  ].filter((f): f is { label: string; value: string } => !!f.value);

  const copyText = fields.map((f) => `${f.label}: ${f.value}`).join('\n');

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Onboarding Snapshot</h3>
        <CopyButton text={copyText} label="Copy All" />
      </div>
      <div className="divide-y divide-gray-50">
        {fields.map((f) => (
          <div key={f.label} className="flex items-center gap-4 py-2.5">
            <span className="text-xs font-medium text-gray-500 w-28 flex-shrink-0">{f.label}</span>
            <span className="text-sm text-gray-800 flex-1 font-mono truncate">{f.value}</span>
            <CopyButton text={f.value} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section 3: Activity Timeline ────────────────────────────────────────────

function ActivityTimelineSection({
  jobs,
  scheduledJobs,
  rankings,
  gbpPosts,
  monthlyReports,
}: Omit<Props, 'client'>) {
  const [visible,  setVisible]  = useState(PAGE_SIZE);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const items = buildTimeline(jobs, scheduledJobs, rankings, gbpPosts, monthlyReports);
  const shown = items.slice(0, visible);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-gray-900">Activity Timeline</h3>
          <p className="text-xs text-gray-400 mt-0.5">{items.length} events</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="py-12 text-center">
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">No activity yet</p>
          <p className="text-xs text-gray-400 mt-1">Events will appear here as the pipeline runs</p>
        </div>
      ) : (
        <>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-100" />

            <div className="space-y-1">
              {shown.map((item) => (
                <TimelineRow
                  key={item.id}
                  item={item}
                  expanded={expanded.has(item.id)}
                  onToggle={() => toggleExpand(item.id)}
                />
              ))}
            </div>
          </div>

          {visible < items.length && (
            <button
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="mt-5 w-full py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Load more ({items.length - visible} remaining)
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Timeline Row ─────────────────────────────────────────────────────────────

function TimelineRow({
  item,
  expanded,
  onToggle,
}: {
  item: TimelineItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasDetail = !!item.detail;

  return (
    <div className="relative pl-11">
      {/* Icon */}
      <div className="absolute left-0 top-3 w-8 h-8 rounded-full flex items-center justify-center bg-white border border-gray-200 z-10">
        <TimelineIcon type={item.type} status={item.status} />
      </div>

      <div
        className={`rounded-lg px-4 py-3 transition-colors ${
          hasDetail ? 'cursor-pointer hover:bg-gray-50' : ''
        }`}
        onClick={hasDetail ? onToggle : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-800">{item.title}</span>
              <StatusBadge type={item.type} status={item.status} />
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {item.date ? format(parseISO(item.date), 'dd MMM yyyy, HH:mm') : '—'}
            </p>
          </div>
          {hasDetail && (
            <svg
              className={`w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          )}
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <DetailPanel type={item.type} detail={item.detail} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({ type, detail }: { type: ItemType; detail: unknown }) {
  if (type === 'job') {
    const job = detail as Job;
    return (
      <div className="space-y-2">
        {job.started_at && (
          <p className="text-xs text-gray-500">
            Started: {format(parseISO(job.started_at), 'dd MMM yyyy, HH:mm')}
          </p>
        )}
        {job.completed_at && (
          <p className="text-xs text-gray-500">
            Completed: {format(parseISO(job.completed_at), 'dd MMM yyyy, HH:mm')}
          </p>
        )}
        {job.log && (
          <pre className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto leading-relaxed">
            {job.log}
          </pre>
        )}
      </div>
    );
  }

  if (type === 'scheduled_job') {
    const sj = detail as ScheduledJob;
    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-500">Scheduled: {format(parseISO(sj.run_at), 'dd MMM yyyy, HH:mm')}</p>
        {sj.completed_at && (
          <p className="text-xs text-gray-500">Completed: {format(parseISO(sj.completed_at), 'dd MMM yyyy, HH:mm')}</p>
        )}
        {sj.result && (
          <pre className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
            {sj.result}
          </pre>
        )}
      </div>
    );
  }

  if (type === 'ranking') {
    const rows = detail as (RankTracking & { prev?: number | null })[];
    return (
      <div className="space-y-1">
        {rows.map((r) => {
          const delta = r.prev != null && r.position != null ? r.prev - r.position : null;
          return (
            <div key={r.id} className="flex items-center gap-3 text-xs">
              <span className="text-gray-700 flex-1 truncate">{r.keyword}</span>
              <span className={`font-bold tabular-nums w-6 text-right ${
                r.position == null ? 'text-gray-400'
                : r.position <= 3 ? 'text-green-600'
                : r.position <= 10 ? 'text-yellow-600'
                : 'text-gray-600'
              }`}>
                {r.position ?? '—'}
              </span>
              <span className="w-12 text-right tabular-nums">
                {delta == null ? (
                  <span className="text-gray-300">—</span>
                ) : delta > 0 ? (
                  <span className="text-green-600 font-medium">▲ {delta}</span>
                ) : delta < 0 ? (
                  <span className="text-red-500 font-medium">▼ {Math.abs(delta)}</span>
                ) : (
                  <span className="text-gray-400">→</span>
                )}
              </span>
              {r.local_pack && (
                <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">Pack</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (type === 'gbp_post') {
    const post = detail as GbpPost;
    return (
      <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{post.content}</p>
    );
  }

  if (type === 'monthly_report') {
    const report = detail as MonthlyReport;
    return (
      <div className="space-y-2">
        {report.summary && <p className="text-xs text-gray-600 leading-relaxed">{report.summary}</p>}
        {report.pdf_url && (
          <a
            href={report.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-navy-600 hover:underline font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            View PDF Report
          </a>
        )}
      </div>
    );
  }

  return null;
}

// ─── Timeline builder ─────────────────────────────────────────────────────────

function buildTimeline(
  jobs: Job[],
  scheduledJobs: ScheduledJob[],
  rankings: RankTracking[],
  gbpPosts: GbpPost[],
  monthlyReports: MonthlyReport[],
): TimelineItem[] {
  const items: TimelineItem[] = [];

  // Agent jobs (exclude internal pipeline_failure marker)
  for (const j of jobs) {
    if (j.agent_name === '_pipeline_failure') continue;
    const date = j.completed_at ?? j.started_at ?? '';
    if (!date) continue;
    items.push({
      id:     `job-${j.id}`,
      type:   'job',
      date,
      title:  `${AGENT_LABELS[j.agent_name] ?? j.agent_name} agent ran`,
      status: j.status,
      detail: j,
    });
  }

  // Scheduled jobs
  for (const sj of scheduledJobs) {
    items.push({
      id:     `sched-${sj.id}`,
      type:   'scheduled_job',
      date:   sj.completed_at ?? sj.run_at,
      title:  `Scheduled: ${SCHEDULED_JOB_LABELS[sj.job_type] ?? sj.job_type}`,
      status: sj.status,
      detail: sj,
    });
  }

  // Rankings — group by checked_at date so one rank-check run = one timeline item
  const rankByDate: Record<string, RankTracking[]> = {};
  for (const r of rankings) {
    const day = r.checked_at.substring(0, 10);
    if (!rankByDate[day]) rankByDate[day] = [];
    rankByDate[day].push(r);
  }

  // Build prev-position lookup: for each keyword, what was the position before this date?
  // rankings is already sorted desc by checked_at from the query
  const keywordHistory: Record<string, number | null> = {};
  const allDays = Object.keys(rankByDate).sort().reverse(); // newest first

  for (const day of allDays) {
    const dayRows = rankByDate[day];
    const enriched = dayRows.map((r) => ({
      ...r,
      // look for a later (older) entry for the same keyword
      prev: keywordHistory[r.keyword] ?? null,
    }));
    // update history with this day's positions
    for (const r of dayRows) keywordHistory[r.keyword] = r.position;

    items.push({
      id:     `ranking-${day}`,
      type:   'ranking',
      date:   dayRows[0].checked_at,
      title:  `Rank check — ${dayRows.length} keyword${dayRows.length !== 1 ? 's' : ''}`,
      status: 'complete',
      detail: enriched,
    });
  }

  // GBP posts
  for (const p of gbpPosts) {
    items.push({
      id:     `post-${p.id}`,
      type:   'gbp_post',
      date:   p.scheduled_date ?? p.created_at,
      title:  `GBP Post — ${p.post_type ?? "What's New"}`,
      status: p.status,
      detail: p,
    });
  }

  // Monthly reports
  for (const r of monthlyReports) {
    items.push({
      id:     `report-${r.id}`,
      type:   'monthly_report',
      date:   r.created_at,
      title:  `Monthly Report — ${r.month}`,
      status: 'complete',
      detail: r,
    });
  }

  return items.sort((a, b) => b.date.localeCompare(a.date));
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function TimelineIcon({ type, status }: { type: ItemType; status: string }) {
  const baseClass = 'w-4 h-4';

  if (type === 'job') {
    const colour =
      status === 'complete' ? 'text-green-500'
      : status === 'error'  ? 'text-red-500'
      : status === 'running' ? 'text-blue-500'
      : 'text-yellow-500';
    return (
      <svg className={`${baseClass} ${colour}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
      </svg>
    );
  }

  if (type === 'scheduled_job') {
    return (
      <svg className={`${baseClass} text-purple-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }

  if (type === 'ranking') {
    return (
      <svg className={`${baseClass} text-yellow-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    );
  }

  if (type === 'gbp_post') {
    return (
      <svg className={`${baseClass} text-blue-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
      </svg>
    );
  }

  // monthly_report
  return (
    <svg className={`${baseClass} text-orange-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ type, status }: { type: ItemType; status: string }) {
  const map: Record<string, string> = {
    // job / scheduled_job
    complete:  'bg-green-100 text-green-700',
    error:     'bg-red-100 text-red-700',
    failed:    'bg-red-100 text-red-700',
    running:   'bg-blue-100 text-blue-700',
    pending:   'bg-yellow-100 text-yellow-700',
    skipped:   'bg-gray-100 text-gray-500',
    // gbp_post
    posted:    'bg-green-100 text-green-700',
    scheduled: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${map[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
}

// ─── Copy button (self-contained) ─────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }, [text]);

  return (
    <button
      onClick={copy}
      className={`flex-shrink-0 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
        copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
          </svg>
          {label ?? 'Copy'}
        </>
      )}
    </button>
  );
}
