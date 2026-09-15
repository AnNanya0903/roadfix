import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUp,
  MapPin,
  Calendar,
  Sparkles,
  FileText,
  Building2,
  Zap,
  Copy,
  Check,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Edit3,
  Save,
  X,
  Bell,
  BellOff,
  Share2,
  Printer,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import MapView from '@/components/MapView';
import { LoadingSpinner, ErrorState } from '@/components/States';
import { CategoryBadge, SeverityBadge, StatusBadge } from '@/components/Badges';
import StatusTimeline from '@/components/StatusTimeline';
import PhotoVerification from '@/components/PhotoVerification';
import { supabase } from '@/lib/supabase';
import { getSessionId } from '@/lib/session';
import { formatDate } from '@/lib/format';
import { computeSLA } from '@/lib/sla';
import { getNotificationPrefs, saveNotificationPrefs } from '@/lib/preferences';
import { createReportEvent } from '@/lib/reportEvents';
import type { Report, ReportStatus } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/types';

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [upvoteLoading, setUpvoteLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingRef, setEditingRef] = useState(false);
  const [refNumber, setRefNumber] = useState('');
  const [savingRef, setSavingRef] = useState(false);
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [notifyPrefs, setNotifyPrefs] = useState<{
    email: boolean;
    sms: boolean;
    statusUpdates: boolean;
    contactEmail: string;
    contactPhone: string;
    reminderDaysBefore: number;
  }>({
    email: true,
    sms: false,
    statusUpdates: true,
    contactEmail: '',
    contactPhone: '',
    reminderDaysBefore: 3,
  });

  const sessionId = getSessionId();

  // Load notification preferences on mount
  useEffect(() => {
    const prefs = getNotificationPrefs();
    setNotifyPrefs(prefs);
  }, []);

  const loadReport = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('reports')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (queryError) {
        setError('Failed to load report.');
      } else if (!data) {
        setError('Report not found.');
      } else {
        setReport(data as Report);
        setRefNumber(data.grievance_ref_number || '');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setRetryKey((k) => k + 1);
    loadReport();
  }, [id, retryKey, loadReport]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: upvoteData } = await supabase
        .from('upvotes')
        .select('id')
        .eq('report_id', id)
        .eq('session_id', sessionId)
        .maybeSingle();
      setHasUpvoted(!!upvoteData);
    })();
  }, [id, sessionId]);

  const handleUpvote = useCallback(async () => {
    if (!report || upvoteLoading) return;
    setUpvoteLoading(true);

    const wasUpvoted = hasUpvoted;
    setHasUpvoted(!wasUpvoted);
    setReport({
      ...report,
      upvotes: report.upvotes + (wasUpvoted ? -1 : 1),
    });

    try {
      if (wasUpvoted) {
        await supabase
          .from('upvotes')
          .delete()
          .eq('report_id', report.id)
          .eq('session_id', sessionId);
      } else {
        await supabase
          .from('upvotes')
          .insert({ report_id: report.id, session_id: sessionId });
      }
    } catch {
      setHasUpvoted(wasUpvoted);
      setReport({
        ...report,
        upvotes: report.upvotes + (wasUpvoted ? 1 : -1),
      });
    } finally {
      setUpvoteLoading(false);
    }
  }, [report, hasUpvoted, upvoteLoading, sessionId]);

  const handleCopyDraft = async () => {
    if (!report?.ai_draft) return;
    await navigator.clipboard.writeText(report.ai_draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveRef = async () => {
    if (!report) return;
    setSavingRef(true);
    try {
      const newStatus: ReportStatus = refNumber.trim()
        ? 'filed_on_portal'
        : report.status === 'filed_on_portal'
        ? 'submitted_locally'
        : report.status;

      const { data, error: updateError } = await supabase
        .from('reports')
        .update({
          grievance_ref_number: refNumber.trim() || null,
          status: newStatus,
        })
        .eq('id', report.id)
        .select('*')
        .maybeSingle();

      if (updateError) throw updateError;
      if (data) {
        setReport(data as Report);
        if (newStatus !== report.status) {
          await createReportEvent(report.id, newStatus, `Grievance reference ${refNumber.trim() || 'removed'}`);
        }
      }
      setEditingRef(false);
    } catch {
      void 0;
    } finally {
      setSavingRef(false);
    }
  };

  const handleStatusChange = async (newStatus: ReportStatus) => {
    if (!report) return;
    setStatusUpdateLoading(true);
    const oldStatus = report.status;
    setReport({ ...report, status: newStatus });
    try {
      const { error: updateError } = await supabase
        .from('reports')
        .update({ status: newStatus })
        .eq('id', report.id);
      if (updateError) throw updateError;
      await createReportEvent(report.id, newStatus, `Status updated to ${STATUS_LABELS[newStatus]}`);
    } catch {
      setReport({ ...report, status: oldStatus });
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  const handleShare = async () => {
    if (!report) return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `RoadFix Report — ${report.category}`,
          text: report.description,
          url,
        });
      } catch {
        void 0;
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const sla = report ? computeSLA(report.created_at) : null;
  const photoUrl = report?.photo_url
    ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/report-photos/${report.photo_url}`
    : null;

  if (loading) return <LoadingSpinner label="Loading report…" />;
  if (error)
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center">
        <div className="text-center">
          <ErrorState message={error} />
          <button
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            <AlertCircle className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  if (!report)
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center">
        <ErrorState message="Report not found." />
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              title="Share"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              title="Print"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Photo */}
            {photoUrl && (
              <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
                <img
                  src={photoUrl}
                  alt={report.category}
                  className="w-full h-72 object-cover"
                />
              </div>
            )}

            {/* Details */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <CategoryBadge category={report.category} />
                <SeverityBadge severity={report.severity} />
                <StatusBadge status={report.status} />
              </div>

              <h2 className="text-xl font-bold text-slate-900 mb-3">
                Issue Description
              </h2>
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                {report.description}
              </p>

              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-slate-500">
                  <Calendar className="w-4 h-4" />
                  {formatDate(report.created_at)}
                </div>
                {report.address && (
                  <div className="flex items-center gap-2 text-slate-500">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{report.address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Status Timeline */}
            <StatusTimeline
              currentStatus={report.status}
              createdAt={report.created_at}
              reportId={report.id}
            />

            {/* SLA / Deadline */}
            {sla && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-teal-600" />
                  Response Deadline
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-lg font-semibold text-slate-900">
                    {sla.deadlineDate?.toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                      sla.status === 'ok'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : sla.status === 'warning'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    {sla.status === 'ok' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {sla.status === 'warning' && (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    {sla.status === 'expired' && (
                      <AlertCircle className="w-3.5 h-3.5" />
                    )}
                    {sla.label}
                  </span>
                </div>
              </div>
            )}

            {/* AI Draft */}
            {report.ai_draft && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-teal-600" />
                    AI-Generated Grievance Letter
                  </h2>
                  <button
                    onClick={handleCopyDraft}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-medium text-slate-600 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                </div>

                {report.department_suggested && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs font-medium text-blue-800">
                      <Building2 className="w-3.5 h-3.5" />
                      {report.department_suggested}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-medium text-amber-800">
                      <Zap className="w-3.5 h-3.5" />
                      {report.severity} severity
                    </span>
                  </div>
                )}

                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed max-h-96 overflow-y-auto">
                    {report.ai_draft}
                  </pre>
                </div>

                <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-2 text-sm text-blue-700">
                  <Send className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Copy this letter and file it on{' '}
                    <a
                      href="https://pgportal.gov.in/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline inline-flex items-center gap-0.5"
                    >
                      CPGRAMS
                      <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    or your state PWD portal.
                  </span>
                </div>
              </div>
            )}

            {/* Grievance Reference Number */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-slate-600" />
                Grievance Reference Number
              </h2>

              {!editingRef ? (
                <div>
                  {report.grievance_ref_number ? (
                    <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                      <div>
                        <p className="text-xs text-emerald-600 font-medium mb-1">
                          Filed on official portal
                        </p>
                        <p className="text-lg font-mono font-semibold text-emerald-900">
                          {report.grievance_ref_number}
                        </p>
                      </div>
                      <button
                        onClick={() => setEditingRef(true)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                        Edit
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                      <p className="text-sm text-amber-700 mb-3">
                        Filed this complaint on CPGRAMS or your state portal? Add the
                        reference number here to track its progress.
                      </p>
                      <button
                        onClick={() => setEditingRef(true)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                        Add Reference Number
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={refNumber}
                    onChange={(e) => setRefNumber(e.target.value)}
                    placeholder="e.g. PMOPG/E/2024/0123456"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveRef}
                      disabled={savingRef}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
                    >
                      {savingRef ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingRef(false);
                        setRefNumber(report.grievance_ref_number || '');
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Status Update */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Update Status</h2>
              <p className="text-sm text-slate-500 mb-3">
                Help the community by keeping the status up to date.
              </p>
              <div className="flex flex-wrap gap-2">
                {(['submitted_locally', 'filed_on_portal', 'resolved'] as ReportStatus[]).map(
                  (s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      disabled={statusUpdateLoading || report.status === s}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                        report.status === s
                          ? 'bg-teal-50 border-teal-300 text-teal-700 cursor-default'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      } disabled:opacity-60`}
                    >
                      {s === 'resolved' && <CheckCircle2 className="w-4 h-4" />}
                      {s === 'filed_on_portal' && <Send className="w-4 h-4" />}
                      {s === 'submitted_locally' && <FileText className="w-4 h-4" />}
                      {STATUS_LABELS[s]}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Photo Verification */}
            <PhotoVerification
              beforePhotoUrl={photoUrl}
              categoryName={report.category}
              reportId={report.id}
            />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Upvote Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
              <button
                onClick={handleUpvote}
                disabled={upvoteLoading}
                className={`w-full flex flex-col items-center gap-2 py-6 rounded-xl border-2 transition-all ${
                  hasUpvoted
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-slate-200 hover:border-teal-400 hover:bg-teal-50/30'
                } disabled:opacity-50`}
              >
                <ArrowUp
                  className={`w-8 h-8 ${
                    hasUpvoted
                      ? 'text-teal-600 fill-teal-600'
                      : 'text-slate-400'
                  }`}
                />
                <span className="text-2xl font-bold text-slate-900">
                  {report.upvotes}
                </span>
                <span className="text-sm text-slate-500">
                  {hasUpvoted ? 'You upvoted this' : 'Upvote this issue'}
                </span>
              </button>
              <p className="mt-3 text-xs text-slate-400">
                Upvotes increase visibility and priority.
              </p>
            </div>

            {/* Notification Preferences */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
                <Bell className="w-4 h-4 text-teal-600" />
                Notification Preferences
              </h3>
              <div className="space-y-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-slate-700 flex items-center gap-2">
                    <Send className="w-3.5 h-3.5 text-slate-400" />
                    Status updates
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setNotifyPrefs((p) => {
                        const updated = { ...p, statusUpdates: !p.statusUpdates };
                        saveNotificationPrefs(updated);
                        return updated;
                      })
                    }
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      notifyPrefs.statusUpdates ? 'bg-teal-600' : 'bg-slate-300'
                    }`}
                    aria-label="Toggle status updates"
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        notifyPrefs.statusUpdates ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-slate-700 flex items-center gap-2">
                    <Bell className="w-3.5 h-3.5 text-slate-400" />
                    Email notifications
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setNotifyPrefs((p) => {
                        const updated = { ...p, email: !p.email };
                        saveNotificationPrefs(updated);
                        return updated;
                      })
                    }
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      notifyPrefs.email ? 'bg-teal-600' : 'bg-slate-300'
                    }`}
                    aria-label="Toggle email notifications"
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        notifyPrefs.email ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-slate-700 flex items-center gap-2">
                    <BellOff className="w-3.5 h-3.5 text-slate-400" />
                    SMS reminders
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setNotifyPrefs((p) => {
                        const updated = { ...p, sms: !p.sms };
                        saveNotificationPrefs(updated);
                        return updated;
                      })
                    }
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      notifyPrefs.sms ? 'bg-teal-600' : 'bg-slate-300'
                    }`}
                    aria-label="Toggle SMS reminders"
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        notifyPrefs.sms ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </label>
                {notifyPrefs.email && (
                  <div className="pt-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      value={notifyPrefs.contactEmail}
                      onChange={(e) =>
                        setNotifyPrefs((p) => {
                          const updated = { ...p, contactEmail: e.target.value };
                          saveNotificationPrefs(updated);
                          return updated;
                        })
                      }
                      placeholder="your@email.com"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all"
                    />
                  </div>
                )}
                {notifyPrefs.sms && (
                  <div className="pt-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={notifyPrefs.contactPhone}
                      onChange={(e) =>
                        setNotifyPrefs((p) => {
                          const updated = { ...p, contactPhone: e.target.value };
                          saveNotificationPrefs(updated);
                          return updated;
                        })
                      }
                      placeholder="+91 98765 43210"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all"
                    />
                  </div>
                )}
                <div className="pt-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Reminder days before deadline
                  </label>
                  <select
                    value={notifyPrefs.reminderDaysBefore}
                    onChange={(e) =>
                      setNotifyPrefs((p) => {
                        const updated = { ...p, reminderDaysBefore: Number(e.target.value) };
                        saveNotificationPrefs(updated);
                        return updated;
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all"
                  >
                    <option value={1}>1 day</option>
                    <option value={2}>2 days</option>
                    <option value={3}>3 days</option>
                    <option value={5}>5 days</option>
                    <option value={7}>1 week</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Location Map */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-teal-600" />
                Location
              </h3>
              <div className="h-48 rounded-xl overflow-hidden border border-slate-200">
                <MapView
                  reports={[report]}
                  center={[report.latitude, report.longitude]}
                  zoom={15}
                  className="h-full"
                />
              </div>
              <p className="mt-2 text-xs text-slate-500 font-mono">
                {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
              </p>
            </div>

            {/* Back to Dashboard */}
            <Link
              to="/dashboard"
              className="block w-full text-center px-4 py-3 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              View All Reports
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
