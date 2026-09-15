import { Link } from 'react-router-dom';
import {
  Route,
  Camera,
  Sparkles,
  Send,
  Map,
  ShieldCheck,
  Users,
  TrendingUp,
  ArrowRight,
  CircleDashed,
  Construction,
  Droplets,
  Signpost,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  ScanSearch,
  CopyCheck,
  Languages,
  MapPinCheck,
  Bell,
  Images,
  ChartNoAxesCombined,
  Gauge,
  Share2,
  UserRoundCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Report } from '@/lib/types';
import { CATEGORY_LABELS } from '@/lib/types';
import ReportCard from '@/components/ReportCard';

export default function LandingPage() {
  const [stats, setStats] = useState({
    total: 0,
    resolved: 0,
    filed: 0,
  });
  const [recentReports, setRecentReports] = useState<Report[]>([]);

  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true });
      const { count: resolvedCount } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'resolved');
      const { count: filedCount } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'filed_on_portal');
      setStats({
        total: count || 0,
        resolved: resolvedCount || 0,
        filed: filedCount || 0,
      });

      const { data } = await supabase
        .from('reports')
        .select('*')
        .order('upvotes', { ascending: false })
        .limit(3);
      if (data) setRecentReports(data as Report[]);
    })();
  }, []);

  const steps = [
    {
      icon: Camera,
      title: 'Capture the Issue',
      description:
        'Upload a photo or describe the problem in your preferred language. RoadFix is designed to use AI photo recognition to identify the issue and check for similar nearby reports.',
      color: 'bg-blue-500',
    },
    {
      icon: Sparkles,
      title: 'AI Drafts Your Letter',
      description:
        'Our AI turns the details into a formal grievance letter, classifies severity, suggests the right authority, and organizes the location and address information.',
      color: 'bg-teal-500',
    },
    {
      icon: Send,
      title: 'Route to the Right Authority',
      description:
        'RoadFix is designed to connect each report with the responsible authority and keep SLA deadlines visible from submission through resolution.',
      color: 'bg-amber-500',
    },
    {
      icon: CheckCircle2,
      title: 'Track, Verify & Share',
      description:
        "Follow the status timeline, stay aware of reminders, compare before and after photos, and share a PDF-ready report as the issue moves toward resolution.",
      color: 'bg-emerald-500',
    },
  ];

  const features = [
    {
      icon: ScanSearch,
      title: 'AI Photo Recognition',
      description:
        'RoadFix is designed to use AI photo recognition to help identify the road issue, suggest a category, and capture useful context before submission.',
    },
    {
      icon: CopyCheck,
      title: 'Duplicate Detection',
      description:
        'RoadFix can compare a new report with nearby submissions to surface possible duplicates before a complaint is filed.',
    },
    {
      icon: Languages,
      title: 'Multilingual & Voice Reporting',
      description:
        'RoadFix is designed to support text or voice reporting in supported languages, with the details prepared for a clear grievance draft.',
    },
    {
      icon: MapPinCheck,
      title: 'Automatic Location & Address Extraction',
      description:
        'RoadFix is designed to turn a pin, map search, or spoken location into coordinates and a usable address or landmark.',
    },
    {
      icon: Bell,
      title: 'Status Timeline & Reminders',
      description:
        'Follow each report through a clear status timeline, with reminder-ready checkpoints for follow-up and resolution.',
    },
    {
      icon: Images,
      title: 'Before/After Verification',
      description:
        'Keep before and after photos together so citizens and authorities can verify whether the reported issue has been fixed.',
    },
    {
      icon: ChartNoAxesCombined,
      title: 'Ward Heatmaps',
      description:
        'RoadFix is designed to turn report locations into ward-level heatmaps that highlight clusters and priority areas.',
    },
    {
      icon: Gauge,
      title: 'Safety Scores',
      description:
        'Ward safety scores can summarize open issues, severity, and resolution progress in one easy-to-understand signal.',
    },
    {
      icon: Share2,
      title: 'Shareable & PDF-Ready Reports',
      description:
        'Share a report link or print a PDF-ready summary for neighbours, community groups, and authorities.',
    },
    {
      icon: UserRoundCheck,
      title: 'Authority Assignment & SLA Tracking',
      description:
        'RoadFix is designed to route reports to the responsible authority and keep SLA deadlines visible throughout the case.',
    },
    {
      icon: Sparkles,
      title: 'AI-Powered Grievance Drafting',
      description:
        'A two-step AI pipeline classifies your complaint by severity and department, then writes a formal letter ready for submission.',
    },
    {
      icon: Map,
      title: 'Live Interactive Map',
      description:
        'See every reported issue on a live map. Filter by category, severity, or status to find problems near you.',
    },
    {
      icon: Users,
      title: 'Community Upvoting',
      description:
        'Upvote reports that affect you. Higher upvoted issues get more visibility and priority attention.',
    },
    {
      icon: ShieldCheck,
      title: 'Track to Resolution',
      description:
        'File on official portals like CPGRAMS, paste your reference number, and track progress until the road is fixed.',
    },
    {
      icon: TrendingUp,
      title: 'Public Dashboard',
      description:
        'Transparent reporting for everyone. All reports are public — no account needed to browse, submit, or upvote.',
    },
    {
      icon: Route,
      title: 'All Road Issues Covered',
      description:
        'Potholes, broken roads, waterlogging, signage, streetlights — report any road infrastructure problem.',
    },
  ];

  const categories = [
    { icon: CircleDashed, label: CATEGORY_LABELS.pothole, color: 'text-red-500 bg-red-50' },
    { icon: Construction, label: CATEGORY_LABELS.broken_road, color: 'text-orange-500 bg-orange-50' },
    { icon: Droplets, label: CATEGORY_LABELS.waterlogging, color: 'text-blue-500 bg-blue-50' },
    { icon: Signpost, label: CATEGORY_LABELS.signage, color: 'text-violet-500 bg-violet-50' },
    { icon: Lightbulb, label: CATEGORY_LABELS.streetlight, color: 'text-amber-500 bg-amber-50' },
    { icon: AlertTriangle, label: CATEGORY_LABELS.other, color: 'text-slate-500 bg-slate-50' },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-teal-50/60 via-white to-white">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #0f766e 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
          <div className="text-center max-w-3xl mx-auto animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-100 text-teal-700 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              AI-powered civic grievance platform
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-[1.1]">
              Report road issues.
              <br />
              <span className="bg-gradient-to-r from-teal-600 to-teal-500 bg-clip-text text-transparent">
                AI drafts the complaint.
              </span>
              <br />
              Citizens track to resolution.
            </h1>
            <p className="mt-6 text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Upload a photo, speak or type in your language, and let RoadFix organize
              the location, address, and issue details. From duplicate checks to
              authority SLAs, every report is built for clearer follow-through.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/report"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group"
              >
                Report a Road Issue
                <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                to="/dashboard"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white text-slate-700 font-semibold border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
              >
                <Map className="w-5 h-5 text-teal-600" />
                View Dashboard
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
            {[
              { label: 'Issues Reported', value: stats.total, icon: Route, color: 'text-teal-600' },
              { label: 'Filed on Portal', value: stats.filed, icon: Send, color: 'text-amber-600' },
              { label: 'Resolved', value: stats.resolved, icon: CheckCircle2, color: 'text-emerald-600' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 text-center shadow-sm"
              >
                <stat.icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
                <div className="text-2xl sm:text-3xl font-bold text-slate-900">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm text-slate-500 mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Category Chips */}
      <section className="border-y border-slate-100 bg-slate-50/50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-medium text-slate-500 mb-5">
            Report any type of road issue
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {categories.map((cat) => (
              <div
                key={cat.label}
                className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-slate-200 shadow-sm"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cat.color}`}>
                  <cat.icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-slate-700">{cat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              How It Works
            </h2>
            <p className="mt-3 text-lg text-slate-600">
              From spotting a pothole to tracking its repair — in four simple steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, idx) => (
              <div key={step.title} className="relative">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 h-full hover:shadow-lg transition-shadow">
                  <div className={`w-12 h-12 rounded-xl ${step.color} flex items-center justify-center mb-4`}>
                    <step.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-xs font-bold text-slate-400 mb-1">
                    STEP {idx + 1}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>
                {idx < steps.length - 1 && (
                  <div className="hidden lg:flex absolute top-1/2 -right-3 w-6 h-6 items-center justify-center text-slate-300">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-slate-50/50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Everything you need to fix your roads
            </h2>
            <p className="mt-3 text-lg text-slate-600">
              A complete civic tech platform built for Indian citizens.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-teal-200 hover:shadow-md transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 mb-4">
                  <feature.icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Reports */}
      {recentReports.length > 0 && (
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  Trending Reports
                </h2>
                <p className="mt-2 text-slate-600">
                  Most upvoted issues from the community.
                </p>
              </div>
              <Link
                to="/dashboard"
                className="text-sm font-medium text-teal-600 hover:text-teal-700 flex items-center gap-1"
              >
                View all
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {recentReports.map((report) => (
                <ReportCard key={report.id} report={report} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl bg-gradient-to-br from-teal-600 to-teal-800 p-10 sm:p-16 text-center overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }} />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold text-white">
                Spotted a road issue?
              </h2>
              <p className="mt-3 text-lg text-teal-50 max-w-xl mx-auto">
                Report it in under 2 minutes. Let AI handle the paperwork.
              </p>
              <Link
                to="/report"
                className="mt-8 inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white text-teal-700 font-semibold hover:bg-teal-50 transition-all shadow-lg group"
              >
                Report Now
                <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
