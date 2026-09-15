import type { Report } from './types';

export interface AnalyticsReport extends Report {
  ward?: string | null;
  assigned_to?: string | null;
  sla_due_at?: string | null;
}

export interface WardMetric {
  ward: string;
  total: number;
  open: number;
  resolved: number;
  highSeverity: number;
  upvotes: number;
  safetyScore: number;
  density: number;
  center: [number, number];
}

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  intensity: number;
  category: Report['category'];
  severity: Report['severity'];
}

const WARD_GRID_SIZE = 0.25;

function normalizeWard(report: AnalyticsReport): string {
  if (report.ward?.trim()) return report.ward.trim();
  const latBand = Math.floor((report.latitude + 90) / WARD_GRID_SIZE);
  const lngBand = Math.floor((report.longitude + 180) / WARD_GRID_SIZE);
  return `Ward ${latBand}-${lngBand}`;
}

function severityWeight(severity: Report['severity']): number {
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}

function isOpen(report: AnalyticsReport): boolean {
  return report.status !== 'resolved';
}

export function calculateSafetyScore(reports: AnalyticsReport[]): number {
  if (!reports.length) return 100;

  const issuePressure = reports.reduce((total, report) => {
    const openMultiplier = isOpen(report) ? 1 : 0.25;
    return total + severityWeight(report.severity) * openMultiplier;
  }, 0);
  const averagePressure = issuePressure / reports.length;
  const unresolvedRatio = reports.filter(isOpen).length / reports.length;
  const highSeverityRatio = reports.filter((report) => report.severity === 'high').length / reports.length;
  const score = 100 - averagePressure * 10 - unresolvedRatio * 15 - highSeverityRatio * 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getWardMetrics(reports: AnalyticsReport[]): WardMetric[] {
  const grouped = new Map<string, AnalyticsReport[]>();

  reports.forEach((report) => {
    const ward = normalizeWard(report);
    grouped.set(ward, [...(grouped.get(ward) || []), report]);
  });

  return [...grouped.entries()]
    .map(([ward, wardReports]) => {
      const open = wardReports.filter(isOpen);
      const highSeverity = wardReports.filter((report) => report.severity === 'high').length;
      const latitude = wardReports.reduce((sum, report) => sum + report.latitude, 0) / wardReports.length;
      const longitude = wardReports.reduce((sum, report) => sum + report.longitude, 0) / wardReports.length;
      const maxDensity = Math.max(1, ...[...grouped.values()].map((items) => items.length));

      const center: [number, number] = [latitude, longitude];

      return {
        ward,
        total: wardReports.length,
        open: open.length,
        resolved: wardReports.length - open.length,
        highSeverity,
        upvotes: wardReports.reduce((sum, report) => sum + report.upvotes, 0),
        safetyScore: calculateSafetyScore(wardReports),
        density: Math.round((wardReports.length / maxDensity) * 100),
        center,
      };
    })
    .sort((a, b) => b.total - a.total || a.safetyScore - b.safetyScore);
}

export function getHeatmapPoints(reports: AnalyticsReport[]): HeatmapPoint[] {
  return reports.map((report) => ({
    latitude: report.latitude,
    longitude: report.longitude,
    intensity: severityWeight(report.severity) * (isOpen(report) ? 1 : 0.35) * (1 + report.upvotes * 0.08),
    category: report.category,
    severity: report.severity,
  }));
}

export function getSlaSummary(reports: AnalyticsReport[], now = new Date()): {
  dueSoon: number;
  overdue: number;
  onTrack: number;
} {
  const summary = { dueSoon: 0, overdue: 0, onTrack: 0 };

  reports.forEach((report) => {
    if (report.status === 'resolved') return;
    const dueAt = report.sla_due_at ? new Date(report.sla_due_at) : new Date(new Date(report.created_at).getTime() + 30 * 86400000);
    const daysRemaining = (dueAt.getTime() - now.getTime()) / 86400000;

    if (daysRemaining < 0) summary.overdue += 1;
    else if (daysRemaining <= 5) summary.dueSoon += 1;
    else summary.onTrack += 1;
  });

  return summary;
}
