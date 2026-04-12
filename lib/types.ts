export type ClientStatus = 'pending' | 'active' | 'complete' | 'inactive' | 'running' | 'error' | 'failed';

export interface ClientPhotos {
  logo:     string | null;
  cover:    string | null;
  exterior: string | null;
  owner:    string | null;
  work1:    string | null;
  work2:    string | null;
  before:   string | null;
  after:    string | null;
  extra1:   string | null;
  extra2:   string | null;
}

export interface OnboardingChecklist {
  ghl_created:       boolean;
  gbp_connected:     boolean;
  wp_activated:      boolean;
  first_update_sent: boolean;
}

export type JobStatus = 'pending' | 'running' | 'complete' | 'error';
export type PostStatus = 'scheduled' | 'posted' | 'failed';
export type ReviewStatus = 'pending' | 'approved' | 'posted';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface Client {
  id: string;
  business_name: string;
  owner_name: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  niche: string | null;
  website_url: string | null;
  gbp_url: string | null;
  tagline: string | null;
  years_in_business: number | null;
  brand_primary_color: string | null;
  brand_accent_color: string | null;
  ghl_location_id: string | null;
  ghl_api_key: string | null;
  wp_url: string | null;
  wp_username: string | null;
  wp_app_password: string | null;
  agency_notes: string | null;
  blog_delivery: string | null;
  status: ClientStatus;
  live_url: string | null;
  github_repo: string | null;
  website_data: Record<string, unknown> | null;
  postcode: string | null;
  skip_website: boolean;
  ghl_webhook_url: string | null;
  google_maps_embed_url: string | null;
  google_place_id: string | null;
  google_tag_id: string | null;
  review_count: number | null;
  review_rating: number | null;
  auto_respond_reviews: boolean;
  gbp_location_name: string | null;
  logo_url: string | null;
  photos: ClientPhotos | null;
  created_at: string;
  // New columns
  onboarding_checklist: OnboardingChecklist | null;
  last_friday_update: string | null;
  health_score: number;
}

export interface Job {
  id: string;
  client_id: string;
  agent_name: string;
  status: JobStatus;
  log: string | null;
  started_at: string | null;
  completed_at: string | null;
}

// Score field names match Python supabase_client.py write_scores()
export interface Score {
  id: string;
  client_id: string;
  local_seo_score: number;
  onsite_seo_score: number;
  geo_score: number;
  recorded_at: string;
}

// Deliverable field names match Python: label + status
export interface Deliverable {
  id: string;
  client_id: string;
  label: string;
  status: string | null;
}

export interface ScheduledJob {
  id: string;
  client_id: string;
  job_type: string;
  status: string;
  run_at: string;
  result: string | null;
  completed_at: string | null;
}

// ReviewResponse field names match Python: draft_response + status
export interface ReviewResponse {
  id: string;
  client_id: string;
  reviewer_name: string | null;
  review_text: string | null;
  rating: number | null;
  draft_response: string | null;
  status: ReviewStatus;
  created_at: string;
}

// RankTracking matches Python rank_tracking table
export interface RankTracking {
  id: string;
  client_id: string;
  keyword: string;
  position: number | null;
  local_pack: boolean;
  checked_at: string;
}

export interface GbpPost {
  id: string;
  client_id: string;
  content: string;
  post_type: string | null;
  scheduled_date: string | null;
  ghl_post_id: string | null;
  status: PostStatus;
  created_at: string;
}

export interface HeatmapResult {
  id: string;
  client_id: string;
  scan_date: string;
  keyword: string;
  grid_data: { screenshot_url: string; notes?: string; scan_type?: string };
  average_rank: number;
  top_rank: number;
  coverage_percentage: number;
}

export interface MonthlyReport {
  id: string;
  client_id: string;
  month: string;
  summary: string | null;
  pdf_url: string | null;
  created_at: string;
}

// New tables
export interface ClientTask {
  id: string;
  client_id: string;
  description: string;
  due_date: string | null;
  priority: TaskPriority;
  completed: boolean;
  created_at: string;
  // joined field
  client_name?: string;
}

export interface ClientNote {
  id: string;
  client_id: string;
  note: string;
  created_at: string;
}

export interface FridayUpdate {
  id: string;
  client_id: string;
  content: string;
  sent_at: string;
  delivery_method: string;
}

// Computed reminder (not a DB table — generated from client data)
export interface Reminder {
  id: string;
  client_id: string;
  client_name: string;
  description: string;
  due_date: string;
  type: 'friday_update' | 'rank_screenshot' | 'photo_reminder' | 'onboarding';
  overdue: boolean;
}

// Supabase Database type
export type Database = {
  public: {
    Tables: {
      clients:         { Row: Client;         Insert: Partial<Client>;         Update: Partial<Client> };
      jobs:            { Row: Job;            Insert: Partial<Job>;            Update: Partial<Job> };
      scores:          { Row: Score;          Insert: Partial<Score>;          Update: Partial<Score> };
      deliverables:    { Row: Deliverable;    Insert: Partial<Deliverable>;    Update: Partial<Deliverable> };
      scheduled_jobs:  { Row: ScheduledJob;  Insert: Partial<ScheduledJob>;  Update: Partial<ScheduledJob> };
      review_responses:{ Row: ReviewResponse;Insert: Partial<ReviewResponse>;Update: Partial<ReviewResponse> };
      rank_tracking:   { Row: RankTracking;  Insert: Partial<RankTracking>;  Update: Partial<RankTracking> };
      gbp_posts:       { Row: GbpPost;       Insert: Partial<GbpPost>;       Update: Partial<GbpPost> };
      monthly_reports: { Row: MonthlyReport; Insert: Partial<MonthlyReport>; Update: Partial<MonthlyReport> };
      client_tasks:    { Row: ClientTask;    Insert: Partial<ClientTask>;    Update: Partial<ClientTask> };
      client_notes:    { Row: ClientNote;    Insert: Partial<ClientNote>;    Update: Partial<ClientNote> };
      friday_updates:  { Row: FridayUpdate;  Insert: Partial<FridayUpdate>;  Update: Partial<FridayUpdate> };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
