import { supabase } from './supabase';

export type ReportEventStatus =
  | 'submitted_locally'
  | 'filed_on_portal'
  | 'resolved';

export interface ReportEvent {
  id: string;
  report_id: string;
  status: ReportEventStatus;
  note: string | null;
  created_at: string;
  created_by: string | null;
}

export async function fetchReportEvents(
  reportId: string
): Promise<ReportEvent[]> {
  try {
    const { data, error } = await supabase
      .from('report_events')
      .select('*')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true });

    if (error) {
      return [];
    }
    return (data as ReportEvent[]) || [];
  } catch {
    return [];
  }
}

export async function createReportEvent(
  reportId: string,
  status: ReportEventStatus,
  note?: string
): Promise<ReportEvent | null> {
  try {
    const sessionId = localStorage.getItem('rcp_session_id') || '';
    const { data, error } = await supabase
      .from('report_events')
      .insert({
        report_id: reportId,
        status,
        note: note || null,
        created_by: sessionId || null,
      })
      .select('*')
      .maybeSingle();

    if (error) {
      return null;
    }
    return data as ReportEvent;
  } catch {
    return null;
  }
}