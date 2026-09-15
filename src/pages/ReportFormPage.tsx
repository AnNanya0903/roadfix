import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  Sparkles,
  Loader2,
  Check,
  X,
  Copy,
  Send,
  ArrowLeft,
  MapPin,
  AlertCircle,
  FileText,
  Building2,
  Zap,
  Languages,
  Mic,
  MicOff,
  ScanSearch,
  CopyCheck,
} from 'lucide-react';
import MapPicker from '@/components/MapPicker';
import { supabase, STORAGE_BUCKET } from '@/lib/supabase';
import { getSessionId } from '@/lib/session';
import { generateAIDraft } from '@/lib/ai';
import type { ReportCategory, ReportSeverity, AIDraftResponse } from '@/lib/types';
import { CATEGORY_LABELS } from '@/lib/types';
import { getCategoryIcon } from '@/lib/icons';
import {
  REPORT_LANGUAGES,
  analyzePhoto,
  findDuplicateReports,
  reverseGeocode,
  startVoiceDictation,
  type ReportLanguage,
  type PhotoAnalysisResult,
  type DuplicateReport,
} from '@/lib/reporting';

const CATEGORIES: ReportCategory[] = [
  'pothole',
  'broken_road',
  'waterlogging',
  'signage',
  'streetlight',
  'other',
];

