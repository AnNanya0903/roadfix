import { Link } from 'react-router-dom';
import { ArrowUp, MapPin, MessageSquareText, FileText } from 'lucide-react';
import type { Report } from '@/lib/types';
import { CATEGORY_LABELS } from '@/lib/types';
import { CategoryBadge, SeverityBadge, StatusBadge } from './Badges';
import { timeAgo } from '@/lib/format';
import { getCategoryIcon } from '@/lib/icons';

interface ReportCardProps {
  report: Report;
  onUpvote?: (report: Report) => void;
  hasUpvoted?: boolean;
  upvoteLoading?: boolean;
}

export default function ReportCard({
  report,
  onUpvote,
  hasUpvoted,
  upvoteLoading,
}: ReportCardProps) {
  const Icon = getCategoryIcon(report.category);
  const photoUrl = report.photo_url
    ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/report-photos/${report.photo_url}`
    : null;

  return (
    <Link
      to={`/report/${report.id}`}
      className="group block bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-teal-300 hover:shadow-lg transition-all duration-300"
    >
      {photoUrl && (
        <div className="relative h-44 bg-slate-100 overflow-hidden">
          <img
            src={photoUrl}
            alt={CATEGORY_LABELS[report.category]}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute top-3 left-3">
            <CategoryBadge category={report.category} />
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
          {!photoUrl && (
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
              <Icon className="w-5 h-5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {!photoUrl && <CategoryBadge category={report.category} />}
              <SeverityBadge severity={report.severity} />
            </div>
            <p className="text-sm text-slate-700 line-clamp-2 leading-relaxed">
              {report.description}
            </p>
          </div>
        </div>

        {report.address && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{report.address}</span>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <StatusBadge status={report.status} />
            <span className="text-xs text-slate-400">{timeAgo(report.created_at)}</span>
          </div>
          <div className="flex items-center gap-3">
            {report.ai_draft && (
              <span className="flex items-center gap-1 text-xs text-slate-400" title="AI draft available">
                <FileText className="w-3.5 h-3.5" />
              </span>
            )}
            {report.grievance_ref_number && (
              <span className="flex items-center gap-1 text-xs text-slate-400" title="Filed on portal">
                <MessageSquareText className="w-3.5 h-3.5" />
              </span>
            )}
            {onUpvote && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onUpvote(report);
                }}
                disabled={upvoteLoading}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium transition-all ${
                  hasUpvoted
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                } disabled:opacity-50`}
              >
                <ArrowUp
                  className={`w-4 h-4 ${hasUpvoted ? 'fill-teal-600 text-teal-600' : ''}`}
                />
                {report.upvotes}
              </button>
            )}
            {!onUpvote && (
              <span className="flex items-center gap-1 text-sm text-slate-500">
                <ArrowUp className="w-4 h-4" />
                {report.upvotes}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
