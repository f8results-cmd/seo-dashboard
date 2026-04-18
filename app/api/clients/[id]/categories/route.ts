import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

type Params = { params: { id: string } };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// GET /api/clients/[id]/categories
// Returns the current category list for the client.
// Priority: clients.gbp_primary_category / gbp_secondary_categories (canonical columns,
//   require migration 012_gbp_categories.sql) → website_data.category_research →
//   website_data.gbp_category_pages names.
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createServiceClient();

  // Try fetching the canonical columns; if they don't exist yet, fall back to website_data only.
  let primaryCategory: string | null = null;
  let secondaryCategories: string[] | null = null;
  let websiteData: Record<string, unknown> | null = null;

  const { data: fullData, error: fullError } = await supabase
    .from('clients')
    .select('gbp_secondary_categories, gbp_primary_category, website_data')
    .eq('id', params.id)
    .single();

  if (fullError && fullError.code === '42703') {
    // Columns don't exist yet (pending migration 012) — fetch website_data only
    const { data: wdData, error: wdError } = await supabase
      .from('clients')
      .select('website_data')
      .eq('id', params.id)
      .single();
    if (wdError || !wdData) {
      return NextResponse.json({ error: wdError?.message ?? 'Client not found' }, { status: 404 });
    }
    websiteData = wdData.website_data as Record<string, unknown> | null;
  } else if (fullError || !fullData) {
    return NextResponse.json({ error: fullError?.message ?? 'Client not found' }, { status: 404 });
  } else {
    primaryCategory = (fullData as any).gbp_primary_category ?? null;
    secondaryCategories = (fullData as any).gbp_secondary_categories ?? null;
    websiteData = fullData.website_data as Record<string, unknown> | null;
  }

  let categories: string[] = secondaryCategories ?? [];

  if (categories.length === 0 && websiteData) {
    // Check website_data.category_research.secondary (written by CategoryResearchAgent)
    const cr = (websiteData as Record<string, unknown>).category_research as Record<string, unknown> | undefined;
    if (cr && Array.isArray(cr.secondary)) {
      categories = (cr.secondary as string[]).filter(Boolean);
    }
  }

  if (categories.length === 0 && websiteData) {
    // Last fallback: extract names from website_data.gbp_category_pages
    const pages = (websiteData as Record<string, unknown>).gbp_category_pages;
    if (Array.isArray(pages)) {
      categories = pages
        .map((p: Record<string, unknown>) => p.category_name as string)
        .filter(Boolean);
    }
  }

  // Primary category: column → website_data.category_research.primary
  if (!primaryCategory && websiteData) {
    const cr = (websiteData as Record<string, unknown>).category_research as Record<string, unknown> | undefined;
    if (cr?.primary) primaryCategory = cr.primary as string;
  }

  return NextResponse.json({
    categories,
    gbp_primary_category: primaryCategory,
  });
}

// PATCH /api/clients/[id]/categories
// body: { categories: string[] }
// Writes to clients.gbp_secondary_categories.
// Also syncs names into clients.website_data.gbp_category_pages (if it exists):
//   - Reorders entries to match new order
//   - Preserves full content for entries that already exist (matched by category_name)
//   - Adds stub entries for new names { slug, category_name }
//   - Drops entries that were removed
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createServiceClient();

  let body: { categories: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { categories } = body;
  if (!Array.isArray(categories)) {
    return NextResponse.json({ error: 'categories must be an array' }, { status: 400 });
  }

  const clean = categories.map(c => c.trim()).filter(Boolean);

  // Read current website_data to sync gbp_category_pages
  const { data: current, error: fetchErr } = await supabase
    .from('clients')
    .select('website_data')
    .eq('id', params.id)
    .single();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const updates: Record<string, unknown> = {};

  if (current?.website_data) {
    const wd = current.website_data as Record<string, unknown>;
    const existingPages = Array.isArray(wd.gbp_category_pages)
      ? (wd.gbp_category_pages as Record<string, unknown>[])
      : [];

    // Index existing pages by category_name for O(1) lookup
    const pagesByName = new Map<string, Record<string, unknown>>();
    for (const page of existingPages) {
      const name = page.category_name as string;
      if (name) pagesByName.set(name, page);
    }

    // Build new ordered gbp_category_pages
    const newPages = clean.map(name => {
      if (pagesByName.has(name)) {
        return pagesByName.get(name)!;
      }
      // New category: stub entry (ContentAgent will fill body_html on next pipeline run)
      return { slug: slugify(name), category_name: name };
    });

    // Also sync gbp_categories flat list
    updates['website_data'] = {
      ...wd,
      gbp_categories: clean,
      gbp_category_pages: newPages,
    };
  }

  const { error: updateErr } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', params.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, categories: clean });
}
