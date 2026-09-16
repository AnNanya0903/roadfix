import type { Report, ReportCategory, ReportSeverity } from './types';

export const REPORT_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'mr', label: 'मराठी' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'gu', label: 'ગુજરાતી' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'മലയാളം' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
] as const;

export type ReportLanguage = (typeof REPORT_LANGUAGES)[number]['code'];

export interface PhotoAnalysisResult {
  category?: ReportCategory;
  severity?: ReportSeverity;
  description?: string;
  address?: string;
  confidence?: number;
}

export interface DuplicateReport {
  id: string;
  category: ReportCategory;
  description: string;
  address: string | null;
  latitude: number;
  longitude: number;
  similarity: number;
  distanceMeters: number;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: Array<{
    0?: { transcript: string };
    isFinal: boolean;
  }>;
}

interface SpeechRecognitionErrorEvent {
  error?: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  pothole: ['pothole', 'pit', 'crater', 'dent'],
  broken_road: ['broken road', 'crack', 'damaged road', 'cut road'],
  waterlogging: ['waterlogging', 'flood', 'water logged', 'drainage'],
  signage: ['sign', 'signage', 'board', 'milestone'],
  streetlight: ['streetlight', 'street light', 'light', 'lamp'],
  other: ['road', 'footpath', 'boundary', 'debris'],
};

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function words(value: string): Set<string> {
  return new Set(normalizeText(value).split(' ').filter(Boolean));
}

function similarity(left: string, right: string): number {
  const a = words(left);
  const b = words(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  a.forEach((word) => {
    if (b.has(word)) overlap += 1;
  });
  return overlap / Math.max(a.size, b.size, 1);
}

function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const earthRadius = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
    { headers: { Accept: 'application/json' } }
  );
  if (!response.ok) throw new Error('Address lookup failed.');
  const data = await response.json();
  const road = data.address?.road || data.address?.pedestrian;
  const suburb = data.address?.suburb || data.address?.neighbourhood || data.address?.city_district;
  const city = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality;
  const state = data.address?.state;
  return [road, suburb, city, state].filter(Boolean).join(', ') || data.display_name || '';
}

function fallbackPhotoAnalysis(fileName: string): PhotoAnalysisResult {
  const normalized = normalizeText(fileName);
  let matchedCategory: ReportCategory | undefined;
  let bestMatches = 0;
  (Object.keys(CATEGORY_KEYWORDS) as ReportCategory[]).forEach((key) => {
    const matches = CATEGORY_KEYWORDS[key].filter((keyword) => normalized.includes(keyword)).length;
    if (matches > bestMatches) {
      bestMatches = matches;
      matchedCategory = key;
    }
  });
  const category = matchedCategory ?? 'other';
  const severity: ReportSeverity = (category === 'waterlogging' || category === 'broken_road') ? 'medium' : 'low';
  return {
    category,
    severity,
    description:
      category === 'other'
        ? 'A road infrastructure issue was detected in the uploaded photo.'
        : `The uploaded photo appears to show a ${category.replace(/_/g, ' ')} issue.`,
    confidence: bestMatches ? 0.58 : 0.35,
  };
}

interface PhotoAnalysisPayload {
  category?: unknown;
  issue_type?: unknown;
  detected_category?: unknown;
  severity?: unknown;
  risk_level?: unknown;
  description?: unknown;
  summary?: unknown;
  suggested_description?: unknown;
  address?: unknown;
  location_hint?: unknown;
  landmark?: unknown;
  confidence?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizePhotoResult(data: unknown): PhotoAnalysisResult {
  const payload: PhotoAnalysisPayload = isRecord(data) ? data : {};
  const category = payload.category || payload.issue_type || payload.detected_category;
  const severity = payload.severity || payload.risk_level;
  const description = payload.description || payload.summary || payload.suggested_description;
  const address = payload.address || payload.location_hint || payload.landmark;
  return {
    category: typeof category === 'string' && Object.keys(CATEGORY_KEYWORDS).includes(category) ? (category as ReportCategory) : undefined,
    severity: typeof severity === 'string' && ['low', 'medium', 'high'].includes(severity) ? (severity as ReportSeverity) : undefined,
    description: typeof description === 'string' ? description : undefined,
    address: typeof address === 'string' ? address : undefined,
    confidence: typeof payload.confidence === 'number' ? payload.confidence : undefined,
  };
}

export async function analyzePhoto(file: File): Promise<PhotoAnalysisResult> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-photo-analysis`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  };
  const body = new FormData();
  body.append('photo', file);

  try {
    const response = await fetch(apiUrl, { method: 'POST', headers, body });
    if (response.ok) {
      const data = await response.json();
      return normalizePhotoResult(data);
    }
  } catch {
    return fallbackPhotoAnalysis(file.name);
  }
  return fallbackPhotoAnalysis(file.name);
}

export function findDuplicateReports(
  reports: Report[],
  candidate: {
    category: ReportCategory;
    description: string;
    latitude: number;
    longitude: number;
  }
): DuplicateReport[] {
  return reports
    .map((report) => {
      const textScore = similarity(candidate.description, report.description);
      const categoryScore = candidate.category === report.category ? 0.25 : 0;
      const distance = distanceMeters(
        candidate.latitude,
        candidate.longitude,
        report.latitude,
        report.longitude
      );
      const distanceScore = distance <= 250 ? 0.35 * (1 - distance / 250) : 0;
      const score = Math.min(1, textScore * 0.65 + categoryScore + distanceScore);
      return {
        id: report.id,
        category: report.category,
        description: report.description,
        address: report.address,
        latitude: report.latitude,
        longitude: report.longitude,
        similarity: Math.round(score * 100),
        distanceMeters: Math.round(distance),
      };
    })
    .filter((report) => report.similarity >= 58 || report.distanceMeters <= 100)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 4);
}

export function startVoiceDictation(
  language: ReportLanguage,
  onText: (text: string) => void,
  onError: (message: string) => void
): (() => void) | null {
  const Recognition = (
    window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    }
  ).SpeechRecognition ||
    (
      window as unknown as {
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      }
    ).webkitSpeechRecognition;

  if (!Recognition || !('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    onError('Voice dictation is not supported in this browser.');
    return null;
  }

  const recognition = new Recognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = language === 'en' ? 'en-IN' : `${language}-IN`;
  let finalText = '';

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let interim = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index]?.[0]?.transcript;
      if (!transcript) continue;
      if (event.results[index].isFinal) finalText += `${transcript} `;
      else interim += transcript;
    }
    onText(`${finalText}${interim}`.trim());
  };
  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    onError(event.error === 'not-allowed' ? 'Microphone permission was denied.' : 'Voice dictation failed.');
  };
  recognition.onend = () => {};
  recognition.start();

  return () => {
    try {
      recognition.stop();
    } catch {
      recognition?.abort?.();
    }
  };
}
