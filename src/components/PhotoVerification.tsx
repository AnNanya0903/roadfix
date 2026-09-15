import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Check, Image as ImageIcon, Upload, Trash2, AlertCircle } from 'lucide-react';
import { saveAfterPhoto, loadAfterPhoto, clearAfterPhoto } from '@/lib/preferences';

interface PhotoVerificationProps {
  beforePhotoUrl: string | null;
  categoryName: string;
  reportId?: string;
}

export default function PhotoVerification({
  beforePhotoUrl,
  categoryName,
  reportId,
}: PhotoVerificationProps) {
  const [afterPhotoUrl, setAfterPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (reportId) {
      const saved = loadAfterPhoto(reportId);
      if (saved) {
        setAfterPhotoUrl(saved);
      }
    }
  }, [reportId]);

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleAfterUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadError(null);
      setPhotoError(null);
      if (file.size > 10 * 1024 * 1024) {
        setUploadError('Photo must be under 10 MB.');
        return;
      }
      if (!file.type.startsWith('image/')) {
        setUploadError('Please upload an image file (JPG, PNG).');
        return;
      }
      setUploading(true);
      try {
        const objectUrl = URL.createObjectURL(file);
        setAfterPhotoUrl(objectUrl);
        if (reportId) {
          const dataUrl = await fileToDataUrl(file);
          saveAfterPhoto(reportId, dataUrl);
        }
      } catch {
        setUploadError('Failed to process photo. Please try again.');
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [reportId]
  );

  const removeAfterPhoto = useCallback(() => {
    if (afterPhotoUrl && afterPhotoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(afterPhotoUrl);
    }
    setAfterPhotoUrl(null);
    setPhotoError(null);
    if (reportId) {
      clearAfterPhoto(reportId);
    }
  }, [afterPhotoUrl, reportId]);

  const hasBefore = !!beforePhotoUrl;
  const hasAfter = !!afterPhotoUrl;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-2">
        <ImageIcon className="w-5 h-5 text-teal-600" />
        Photo Verification
      </h3>
      <p className="text-sm text-slate-500 mb-4">
        Upload before and after photos to verify issue resolution.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Before Photo */}
        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Before</p>
          {hasBefore ? (
            <div className="relative rounded-xl overflow-hidden border border-slate-200">
              <img
                src={beforePhotoUrl}
                alt={`Before ${categoryName}`}
                className="w-full h-48 object-cover"
                onError={() => setPhotoError('Before photo failed to load.')}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400">
              <Camera className="w-8 h-8 mb-2" />
              <span className="text-sm">No before photo</span>
            </div>
          )}
        </div>

        {/* After Photo */}
        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">After</p>
          {hasAfter ? (
            <div className="relative rounded-xl overflow-hidden border border-emerald-200">
              <img
                src={afterPhotoUrl}
                alt={`After ${categoryName}`}
                className="w-full h-48 object-cover"
                onError={() => setPhotoError('After photo failed to load.')}
              />
              <button
                type="button"
                onClick={removeAfterPhoto}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                aria-label="Remove after photo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/90 text-white text-[10px] font-medium">
                <Check className="w-3 h-3" />
                Uploaded
              </div>
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center h-48 rounded-xl border-2 border-dashed border-teal-300 bg-teal-50/30 cursor-pointer hover:border-teal-400 transition-colors"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="w-8 h-8 mb-2 text-teal-500" />
              <span className="text-sm text-teal-700 font-medium">Upload after photo</span>
              <span className="text-xs text-teal-500 mt-1">JPG, PNG up to 10 MB</span>
            </div>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAfterUpload}
      />

      {uploading && (
        <div className="mt-3 flex items-center gap-2 text-sm text-teal-600">
          <Check className="w-4 h-4 animate-spin" />
          Processing photo…
        </div>
      )}

      {(uploadError || photoError) && (
        <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{uploadError || photoError}</span>
        </div>
      )}

      {hasBefore && hasAfter && (
        <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-sm text-emerald-700">
          <Check className="w-4 h-4 flex-shrink-0" />
          Both photos available for verification.
        </div>
      )}
    </div>
  );
}