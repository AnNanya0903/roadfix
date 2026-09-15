import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Filter,
  LayoutGrid,
  Map as MapIcon,
  ArrowUp,
  Search,
  X,
  CircleDashed,
  Construction,
  Droplets,
  Signpost,
  Lightbulb,
  AlertTriangle,
  BarChart2,
  Shield,
  Flame,
  Users,
  MapPin,
  Clock,
  AlertCircle,
} from 'lucide-react';
import MapView from '@/components/MapView';
import ReportCard from '@/components/ReportCard';
import { LoadingSpinner, EmptyState } from '@/components/States';
import { supabase } from '@/lib/supabase';
import { getSessionId } from '@/lib/session';
import type { Report, ReportCategory, ReportStatus } from '@/lib/types';
import { CATEGORY_LABELS, STATUS_LABELS, CATEGORY_COLORS } from '@/lib/types';
import { calculateSafetyScore, getWardMetrics, getHeatmapPoints, getSlaSummary, type WardMetric, type HeatmapPoint, type AnalyticsReport } from '@/lib/analytics';

const CATEGORIES: ReportCategory[] = [
  'pothole',
  'broken_road',
  'waterlogging',
  'signage',
  'streetlight',
  'other',
];

const STATUSES: ReportStatus[] = [
  'submitted_locally',
  'filed_on_portal',
  'resolved',
];

const CATEGORY_ICON_MAP: Record<ReportCategory, typeof CircleDashed> = {
  pothole: CircleDashed,
  broken_road: Construction,
  waterlogging: Droplets,
  signage: Signpost,
  streetlight: Lightbulb,
  other: AlertTriangle,
};

