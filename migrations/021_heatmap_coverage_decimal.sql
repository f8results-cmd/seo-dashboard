-- Allow decimal coverage percentages (e.g. 0.86%, 68.5%) in heatmap_results.
-- Changes coverage_percentage from integer to numeric(5,2) and updates the check constraint.

alter table public.heatmap_results
  alter column coverage_percentage type numeric(5,2)
    using coverage_percentage::numeric(5,2);

alter table public.heatmap_results
  drop constraint if exists heatmap_results_coverage_percentage_check;

alter table public.heatmap_results
  add constraint heatmap_results_coverage_percentage_check
    check (coverage_percentage >= 0 and coverage_percentage <= 100);
