export type ReportCategory =
  | 'pothole'
  | 'broken_road'
  | 'waterlogging'
  | 'signage'
  | 'streetlight'
  | 'other';

export type ReportSeverity = 'low' | 'medium' | 'high';

export type ReportStatus = 'submitted_locally' | 'filed_on_portal' | 'resolved';

export interface Report {
  id: string;
  category: ReportCategory;
  description: string;
  ai_draft: string | null;
  severity: ReportSeverity;
  department_suggested: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  photo_url: string | null;
  status: ReportStatus;
  grievance_ref_number: string | null;
  upvotes: number;
  session_id: string;
  created_at: string;
  updated_at: string;
  language?: string | null;
  photo_analysis?: unknown | null;
  duplicate_of?: string | null;
  ward?: string | null;
  assigned_to?: string | null;
  sla_due_at?: string | null;
  after_photo_url?: string | null;
}

export interface AIDraftRequest {
  description: string;
  category: ReportCategory;
  address?: string | null;
  language?: string;
}

export interface AIDraftResponse {
  draft: string;
  severity: ReportSeverity;
  department: string;
}

export const CATEGORY_LABELS: Record<ReportCategory, string> = {
  pothole: 'Pothole',
  broken_road: 'Broken Road',
  waterlogging: 'Waterlogging',
  signage: 'Road Signage',
  streetlight: 'Streetlight',
  other: 'Other',
};

export const CATEGORY_ICONS: Record<ReportCategory, string> = {
  pothole: 'CircleDashed',
  broken_road: 'Construction',
  waterlogging: 'Droplets',
  signage: 'Signpost',
  streetlight: 'Lightbulb',
  other: 'AlertTriangle',
};

export const SEVERITY_LABELS: Record<ReportSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export const STATUS_LABELS: Record<ReportStatus, string> = {
  submitted_locally: 'Submitted Locally',
  filed_on_portal: 'Filed on Portal',
  resolved: 'Resolved',
};

export const STATUS_COLORS: Record<ReportStatus, string> = {
  submitted_locally: 'bg-amber-100 text-amber-800 border-amber-200',
  filed_on_portal: 'bg-blue-100 text-blue-800 border-blue-200',
  resolved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

export const SEVERITY_COLORS: Record<ReportSeverity, string> = {
  low: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  high: 'bg-red-100 text-red-800 border-red-200',
};

export const CATEGORY_COLORS: Record<ReportCategory, string> = {
  pothole: '#ef4444',
  broken_road: '#f97316',
  waterlogging: '#3b82f6',
  signage: '#8b5cf6',
  streetlight: '#eab308',
  other: '#64748b',
};
