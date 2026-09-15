import { useEffect, useState } from 'react';
import { Check, Circle, Clock, FileText, Send } from 'lucide-react';
import type { ReportStatus } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/types';
import type { ReportEvent } from '@/lib/reportEvents';
import { fetchReportEvents } from '@/lib/reportEvents';

const STAGES: ReportStatus[] = ['submitted_locally', 'filed_on_portal', 'resolved'];

const STAGE_ICONS: Record<ReportStatus, React.ElementType> = {
  submitted_locally: FileText,
  filed_on_portal: Send,
  resolved: Check,
};

interface StatusTimelineProps {
  currentStatus: ReportStatus;
  createdAt: string;
  reportId?: string;
  events?: ReportEvent[];
}

export default function StatusTimeline({
  currentStatus,
  createdAt,
  reportId,
  events: initialEvents,
}: StatusTimelineProps) {
  const [events, setEvents] = useState<ReportEvent[]>(initialEvents || []);
  const [loading, setLoading] = useState(!initialEvents && !!reportId);
  const [fallbackMode, setFallbackMode] = useState(false);

  useEffect(() => {
    if (initialEvents) {
      setEvents(initialEvents);
      setLoading(false);
      return;
    }
    if (!reportId) {
      setFallbackMode(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchReportEvents(reportId).then((fetched) => {
      if (!cancelled) {
        if (fetched.length === 0) {
          setFallbackMode(true);
        }
        setEvents(fetched);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [reportId, initialEvents]);

  const currentIndex = STAGES.indexOf(currentStatus);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-5 flex items-center gap-2">
          <Clock className="w-4 h-4 text-teal-600" />
          Status Timeline
        </h3>
        <div className="flex items-center justify-center py-8 text-slate-400 text-sm">
          <Clock className="w-5 h-5 animate-spin mr-2" />
          Loading timeline…
        </div>
      </div>
    );
  }

  const getEventForStage = (stage: ReportStatus) =>
    events.find((e) => e.status === stage);

  const hasRealEvents = events.length > 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <h3 className="text-sm font-semibold text-slate-900 mb-5 flex items-center gap-2">
        <Clock className="w-4 h-4 text-teal-600" />
        Status Timeline
      </h3>
      <div className="relative">
        <div className="absolute top-[19px] left-[28px] right-[28px] h-0.5 bg-slate-200" />
        <div
          className="absolute top-[19px] left-[28px] h-0.5 bg-teal-500 transition-all duration-500"
          style={{
            width:
              currentIndex === 0
                ? '0%'
                : currentIndex === 1
                ? 'calc(50% - 28px)'
                : 'calc(100% - 56px)',
          }}
        />
        <div className="relative flex justify-between">
          {STAGES.map((stage, index) => {
            const event = getEventForStage(stage);
            const isCurrent = index === currentIndex;
            const hasEvent = !!event;

            const IconComponent = STAGE_ICONS[stage];

            return (
              <div key={stage} className="flex flex-col items-center gap-2 w-1/3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    hasEvent
                      ? 'bg-teal-500 border-teal-500 text-white'
                      : isCurrent
                      ? 'bg-teal-50 border-teal-500 text-teal-600'
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  {hasEvent ? (
                    <IconComponent className="w-5 h-5" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </div>
                <span
                  className={`text-xs font-medium text-center leading-tight ${
                    hasEvent
                      ? 'text-teal-700'
                      : isCurrent
                      ? 'text-teal-700'
                      : 'text-slate-400'
                  }`}
                >
                  {STATUS_LABELS[stage]}
                </span>
                {hasEvent && (
                  <div className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium border border-teal-200 whitespace-nowrap">
                    {new Date(event.created_at).toLocaleDateString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                )}
                {isCurrent && !hasEvent && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium border border-teal-200">
                    Current
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {hasRealEvents && events.length > 0 && (
        <div className="mt-4 space-y-2">
          {events
            .slice()
            .reverse()
            .map((event) => {
              const IconComponent = STAGE_ICONS[event.status];
              return (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                    <IconComponent
                      className="w-4 h-4 text-teal-600"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {STATUS_LABELS[event.status]}
                    </p>
                    {event.note && (
                      <p className="text-sm text-slate-600 mt-1">{event.note}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(event.created_at).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      )}
      {fallbackMode && !hasRealEvents && (
        <p className="mt-4 text-xs text-slate-400 text-center">
          Filed on{' '}
          {new Date(createdAt).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </p>
      )}
    </div>
  );
}