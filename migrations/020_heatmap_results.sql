-- Heatmap / rank-tracking screenshot uploads (agency-side)
-- Used by RankTrackingTab to store LeadSnap scan results per client.

create table if not exists public.heatmap_results (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.clients(id) on delete cascade,
  scan_date           date not null,
  keyword             text not null,
  grid_data           jsonb not null default '{}',   -- { screenshot_url, notes, scan_type }
  average_rank        numeric(5,1) not null,
  top_rank            integer not null,
  coverage_percentage integer not null check (coverage_percentage between 0 and 100),
  created_at          timestamptz not null default now()
);

-- Index for per-client queries (the dominant access pattern)
create index if not exists heatmap_results_client_date_idx
  on public.heatmap_results (client_id, scan_date desc);

-- RLS: agency users can read/write all rows; anon cannot.
alter table public.heatmap_results enable row level security;

create policy "Agency full access" on public.heatmap_results
  for all
  using  (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