export default function DashboardPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'list' | 'map' | 'heatmap' | 'analytics'>('split');
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<ReportStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
  const [upvoteLoadingIds, setUpvoteLoadingIds] = useState<Set<string>>(new Set());

  const sessionId = getSessionId();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error: queryError } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });
      if (queryError) {
        setError('Failed to load reports. Please refresh the page.');
        setLoading(false);
        return;
      }
      setReports((data || []) as Report[]);

      // Load user's upvotes
      const { data: upvotesData } = await supabase
        .from('upvotes')
        .select('report_id')
        .eq('session_id', sessionId);
      if (upvotesData) {
        setUpvotedIds(new Set(upvotesData.map((u: { report_id: string }) => u.report_id)));
      }
      setLoading(false);
    })();
  }, [sessionId]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (selectedCategory && r.category !== selectedCategory) return false;
      if (selectedStatus && r.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDesc = r.description.toLowerCase().includes(q);
        const matchesAddress = r.address?.toLowerCase().includes(q);
        if (!matchesDesc && !matchesAddress) return false;
      }
      return true;
    });
  }, [reports, selectedCategory, selectedStatus, searchQuery]);

  const analyticsReports = useMemo((): AnalyticsReport[] => {
    return filteredReports.map((r) => ({
      ...r,
      ward: r.ward ?? null,
      assigned_to: r.assigned_to ?? null,
      sla_due_at: r.sla_due_at ?? null,
    }));
  }, [filteredReports]);

  const wardMetrics = useMemo((): WardMetric[] => {
    return getWardMetrics(analyticsReports);
  }, [analyticsReports]);

  const heatmapPoints = useMemo((): HeatmapPoint[] => {
    return getHeatmapPoints(analyticsReports);
  }, [analyticsReports]);

  const slaSummary = useMemo(() => {
    return getSlaSummary(analyticsReports);
  }, [analyticsReports]);

  const overallSafetyScore = useMemo(() => {
    return calculateSafetyScore(analyticsReports);
  }, [analyticsReports]);

  const totalUpvotes = useMemo(() => {
    return filteredReports.reduce((sum, r) => sum + r.upvotes, 0);
  }, [filteredReports]);

  const openReports = useMemo(() => {
    return filteredReports.filter((r) => r.status !== 'resolved').length;
  }, [filteredReports]);

  const highSeverityReports = useMemo(() => {
    return filteredReports.filter((r) => r.severity === 'high').length;
  }, [filteredReports]);

  const handleUpvote = useCallback(
    async (report: Report) => {
      if (upvoteLoadingIds.has(report.id)) return;
      setUpvoteLoadingIds((prev) => new Set(prev).add(report.id));

      const hasUpvoted = upvotedIds.has(report.id);

      // Optimistic update
      setReports((prev) =>
        prev.map((r) =>
          r.id === report.id
            ? { ...r, upvotes: r.upvotes + (hasUpvoted ? -1 : 1) }
            : r
        )
      );

      try {
        if (hasUpvoted) {
          await supabase
            .from('upvotes')
            .delete()
            .eq('report_id', report.id)
            .eq('session_id', sessionId);
          setUpvotedIds((prev) => {
            const next = new Set(prev);
            next.delete(report.id);
            return next;
          });
        } else {
          await supabase
            .from('upvotes')
            .insert({ report_id: report.id, session_id: sessionId });
          setUpvotedIds((prev) => new Set(prev).add(report.id));
        }
      } catch {
        // Revert on error
        setReports((prev) =>
          prev.map((r) =>
            r.id === report.id
              ? { ...r, upvotes: r.upvotes + (hasUpvoted ? 1 : -1) }
              : r
          )
        );
      } finally {
        setUpvoteLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(report.id);
          return next;
        });
      }
    },
    [upvotedIds, upvoteLoadingIds, sessionId]
  );

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedStatus(null);
    setSearchQuery('');
  };

  const hasActiveFilters = selectedCategory || selectedStatus || searchQuery;

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Road Issues Dashboard</h1>
          <p className="mt-2 text-slate-600">
            {reports.length} {reports.length === 1 ? 'report' : 'reports'} from citizens across India.
          </p>
        </div>

        {/* Controls */}
        <div className="mb-6 space-y-4">
          {/* Search + View Toggle */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by description or address…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all"
              />
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white border border-slate-200">
              {(['split', 'list', 'map', 'heatmap', 'analytics'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    viewMode === mode
                      ? 'bg-teal-50 text-teal-700'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  {mode === 'split' && <LayoutGrid className="w-4 h-4" />}
                  {mode === 'list' && <LayoutGrid className="w-4 h-4" />}
                  {mode === 'map' && <MapIcon className="w-4 h-4" />}
                  {mode === 'heatmap' && <Flame className="w-4 h-4" />}
                  {mode === 'analytics' && <BarChart2 className="w-4 h-4" />}
                  <span className="capitalize">{mode}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-sm font-medium text-slate-600 mr-1">
              <Filter className="w-4 h-4" />
              Filter:
            </span>
            {CATEGORIES.map((cat) => {
              const Icon = CATEGORY_ICON_MAP[cat];
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() =>
                    setSelectedCategory(isActive ? null : cat)
                  }
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    isActive
                      ? 'bg-teal-50 border-teal-300 text-teal-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {CATEGORY_LABELS[cat]}
                </button>
              );
            })}
            <span className="w-px h-5 bg-slate-200 mx-1" />
            {STATUSES.map((status) => {
              const isActive = selectedStatus === status;
              return (
                <button
                  key={status}
                  onClick={() =>
                    setSelectedStatus(isActive ? null : status)
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    isActive
                      ? 'bg-teal-50 border-teal-300 text-teal-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {STATUS_LABELS[status]}
                </button>
              );
            })}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors ml-1"
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Analytics Summary Cards */}
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Reports</p>
                <p className="text-xl font-bold text-slate-900">{filteredReports.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Open Issues</p>
                <p className="text-xl font-bold text-slate-900">{openReports}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <Flame className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">High Severity</p>
                <p className="text-xl font-bold text-slate-900">{highSeverityReports}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Shield className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Safety Score</p>
                <p className="text-xl font-bold text-slate-900">{overallSafetyScore}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <ArrowUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Upvotes</p>
                <p className="text-xl font-bold text-slate-900">{totalUpvotes}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Wards Affected</p>
                <p className="text-xl font-bold text-slate-900">{wardMetrics.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* SLA Summary Bar */}
        {slaSummary.dueSoon > 0 || slaSummary.overdue > 0 ? (
          <div className="mb-6 rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 bg-amber-50 border-amber-200">
            <div className="flex items-center gap-3 text-sm">
              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span className="font-medium text-amber-800">SLA Tracker:</span>
              {slaSummary.overdue > 0 && (
                <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                  {slaSummary.overdue} overdue
                </span>
              )}
              {slaSummary.dueSoon > 0 && (
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                  {slaSummary.dueSoon} due soon
                </span>
              )}
              {slaSummary.onTrack > 0 && (
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
                  {slaSummary.onTrack} on track
                </span>
              )}
            </div>
          </div>
        ) : null}

        {/* Content */}
        {loading ? (
          <LoadingSpinner label="Loading reports…" />
        ) : error ? (
          <EmptyState
            icon={<AlertTriangle className="w-8 h-8" />}
            title="Couldn't load reports"
            description={error}
          />
        ) : filteredReports.length === 0 ? (
          <EmptyState
            icon={<CircleDashed className="w-8 h-8" />}
            title={hasActiveFilters ? 'No matching reports' : 'No reports yet'}
            description={
              hasActiveFilters
                ? 'Try adjusting your filters or search query.'
                : 'Be the first to report a road issue in your area.'
            }
          />
        ) : viewMode === 'heatmap' ? (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden h-[600px]">
            <MapView
              reports={filteredReports}
              onMarkerClick={(r) => setSelectedReportId(r.id)}
              selectedId={selectedReportId}
              className="h-full"
              heatmapPoints={heatmapPoints}
              showHeatmap={true}
            />
          </div>
        ) : viewMode === 'analytics' ? (
          <div className="space-y-6">
            {/* Ward Metrics Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-teal-600" />
                  Ward-Level Metrics
                </h2>
                <span className="text-sm text-slate-500">{wardMetrics.length} wards</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Ward</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Total</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Open</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Resolved</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">High Sev.</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Upvotes</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Safety Score</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Density</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {wardMetrics.map((ward) => (
                      <tr key={ward.ward} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{ward.ward}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{ward.total}</td>
                        <td className="px-4 py-3 text-sm text-amber-600 font-medium">{ward.open}</td>
                        <td className="px-4 py-3 text-sm text-emerald-600">{ward.resolved}</td>
                        <td className="px-4 py-3 text-sm text-red-600 font-medium">{ward.highSeverity}</td>
                        <td className="px-4 py-3 text-sm text-purple-600">{ward.upvotes}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 max-w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${ward.safetyScore}%`,
                                  backgroundColor:
                                    ward.safetyScore >= 70
                                      ? '#10b981'
                                      : ward.safetyScore >= 40
                                      ? '#f59e0b'
                                      : '#ef4444',
                                }}
                              />
                            </div>
                            <span className="text-sm font-medium text-slate-900 w-12">{ward.safetyScore}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 max-w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-blue-500 transition-all"
                                style={{ width: `${ward.density}%` }}
                              />
                            </div>
                            <span className="text-sm text-slate-600 w-16">{ward.density}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-teal-600" />
                  Category Breakdown
                </h2>
              </div>
              <div className="p-6 space-y-4">
                {CATEGORIES.map((cat) => {
                  const catReports = filteredReports.filter((r) => r.category === cat);
                  const catOpen = catReports.filter((r) => r.status !== 'resolved').length;
                  const catResolved = catReports.filter((r) => r.status === 'resolved').length;
                  const catHigh = catReports.filter((r) => r.severity === 'high').length;
                  const color = CATEGORY_COLORS[cat];
                  const CatIcon = CATEGORY_ICON_MAP[cat];
                  return catReports.length > 0 ? (
                    <div key={cat} className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color }}>
                        <CatIcon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-900">{CATEGORY_LABELS[cat]}</span>
                          <span className="text-slate-500">{catReports.length} reports</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(catReports.length / filteredReports.length) * 100}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-slate-500">
                          <span>Open: {catOpen}</span>
                          <span>Resolved: {catResolved}</span>
                          <span>High: {catHigh}</span>
                        </div>
                      </div>
                    </div>
                  ) : null;
                })}
              </div>
            </div>

            {/* SLA Details */}
            {slaSummary.dueSoon > 0 || slaSummary.overdue > 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-600" />
                    SLA Details
                  </h2>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-red-50 border border-red-100">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <span className="font-semibold text-red-800">Overdue</span>
                    </div>
                    <p className="text-3xl font-bold text-red-700">{slaSummary.overdue}</p>
                    <p className="text-sm text-red-600">Reports past SLA deadline</p>
                  </div>
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-5 h-5 text-amber-600" />
                      <span className="font-semibold text-amber-800">Due Soon</span>
                    </div>
                    <p className="text-3xl font-bold text-amber-700">{slaSummary.dueSoon}</p>
                    <p className="text-sm text-amber-600">Reports due within 5 days</p>
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-5 h-5 text-emerald-600" />
                      <span className="font-semibold text-emerald-800">On Track</span>
                    </div>
                    <p className="text-3xl font-bold text-emerald-700">{slaSummary.onTrack}</p>
                    <p className="text-sm text-emerald-600">Reports within SLA</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[700px]">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden h-full">
              <MapView
                reports={filteredReports}
                onMarkerClick={(r) => setSelectedReportId(r.id)}
                selectedId={selectedReportId}
                className="h-full"
              />
            </div>
            <div className="h-full overflow-y-auto space-y-4 pr-1">
              {filteredReports.map((report) => (
                <div
                  key={report.id}
                  className={
                    report.id === selectedReportId
                      ? 'ring-2 ring-teal-400 rounded-2xl'
                      : ''
                  }
                >
                  <ReportCard
                    report={report}
                    onUpvote={handleUpvote}
                    hasUpvoted={upvotedIds.has(report.id)}
                    upvoteLoading={upvoteLoadingIds.has(report.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upvote count summary when viewing map */}
        {viewMode === 'map' && filteredReports.length > 0 && (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <ArrowUp className="w-4 h-4" />
            Click a marker to see report details. {filteredReports.length} reports shown.
          </div>
        )}
      </div>
    </div>
  );
}
