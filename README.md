# Figure8 Results SEO Dashboard

Two-portal Next.js 14 dashboard — internal agency tool + client-facing portal.

## Portals

| Portal | URL | Auth |
|--------|-----|------|
| Agency Dashboard | `/agency` | Email/password (sebastian@figure8results.com only) |
| Client Portal | `/portal` | Magic link (clients enter their email) |

## Setup

### 1. Install dependencies

```bash
cd /Users/sebastian.willis-hell/seo-dashboard
npm install
```

### 2. Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```bash
cp .env.local.example .env.local
```

Required values:
- `NEXT_PUBLIC_SUPABASE_URL` — `https://exfkzyahbzrcxpvciqih.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase project settings → API
- `SUPABASE_SERVICE_KEY` — service role key from same page (keep secret, server-only)
- `NEXT_PUBLIC_RAILWAY_URL` — your Railway backend URL

### 3. Supabase setup

The app reads from your existing Supabase project. It also needs two additional tables if they don't exist yet:

```sql
-- Keyword rankings (for rank tracking)
create table if not exists keyword_rankings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  keyword text not null,
  position int,
  previous_position int,
  in_local_pack boolean default false,
  recorded_at timestamptz default now()
);

-- GBP posts
create table if not exists gbp_posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  content text not null,
  post_type text,
  scheduled_date timestamptz,
  status text default 'scheduled',
  created_at timestamptz default now()
);

-- Monthly reports
create table if not exists monthly_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  month text not null,
  summary text,
  pdf_url text,
  created_at timestamptz default now()
);
```

Enable Row Level Security and add policies so clients can only see their own data:

```sql
-- Enable RLS on client-facing tables
alter table keyword_rankings enable row level security;
alter table gbp_posts enable row level security;
alter table monthly_reports enable row level security;
alter table review_responses enable row level security;
alter table scores enable row level security;

-- Policy: clients can read rows where client_id matches their email
create policy "client read own rankings" on keyword_rankings for select
  using (client_id = (select id from clients where email = auth.email()));

create policy "client read own posts" on gbp_posts for select
  using (client_id = (select id from clients where email = auth.email()));

create policy "client read own reports" on monthly_reports for select
  using (client_id = (select id from clients where email = auth.email()));

create policy "client read own reviews" on review_responses for select
  using (client_id = (select id from clients where email = auth.email()));

create policy "client update own reviews" on review_responses for update
  using (client_id = (select id from clients where email = auth.email()));

create policy "client read own scores" on scores for select
  using (client_id = (select id from clients where email = auth.email()));

-- Agency (service role) bypasses RLS, so no agency policies needed
```

### 4. Supabase Auth — enable magic links

In Supabase dashboard → Authentication → Email:
- Enable "Email" provider
- Set Site URL to your Vercel deployment URL (e.g. `https://seo-dashboard.vercel.app`)
- Add `https://seo-dashboard.vercel.app/auth/callback` to Redirect URLs

For local dev add `http://localhost:3000/auth/callback`.

### 5. Run locally

```bash
npm run dev
# Open http://localhost:3000
```

## Deploy to Vercel

### Option A — Vercel CLI

```bash
npm install -g vercel
vercel --prod
```

### Option B — GitHub integration

1. Push this directory to a GitHub repo
2. Import in Vercel dashboard
3. Set all env vars in Vercel project settings
4. Deploy

### Important Vercel settings

- Framework preset: **Next.js**
- Build command: `npm run build` (default)
- Output directory: `.next` (default)
- Node.js version: 20.x

Add all four env vars in **Settings → Environment Variables**.

## Project structure

```
app/
  agency/          # Agency portal (password protected)
    clients/       # Client list + detail + new client form
    action-items/  # Manual actions queue
    reports/       # Monthly reports + rank tracking
  portal/          # Client portal (magic link)
    rankings/      # Keyword position table + history chart
    posts/         # GBP post calendar
    reviews/       # Review responses
    website/       # Site preview + page list
    reports/       # Monthly reports
  auth/
    agency/        # Email/password login
    portal/        # Magic link request
    callback/      # OAuth/magic link exchange
components/
  agency/          # Agency-specific components
  portal/          # Portal-specific components
lib/
  supabase/        # Browser + server + service clients
  types.ts         # Shared TypeScript types
middleware.ts      # Route protection
```

## Adding a client

1. Go to `/agency/clients/new`
2. Fill in the form (at minimum: business name, email, city, niche)
3. Submit — this creates the Supabase record and triggers the Railway pipeline

The client can then log in to `/portal` using the email you entered.