export default function ReportFormPage() {
  const navigate = useNavigate();
  const [category, setCategory] = useState<ReportCategory>('pothole');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [language, setLanguage] = useState<ReportLanguage>('en');
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [photoAnalysis, setPhotoAnalysis] = useState<PhotoAnalysisResult | null>(null);
  const [photoAnalysisLoading, setPhotoAnalysisLoading] = useState(false);
  const [photoAnalysisError, setPhotoAnalysisError] = useState<string | null>(null);
  const [duplicateReports, setDuplicateReports] = useState<DuplicateReport[]>([]);
  const [duplicateChecking, setDuplicateChecking] = useState(false);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const voiceStopRef = useRef<(() => void) | null>(null);

  const [aiResult, setAiResult] = useState<AIDraftResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      voiceStopRef.current?.();
    };
  }, [photoPreview]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setSubmitError('Photo must be under 10 MB.');
      return;
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoAnalysis(null);
    setPhotoAnalysisError(null);
    setDuplicateReports([]);
    setDuplicateAcknowledged(false);
  };

  const removePhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview(null);
    setPhotoAnalysis(null);
    setPhotoAnalysisError(null);
  };

  const handleAnalyzePhoto = async () => {
    if (!photo) {
      setPhotoAnalysisError('Please select a photo first.');
      return;
    }
    setPhotoAnalysisLoading(true);
    setPhotoAnalysisError(null);
    setPhotoAnalysis(null);
    try {
      const result = await analyzePhoto(photo);
      setPhotoAnalysis(result);
    } catch {
      setPhotoAnalysisError('Photo analysis is unavailable right now.');
    } finally {
      setPhotoAnalysisLoading(false);
    }
  };

  const handleApplyPhotoAnalysis = () => {
    if (!photoAnalysis) return;
    if (photoAnalysis.category) setCategory(photoAnalysis.category);
    if (photoAnalysis.address && !address.trim()) setAddress(photoAnalysis.address);
    if (photoAnalysis.description && !description.trim()) setDescription(photoAnalysis.description);
  };

  const handleLocationSelect = useCallback((latitude: number, longitude: number) => {
    setLat(latitude);
    setLng(longitude);
    setDuplicateReports([]);
    setDuplicateAcknowledged(false);
    if (!address.trim()) {
      setAddressLoading(true);
      reverseGeocode(latitude, longitude)
        .then((foundAddress) => {
          if (foundAddress && !address.trim()) setAddress(foundAddress);
        })
        .catch(() => undefined)
        .finally(() => setAddressLoading(false));
    }
  }, [address]);

  const handleToggleVoice = () => {
    if (voiceActive) {
      voiceStopRef.current?.();
      voiceStopRef.current = null;
      setVoiceActive(false);
      return;
    }

    setVoiceError(null);
    const stop = startVoiceDictation(language, (text) => setDescription(text), (message) => {
      setVoiceError(message);
      setVoiceActive(false);
      voiceStopRef.current = null;
    });
    voiceStopRef.current = stop;
    setVoiceActive(Boolean(stop));
  };

  const handleCheckDuplicates = async () => {
    if (!description.trim() || lat === null || lng === null) {
      setSubmitError('Describe the issue and mark its location before checking duplicates.');
      return;
    }
    setDuplicateChecking(true);
    setSubmitError(null);
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('id, category, description, address, latitude, longitude')
        .neq('session_id', getSessionId())
        .limit(100);
      if (error) throw error;
      setDuplicateReports(findDuplicateReports(data || [], {
        category,
        description: description.trim(),
        latitude: lat,
        longitude: lng,
      }));
      setDuplicateAcknowledged(false);
    } catch {
      setSubmitError('Duplicate check is unavailable right now.');
    } finally {
      setDuplicateChecking(false);
    }
  };

  const handleGenerateDraft = async () => {
    if (!description.trim()) {
      setAiError('Please describe the issue first.');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);
    try {
      const result = await generateAIDraft({
        description: description.trim(),
        category,
        address: address.trim() || null,
        language,
      });
      setAiResult(result);
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'Failed to generate AI draft. Please try again.'
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleCopyDraft = async () => {
    if (!aiResult?.draft) return;
    await navigator.clipboard.writeText(aiResult.draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      setSubmitError('Please describe the road issue.');
      return;
    }
    if (lat === null || lng === null) {
      setSubmitError('Please mark the location on the map.');
      return;
    }

    if (duplicateReports.length > 0 && !duplicateAcknowledged) {
      setSubmitError('A similar report may already exist. Review the duplicate warning or submit anyway.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      let photoPath: string | null = null;

      if (photo) {
        const sessionId = getSessionId();
        const fileExt = photo.name.split('.').pop() || 'jpg';
        const fileName = `${sessionId}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(fileName, photo, { contentType: photo.type });
        if (uploadError) throw uploadError;
        photoPath = fileName;
      }

      const sessionId = getSessionId();
      const { data, error } = await supabase
        .from('reports')
        .insert({
          category,
          description: description.trim(),
          ai_draft: aiResult?.draft || null,
          severity: (aiResult?.severity as ReportSeverity) || 'medium',
          department_suggested: aiResult?.department || null,
          latitude: lat,
          longitude: lng,
          address: address.trim() || null,
          photo_url: photoPath,
          status: 'submitted_locally',
          session_id: sessionId,
        })
        .select('id')
        .single();

      if (error) throw error;
      if (data?.id) {
        try {
          await supabase
            .from('reports')
            .update({
              language,
              photo_analysis: photoAnalysis || null,
              duplicate_of: duplicateReports.length > 0 ? duplicateReports[0].id : null,
            })
            .eq('id', data.id);
        } catch {
          void 0;
        }
      }
      navigate(`/report/${data.id}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? `Failed to submit: ${err.message}`
          : 'Failed to submit report. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Report a Road Issue</h1>
          <p className="mt-2 text-slate-600">
            Describe the problem, mark the location, and let AI draft a formal grievance letter.
          </p>
        </div>

        <div className="space-y-6">
          {/* Category Selection */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <label className="block text-sm font-semibold text-slate-900 mb-3">
              1. What type of issue is it?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {CATEGORIES.map((cat) => {
                const Icon = getCategoryIcon(cat);
                const isSelected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50 text-teal-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {CATEGORY_LABELS[cat]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Photo Upload */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <label className="block text-sm font-semibold text-slate-900 mb-3">
              2. Add a photo <span className="text-slate-400 font-normal">(optional but recommended)</span>
            </label>
            {photoPreview ? (
              <div className="relative rounded-xl overflow-hidden group">
                <img src={photoPreview} alt="Road issue" className="w-full h-64 object-cover" />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-48 rounded-xl border-2 border-dashed border-slate-200 hover:border-teal-400 hover:bg-teal-50/30 cursor-pointer transition-all">
                <Camera className="w-10 h-10 text-slate-400 mb-2" />
                <span className="text-sm text-slate-500">
                  Click to upload a photo
                </span>
                <span className="text-xs text-slate-400 mt-1">JPG, PNG up to 10 MB</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            )}
            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleAnalyzePhoto}
                disabled={photoAnalysisLoading || !photo}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 hover:border-teal-300 hover:text-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {photoAnalysisLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ScanSearch className="w-4 h-4" />
                )}
                {photoAnalysisLoading ? 'Analyzing…' : 'Analyze photo'}
              </button>
              {photoAnalysis && (
                <button
                  type="button"
                  onClick={handleApplyPhotoAnalysis}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-50 border border-teal-200 text-sm font-medium text-teal-700 hover:bg-teal-100 transition-all"
                >
                  <CopyCheck className="w-4 h-4" />
                  Apply suggestion
                </button>
              )}
            </div>
            {photoAnalysisError && (
              <p className="mt-2 text-xs text-red-600">{photoAnalysisError}</p>
            )}
            {photoAnalysis && (
              <div className="mt-3 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">
                <div className="flex flex-wrap gap-2 mb-2">
                  {photoAnalysis.category && (
                    <span className="px-2 py-1 rounded-md bg-white border border-teal-200 text-xs font-medium">
                      Suggested: {CATEGORY_LABELS[photoAnalysis.category]}
                    </span>
                  )}
                  {photoAnalysis.severity && (
                    <span className="px-2 py-1 rounded-md bg-white border border-teal-200 text-xs font-medium">
                      Severity: {photoAnalysis.severity}
                    </span>
                  )}
                  {photoAnalysis.confidence !== undefined && (
                    <span className="px-2 py-1 rounded-md bg-white border border-teal-200 text-xs font-medium">
                      Confidence: {Math.round(photoAnalysis.confidence * 100)}%
                    </span>
                  )}
                </div>
                {photoAnalysis.description && <p className="leading-relaxed">{photoAnalysis.description}</p>}
                {photoAnalysis.address && <p className="mt-1 text-teal-700">{photoAnalysis.address}</p>}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <label className="block text-sm font-semibold text-slate-900">
                3. Describe the issue
              </label>
              <div className="flex items-center gap-2">
                <Languages className="w-4 h-4 text-slate-400" />
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as ReportLanguage)}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                >
                  {REPORT_LANGUAGES.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-start gap-2 mb-2">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="e.g. There's a large pothole near the bus stop on the left side of the road. It's been there for 3 weeks and has caused two accidents. Water fills it when it rains, making it hard to see."
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all"
              />
              <button
                type="button"
                onClick={handleToggleVoice}
                disabled={voiceActive && !voiceError}
                className={`flex-shrink-0 w-11 h-11 rounded-xl border flex items-center justify-center transition-all ${
                  voiceActive
                    ? 'bg-red-50 border-red-200 text-red-600'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-600'
                }`}
                title={voiceActive ? 'Stop voice dictation' : 'Start voice dictation'}
              >
                {voiceActive ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            </div>
            {voiceError && (
              <p className="text-xs text-red-600 mb-2">{voiceError}</p>
            )}
            <p className="text-xs text-slate-400">
              Be specific — mention the size, how long it's been there, and any impact on traffic safety.
            </p>
          </div>

          {/* Location */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <label className="block text-sm font-semibold text-slate-900 mb-1">
              4. Mark the location
            </label>
            <p className="text-sm text-slate-500 mb-4">
              Search for the area, click on the map to drop a pin, or use your current location.
            </p>
            <MapPicker onLocationSelect={handleLocationSelect} />
            <div className="mt-4">
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                Address / landmark <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Near MG Road metro station, Bangalore"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all"
                />
                {addressLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-teal-600" />
                )}
              </div>
            </div>
          </div>

          {/* Duplicate Check */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Check for similar reports</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Compare the description and location before submitting a new report.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCheckDuplicates}
                disabled={duplicateChecking || !description.trim() || lat === null}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-medium text-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {duplicateChecking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ScanSearch className="w-4 h-4" />
                )}
                {duplicateChecking ? 'Checking…' : 'Check duplicates'}
              </button>
            </div>

            {duplicateReports.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Possible duplicate reports</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Review these before creating another report for the same issue.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {duplicateReports.map((report) => (
                    <div key={report.id} className="rounded-lg bg-white border border-amber-100 p-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-slate-900">{CATEGORY_LABELS[report.category]}</span>
                        <span className="text-xs text-amber-700 font-medium">
                          {report.similarity}% similar · {report.distanceMeters} m away
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 line-clamp-2">{report.description}</p>
                      {report.address && (
                        <p className="mt-1 text-xs text-slate-500">{report.address}</p>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setDuplicateAcknowledged(true)}
                  className="mt-3 px-3 py-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-xs font-semibold text-amber-900 transition-colors"
                >
                  I reviewed these and want to submit anyway
                </button>
              </div>
            )}

            {duplicateReports.length === 0 && !duplicateChecking && (
              <p className="text-sm text-slate-500">
                No similar reports have been checked yet.
              </p>
            )}
          </div>

          {/* AI Draft Generation */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900">
                  5. Generate AI grievance letter
                </label>
                <p className="text-sm text-slate-500 mt-0.5">
                  AI will classify severity, suggest a department, and draft a formal letter.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateDraft}
                disabled={aiLoading || !description.trim()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Draft
                  </>
                )}
              </button>
            </div>

            {aiError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{aiError}</span>
              </div>
            )}

            {aiResult && (
              <div className="animate-fade-in space-y-4">
                {/* Classification chips */}
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-medium text-amber-800">
                    <Zap className="w-3.5 h-3.5" />
                    Severity: {aiResult.severity}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs font-medium text-blue-800">
                    <Building2 className="w-3.5 h-3.5" />
                    {aiResult.department}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-xs font-medium text-teal-800">
                    <FileText className="w-3.5 h-3.5" />
                    Draft ready
                  </span>
                </div>

                {/* Draft text */}
                <div className="relative rounded-xl bg-slate-50 border border-slate-200 p-4">
                  <button
                    type="button"
                    onClick={handleCopyDraft}
                    className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans pr-20 max-h-72 overflow-y-auto leading-relaxed">
                    {aiResult.draft}
                  </pre>
                </div>

                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-2 text-sm text-blue-700">
                  <Send className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Copy this letter and file it on{' '}
                    <a
                      href="https://pgportal.gov.in/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline"
                    >
                      CPGRAMS
                    </a>{' '}
                    or your state PWD portal. You can add the reference number after submitting.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Submit Error */}
          {submitError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-sm text-red-700">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Submit */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pb-8">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !description.trim() || lat === null}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Submit Report
                </>
              )}
            </button>
            <p className="text-sm text-slate-500 text-center sm:text-left">
              {!description.trim()
                ? 'Describe the issue to continue'
                : lat === null
                ? 'Mark the location on the map to continue'
                : 'Your report will be public on the dashboard.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
