import type { ReportCategory, ReportSeverity, ReportStatus } from '@/lib/types';
import {
  CATEGORY_LABELS,
  SEVERITY_LABELS,
  SEVERITY_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
} from '@/lib/types';

export function CategoryBadge({ category }: { category: ReportCategory }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
      {CATEGORY_LABELS[category]}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: ReportSeverity }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${SEVERITY_COLORS[severity]}`}
    >
      {SEVERITY_LABELS[severity]} severity
    </span>
  );
}

export function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
