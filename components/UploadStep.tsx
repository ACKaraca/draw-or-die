import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  FileText,
  Map,
  Lightbulb,
  GraduationCap,
  PenTool,
  Layers,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { AnalysisLengthOption, FormData, JuryPersonaId } from '@/types';
import { RAPIDO_COSTS, TIER_DEFAULTS } from '@/lib/pricing';
import { generateAIResponse } from '@/lib/ai';
import { SimplePdfPreview } from '@/components/SimplePdfPreview';
import type { SupportedLanguage } from '@/lib/i18n';
import { useDrawOrDieStore } from '@/stores/drawOrDieStore';
import type { AdditionalUpload } from '@/stores/drawOrDieStore';

type AutoFillFields = {
  topic: boolean;
  site: boolean;
  concept: boolean;
  defense: boolean;
  category: boolean;
  analysisLength: boolean;
};

type PreviewFile = {
  id: string;
  badge: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  previewUrl: string | null;
};

interface UploadStepProps {
  getRootProps: any;
  getInputProps: any;
  isDragActive: boolean;
  previewUrl: string | null;
  mimeType: string | null;
  formData: FormData;
  setFormData: (data: FormData) => void;
  handleAnalyze: () => void;
  handleMultiAnalyze: () => void;
  handleAutoConcept: () => void;
  handleMaterialBoard: () => void;
  image: File | null;
  imageBase64: string | null;
  additionalUploads: Array<{ name: string; mimeType: string; sizeBytes: number; base64?: string }>;
  uploadValidationError: string | null;
  isRevisionMode: boolean;
  isAuthenticated: boolean;
  onAuthRequired: () => void;
  isPremiumUser: boolean;
  rapidoPens: number;
  onUpgradeClick: () => void;
  isAnonymous: boolean;
  guestDrawingCount: number;
  pdfText?: string | null;
  onGuestUpgradeRequired?: () => void;
  preferredLanguage?: SupportedLanguage;
}

const CATEGORY_OPTIONS = [
  'Vaziyet Planı',
  'Kentsel Tasarım',
  'Kamusal Yapı',
  'Eğitim Yapısı',
  'Sağlık Yapısı',
  'Konut',
  'Karma Kullanım',
  'Pafta Tasarımı',
  'Render',
  'Strüktürel Kesit',
  'Konsept Diyagram',
  'Peyzaj ve Açık Alan',
  'Restorasyon / Yeniden İşlevlendirme',
  'İç Mekan Kurgusu',
];

const PERSONA_OPTIONS: Array<{ id: JuryPersonaId; label: string; detail: string }> = [
  { id: 'constructive', label: 'Yapıcı Mentor', detail: 'Dengeyi korur, net iyileştirme adımları verir.' },
  { id: 'structural', label: 'Strüktürcü', detail: 'Taşıyıcı sistem, uygulanabilirlik ve teknik tutarlılığa odaklanır.' },
  { id: 'conceptual', label: 'Konseptüel', detail: 'Mekânsal fikir, anlatı ve kavramsal bağlantıları sorgular.' },
  { id: 'grumpy', label: 'Huysuz Jüri', detail: 'Sert, doğrudan ve acımasız teknik geri bildirim verir.' },
  { id: 'contextualist', label: 'Bağlamcı', detail: 'Yer, iklim, kamusal akış ve çevre ilişkilerini öne çıkarır.' },
  { id: 'sustainability', label: 'Sürdürülebilirlik Uzmanı', detail: 'Enerji, malzeme ömrü ve karbon etkisini değerlendirir.' },
];

const PERSONA_MAP = Object.fromEntries(PERSONA_OPTIONS.map((persona) => [persona.id, persona])) as Record<
  JuryPersonaId,
  (typeof PERSONA_OPTIONS)[number]
>;

const STUDIO_TUTORIAL_STORAGE_KEY = 'dod_studio_tutorial_seen_v1';

const TUTORIAL_STEPS = [
  {
    title: 'Studio Desk Hoş Geldin',
    text: 'Ana dosyanı ve ek paftalarını aynı anda yükleyebilirsin. Sol panelde dosyalar arasında geçiş yaparak tek tek inceleme yap.',
  },
  {
    title: 'Otomatik Doldur',
    text: 'Konu, arazi, konsept ve savunma alanlarını AI ile doldurabilirsin. Her alanın yanında otomatik anahtarını açıp kapat.',
  },
  {
    title: 'Analiz Derinliği',
    text: 'Üyelik seviyene göre analiz uzunluğu değişir. Misafir kısa, kayıtlı kısa/orta, premium kısa/orta/uzun seçeneklerine sahiptir.',
  },
];

function safeParseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(
      value
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```$/i, '')
        .trim(),
    );
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore parse error and return empty object.
  }

  return {};
}

function toDataUrl(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`;
}

function AutoToggle({
  enabled,
  label,
  onToggle,
}: {
  enabled: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors ${enabled ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200' : 'border-white/20 bg-white/5 text-slate-400 hover:text-slate-200'}`}
      title={`${label} alanı için otomatik doldurmayı ${enabled ? 'kapat' : 'aç'}`}
    >
      <Sparkles size={10} /> {enabled ? 'Otomatik Açık' : 'Otomatik Kapalı'}
    </button>
  );
}

export function UploadStep({
  getRootProps,
  getInputProps,
  isDragActive,
  previewUrl,
  mimeType,
  formData,
  setFormData,
  handleAnalyze,
  handleMultiAnalyze,
  handleAutoConcept,
  handleMaterialBoard,
  image,
  imageBase64,
  additionalUploads,
  uploadValidationError,
  isRevisionMode,
  isAuthenticated,
  onAuthRequired,
  isPremiumUser,
  rapidoPens,
  onUpgradeClick,
  isAnonymous,
  guestDrawingCount,
  pdfText,
  onGuestUpgradeRequired,
  preferredLanguage = 'tr',
}: UploadStepProps) {
  const canRunAnalysis = Boolean(image) && Boolean(imageBase64) && isAuthenticated && !uploadValidationError;
  const isFileProcessing = Boolean(image) && !Boolean(imageBase64);
  const isGuestAtLimit = isAnonymous && !isPremiumUser && guestDrawingCount >= 1;

  const trialTotal = isAnonymous ? TIER_DEFAULTS.ANONYMOUS : TIER_DEFAULTS.REGISTERED;
  const trialUsed = Math.max(0, trialTotal - Math.max(0, rapidoPens));
  const trialPercent = Math.min(100, Math.max(0, (trialUsed / trialTotal) * 100));

  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);
  const [juryMode, setJuryMode] = useState<'single' | 'multi'>('single');
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [autoFillNotice, setAutoFillNotice] = useState<string | null>(null);
  const [autoFillFields, setAutoFillFields] = useState<AutoFillFields>({
    topic: true,
    site: true,
    concept: true,
    defense: true,
    category: true,
    analysisLength: true,
  });

  const previewFiles = useMemo<PreviewFile[]>(() => {
    const files: PreviewFile[] = [];

    if (image) {
      const resolvedMime = mimeType || image.type;
      const inlineImageUrl =
        imageBase64 && resolvedMime && resolvedMime.startsWith('image/')
          ? toDataUrl(imageBase64, resolvedMime)
          : null;

      files.push({
        id: 'main-file',
        badge: 'Ana Dosya',
        name: image.name,
        mimeType: resolvedMime || 'application/octet-stream',
        sizeBytes: image.size,
        previewUrl: previewUrl ?? inlineImageUrl,
      });
    }

    additionalUploads.forEach((entry, index) => {
      files.push({
        id: `extra-${index}`,
        badge: `Ek Dosya ${index + 1}`,
        name: entry.name,
        mimeType: entry.mimeType,
        sizeBytes: entry.sizeBytes,
        previewUrl: entry.base64 ? toDataUrl(entry.base64, entry.mimeType) : null,
      });
    });

    return files;
  }, [additionalUploads, image, imageBase64, mimeType, previewUrl]);

  const setImageState = useDrawOrDieStore((s) => s.setImage);
  const setImageBase64State = useDrawOrDieStore((s) => s.setImageBase64);
  const setAdditionalUploadsState = useDrawOrDieStore((s) => s.setAdditionalUploads);
  const setMimeTypeState = useDrawOrDieStore((s) => s.setMimeType);
  const setPreviewUrlState = useDrawOrDieStore((s) => s.setPreviewUrl);
  const setPdfTextState = useDrawOrDieStore((s) => s.setPdfText);
  const setUploadValidationErrorState = useDrawOrDieStore((s) => s.setUploadValidationError);

  const clearAllStudioFiles = () => {
    setImageState(null);
    setImageBase64State(null);
    setAdditionalUploadsState([]);
    setMimeTypeState(null);
    setPreviewUrlState(null);
    setPdfTextState(null);
    setUploadValidationErrorState(null);
    setSelectedPreviewIndex(0);
  };

  const removePreviewFile = (index: number) => {
    if (index < 0 || index >= previewFiles.length) return;

    if (index === 0) {
      clearAllStudioFiles();
      return;
    }

    const nextAdditional: AdditionalUpload[] = additionalUploads
      .filter((_, extraIndex) => extraIndex !== index - 1)
      .map((entry) => ({
        name: entry.name,
        mimeType: entry.mimeType,
        base64: entry.base64 ?? '',
        sizeBytes: entry.sizeBytes,
      }));
    setAdditionalUploadsState(nextAdditional);
    setSelectedPreviewIndex((prev) => {
      if (prev === index) return Math.max(0, index - 1);
      if (prev > index) return prev - 1;
      return prev;
    });
  };

  useEffect(() => {
    if (!formData.analysisLength) {
      setFormData({ ...formData, analysisLength: 'SHORT' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const nextSingle = formData.singlePersonaId || 'constructive';
    const currentMulti = Array.isArray(formData.multiPersonaIds) ? formData.multiPersonaIds : [];
    const uniqueMulti = Array.from(new Set(
      currentMulti.filter((entry): entry is JuryPersonaId => Boolean(PERSONA_MAP[entry as JuryPersonaId])),
    ));
    const normalizedMulti: JuryPersonaId[] = uniqueMulti.length >= 2
      ? uniqueMulti.slice(0, 4)
      : ['structural', 'conceptual', 'grumpy'];

    if (nextSingle !== formData.singlePersonaId || normalizedMulti.length !== currentMulti.length || normalizedMulti.some((id, idx) => id !== currentMulti[idx])) {
      setFormData({
        ...formData,
        singlePersonaId: nextSingle,
        multiPersonaIds: normalizedMulti,
      });
    }
  }, [formData, setFormData]);

  useEffect(() => {
    if (selectedPreviewIndex >= previewFiles.length && previewFiles.length > 0) {
      setSelectedPreviewIndex(0);
    }
  }, [previewFiles.length, selectedPreviewIndex]);

  const activePreview = previewFiles[selectedPreviewIndex] ?? null;
  const selectedMultiPersonaIds = Array.isArray(formData.multiPersonaIds) ? formData.multiPersonaIds : [];

  const totalUploadedSizeBytes = previewFiles.reduce((sum, file) => sum + file.sizeBytes, 0);
  const totalUploadedSizeMb = (totalUploadedSizeBytes / (1024 * 1024)).toFixed(1);

  const canUseMedium = isAuthenticated && !isAnonymous;
  const canUseLong = isPremiumUser;

  const availableLengths = useMemo<AnalysisLengthOption[]>(() => {
    if (canUseLong) return ['SHORT', 'MEDIUM', 'LONG'];
    if (canUseMedium) return ['SHORT', 'MEDIUM'];
    return ['SHORT'];
  }, [canUseLong, canUseMedium]);

  useEffect(() => {
    if (!availableLengths.includes(formData.analysisLength)) {
      setFormData({ ...formData, analysisLength: availableLengths[0] });
    }
  }, [availableLengths, formData, setFormData]);

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem(STUDIO_TUTORIAL_STORAGE_KEY);
      if (!seen) {
        setShowTutorial(true);
      }
    } catch {
      // Ignore localStorage access failures.
    }
  }, []);

  const dismissTutorial = () => {
    setShowTutorial(false);
    try {
      window.localStorage.setItem(STUDIO_TUTORIAL_STORAGE_KEY, '1');
    } catch {
      // Ignore localStorage access failures.
    }
  };

  const toggleAutoFillField = (field: keyof AutoFillFields) => {
    setAutoFillFields((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const toggleMultiPersona = (personaId: JuryPersonaId) => {
    const current = Array.isArray(formData.multiPersonaIds) ? formData.multiPersonaIds : [];
    const exists = current.includes(personaId);

    if (exists) {
      if (current.length <= 2) return;
      setFormData({
        ...formData,
        multiPersonaIds: current.filter((id) => id !== personaId),
      });
      return;
    }

    if (current.length >= 4) return;
    setFormData({
      ...formData,
      multiPersonaIds: [...current, personaId],
    });
  };

  const moveSinglePersona = (direction: 'left' | 'right') => {
    const ids = PERSONA_OPTIONS.map((persona) => persona.id);
    const currentIndex = Math.max(0, ids.indexOf(formData.singlePersonaId));
    const nextIndex = direction === 'left'
      ? (currentIndex - 1 + ids.length) % ids.length
      : (currentIndex + 1) % ids.length;
    setFormData({ ...formData, singlePersonaId: ids[nextIndex] });
  };

  const handleAutoFill = async () => {
    if (!isAuthenticated) {
      onAuthRequired();
      return;
    }

    if (!imageBase64 || !mimeType) {
      setAutoFillNotice('Önce bir dosya yükleyip işlenmesini beklemelisin.');
      return;
    }

    setIsAutoFilling(true);
    setAutoFillNotice(null);

    try {
      const response = await generateAIResponse({
        locale: preferredLanguage,
        operation: 'AUTO_FILL_FORM',
        imageBase64,
        imageMimeType: mimeType,
        params: {
          language: preferredLanguage,
          topic: formData.topic,
          site: formData.site,
          concept: formData.concept,
          defense: formData.defense,
          category: formData.category,
          analysisLength: formData.analysisLength,
          pdfText: pdfText ? pdfText.substring(0, 1200) : '',
          additionalFiles: additionalUploads
            .filter((entry) => Boolean(entry.base64))
            .map((entry) => ({
              name: entry.name,
              mimeType: entry.mimeType,
              base64: entry.base64,
            })),
        },
      });

      if (!response?.result) {
        setAutoFillNotice('Otomatik doldurma yanıtı alınamadı. Tekrar dene.');
        return;
      }

      const payload = safeParseJsonObject(response.result);
      const nextLengthRaw = typeof payload.analysisLength === 'string' ? payload.analysisLength.toUpperCase() : '';
      const allowedAutoFillLengths = ['SHORT', 'MEDIUM', 'LONG'] as const;
      const nextLength = allowedAutoFillLengths.includes(nextLengthRaw as (typeof allowedAutoFillLengths)[number])
        ? (nextLengthRaw as (typeof allowedAutoFillLengths)[number])
        : formData.analysisLength;

      const merged: FormData = {
        ...formData,
        topic: autoFillFields.topic && typeof payload.topic === 'string' && payload.topic.trim() ? payload.topic.trim().substring(0, 120) : formData.topic,
        site: autoFillFields.site && typeof payload.site === 'string' && payload.site.trim() ? payload.site.trim().substring(0, 180) : formData.site,
        concept: autoFillFields.concept && typeof payload.concept === 'string' && payload.concept.trim() ? payload.concept.trim() : formData.concept,
        defense: autoFillFields.defense && typeof payload.defense === 'string' && payload.defense.trim() ? payload.defense.trim() : formData.defense,
        category:
          autoFillFields.category &&
          typeof payload.category === 'string' &&
          payload.category.trim() &&
          CATEGORY_OPTIONS.includes(payload.category.trim())
            ? payload.category.trim()
            : formData.category,
        analysisLength:
          autoFillFields.analysisLength && availableLengths.includes(nextLength)
            ? nextLength
            : formData.analysisLength,
      };

      setFormData(merged);
      setAutoFillNotice('Studio Desk alanları otomatik dolduruldu.');
    } catch (error) {
      setAutoFillNotice(error instanceof Error ? error.message : 'Otomatik doldurma başarısız oldu.');
    } finally {
      setIsAutoFilling(false);
    }
  };

  const rootProps = getRootProps();

  return (
    <>
      {showTutorial && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl border border-neon-red/30 bg-[#0D1425] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-neon-red/90">
                  Studio Desk Tutorial {tutorialStep + 1}/{TUTORIAL_STEPS.length}
                </p>
                <h3 className="mt-2 font-display text-2xl text-white">{TUTORIAL_STEPS[tutorialStep].title}</h3>
              </div>
              <button
                onClick={dismissTutorial}
                className="rounded-full border border-white/20 p-2 text-slate-300 hover:text-white hover:border-white/40"
                title="Tutorial'ı kapat"
              >
                <X size={16} />
              </button>
            </div>

            <p className="mt-4 text-slate-300 leading-relaxed">{TUTORIAL_STEPS[tutorialStep].text}</p>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={dismissTutorial}
                className="px-4 py-2 rounded-lg border border-white/20 text-slate-200 hover:bg-white/10 text-sm font-mono"
              >
                Skip Tutorial
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTutorialStep((prev) => Math.max(0, prev - 1))}
                  disabled={tutorialStep === 0}
                  className="px-4 py-2 rounded-lg border border-white/20 text-slate-200 hover:bg-white/10 text-sm font-mono disabled:opacity-40"
                >
                  Geri
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (tutorialStep >= TUTORIAL_STEPS.length - 1) {
                      dismissTutorial();
                      return;
                    }
                    setTutorialStep((prev) => Math.min(TUTORIAL_STEPS.length - 1, prev + 1));
                  }}
                  className="px-4 py-2 rounded-lg bg-neon-red text-white hover:bg-[#d1002a] text-sm font-bold uppercase tracking-wider"
                >
                  {tutorialStep >= TUTORIAL_STEPS.length - 1 ? 'Başla' : 'İleri'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <motion.div
        key="upload"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-8"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide flex items-center gap-2">
              <PenTool className="text-neon-red" /> Studio Desk
            </h2>
            <button
              type="button"
              onClick={() => setShowTutorial(true)}
              className="text-[10px] font-mono uppercase tracking-wider text-slate-400 hover:text-white"
            >
              Tutorial
            </button>
          </div>

          <div
            {...rootProps}
            className={`flex-1 min-h-[340px] sm:min-h-[420px] border-2 border-dashed rounded-xl flex flex-col p-3 sm:p-4 text-center transition-colors relative overflow-hidden ${isDragActive ? 'border-neon-red bg-neon-red/5' : 'border-white/20 hover:border-white/40 bg-white/5'} ${activePreview?.previewUrl ? 'cursor-default' : 'cursor-pointer justify-center items-center p-6 sm:p-8'}`}
          >
            <input {...getInputProps({ id: 'studio-desk-upload-input' })} />

            {activePreview?.previewUrl ? (
              <>
                <div className="flex items-center justify-between gap-2 mb-3 px-1">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-slate-300">
                    {activePreview.badge}: {activePreview.name}
                  </p>
                  <label
                    htmlFor="studio-desk-upload-input"
                    className="px-3 py-1.5 rounded border border-white/20 text-[11px] font-mono text-slate-200 hover:border-neon-red hover:text-white transition-colors cursor-pointer"
                  >
                    Dosya Değiştir
                  </label>
                  {previewFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAllStudioFiles}
                      className="px-3 py-1.5 rounded border border-red-400/40 text-[11px] font-mono text-red-200 hover:bg-red-500/15 transition-colors"
                    >
                      Dosyalari Sil
                    </button>
                  )}
                </div>

                <div className="relative flex-1 rounded-lg overflow-hidden border border-white/10 bg-black/50">
                  {activePreview.mimeType === 'application/pdf' ? (
                    <SimplePdfPreview
                      src={activePreview.previewUrl}
                      fileName={activePreview.name}
                      className="h-full w-full"
                    />
                  ) : (
                    <img src={activePreview.previewUrl} alt={activePreview.name} className="w-full h-full object-contain" />
                  )}
                </div>

                <p className="mt-2 text-[11px] font-mono text-slate-400 text-left px-1">
                  Dosyayı büyüt, kaydır ve detayları incele. Farklı paftalara alttaki dosya listesiyle geçiş yap.
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
                  <Upload size={24} className="text-slate-300" />
                </div>
                <p className="font-mono text-lg mb-2">A0/A1 Pafta, Eskiz veya Render Yükle</p>
                <p className="text-sm text-slate-500">Sürükle bırak veya seçmek için tıkla (JPG, PNG, PDF)</p>
                <p className="mt-2 text-[11px] text-slate-400 font-mono">Maksimum 8 dosya, toplam 35 MB</p>
              </>
            )}
          </div>

          {previewFiles.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-mono text-[11px] uppercase tracking-wider text-slate-300">
                  Studio Desk Dosyaları ({previewFiles.length})
                </p>
                <p className="font-mono text-[11px] text-cyan-300">{totalUploadedSizeMb} MB / 35 MB</p>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {previewFiles.map((file, index) => {
                  const selected = index === selectedPreviewIndex;
                  return (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => setSelectedPreviewIndex(index)}
                      className={`min-w-[180px] text-left rounded-lg border px-3 py-2 transition-colors ${selected ? 'border-neon-red bg-neon-red/10 text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/30'}`}
                      title={file.name}
                    >
                      <p className="text-[10px] font-mono uppercase tracking-widest opacity-80">{file.badge}</p>
                      <p className="truncate text-xs mt-1">{file.name}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{(file.sizeBytes / 1024).toFixed(0)} KB</p>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          removePreviewFile(index);
                        }}
                        className="mt-2 inline-block rounded border border-red-400/40 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-red-200 hover:bg-red-500/15"
                      >
                        Sil
                      </button>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6 bg-white/5 p-6 rounded-xl border border-white/10">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-2">
            <h3 className="font-mono text-sm uppercase tracking-widest text-slate-400">Proje Savunması</h3>
            <button
              type="button"
              onClick={handleAutoFill}
              disabled={isAutoFilling || !imageBase64 || !isAuthenticated}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <Wand2 size={12} /> {isAutoFilling ? 'Dolduruluyor...' : 'Otomatik Doldur'}
            </button>
          </div>

          {autoFillNotice && (
            <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-[11px] font-mono text-cyan-100">
              {autoFillNotice}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <FileText size={14} /> Konu
                </label>
                <AutoToggle enabled={autoFillFields.topic} label="Konu" onToggle={() => toggleAutoFillField('topic')} />
              </div>
              <input
                type="text"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                placeholder="Örn: Sürdürülebilir Kütüphane"
                className="w-full bg-black/50 border border-white/10 rounded-md px-4 py-2 text-white focus:outline-none focus:border-neon-red transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <Map size={14} /> Arazi
                </label>
                <AutoToggle enabled={autoFillFields.site} label="Arazi" onToggle={() => toggleAutoFillField('site')} />
              </div>
              <input
                type="text"
                value={formData.site}
                onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                placeholder="Örn: Karaköy, İstanbul"
                className="w-full bg-black/50 border border-white/10 rounded-md px-4 py-2 text-white focus:outline-none focus:border-neon-red transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <Lightbulb size={14} /> Konsept
                </label>
                <AutoToggle enabled={autoFillFields.concept} label="Konsept" onToggle={() => toggleAutoFillField('concept')} />
              </div>
              <textarea
                value={formData.concept}
                onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                placeholder="Örn: Boşlukların geçirgenliği üzerine..."
                rows={3}
                className="w-full bg-black/50 border border-white/10 rounded-md px-4 py-2 text-white focus:outline-none focus:border-neon-red transition-colors resize-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <FileText size={14} /> Jüri Önü Savunma Metni
                </label>
                <AutoToggle enabled={autoFillFields.defense} label="Savunma" onToggle={() => toggleAutoFillField('defense')} />
              </div>
              <textarea
                value={formData.defense}
                onChange={(e) => setFormData({ ...formData, defense: e.target.value })}
                placeholder="Jüriye açıklamak istediğin güçlü yönler, kararların ve gerekçelerin..."
                rows={4}
                className="w-full bg-black/50 border border-white/10 rounded-md px-4 py-2 text-white focus:outline-none focus:border-neon-red transition-colors resize-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-sm font-medium text-slate-300">Kategori</label>
                  <AutoToggle enabled={autoFillFields.category} label="Kategori" onToggle={() => toggleAutoFillField('category')} />
                </div>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-md px-4 py-2 text-white focus:outline-none focus:border-neon-red transition-colors appearance-none"
                >
                  {CATEGORY_OPTIONS.map((entry) => (
                    <option key={entry}>{entry}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-sm font-medium text-slate-300">Analiz Uzunluğu</label>
                  <AutoToggle enabled={autoFillFields.analysisLength} label="Uzunluk" onToggle={() => toggleAutoFillField('analysisLength')} />
                </div>
                <select
                  value={formData.analysisLength}
                  onChange={(e) => setFormData({ ...formData, analysisLength: e.target.value as AnalysisLengthOption })}
                  className="w-full bg-black/50 border border-white/10 rounded-md px-4 py-2 text-white focus:outline-none focus:border-neon-red transition-colors appearance-none"
                >
                  <option value="SHORT">Kısa</option>
                  <option value="MEDIUM" disabled={!canUseMedium}>Orta {!canUseMedium ? '(kayıtlı kullanıcı)' : ''}</option>
                  <option value="LONG" disabled={!canUseLong}>Uzun {!canUseLong ? '(premium)' : ''}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1"><GraduationCap size={14} /> Jüri Sertliği</span>
                  <span className="text-neon-red font-mono text-xs">
                    {formData.harshness === 1 && 'Yapıcı (Acı Gerçekler)'}
                    {formData.harshness === 2 && 'Normal'}
                    {formData.harshness === 3 && 'Sert'}
                    {formData.harshness === 4 && 'Roast (Göm)'}
                    {formData.harshness === 5 && 'Brutal'}
                  </span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={formData.harshness}
                  onChange={(e) => setFormData({ ...formData, harshness: parseInt(e.target.value, 10) })}
                  className="w-full h-2 bg-black/50 rounded-lg appearance-none cursor-pointer accent-neon-red"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-2 px-1">
                  <span>Yapıcı</span>
                  <span>Brutal</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label className="block text-sm font-medium text-slate-300">Jüri Modu</label>
                  <div className="inline-flex rounded-full border border-white/10 bg-black/40 p-1 text-[10px] font-mono uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => setJuryMode('single')}
                      className={`px-4 py-1.5 rounded-full transition-all ${juryMode === 'single' ? 'bg-white text-black font-bold' : 'text-slate-400 hover:text-white'}`}
                    >
                      Tekli
                    </button>
                    <button
                      type="button"
                      onClick={() => setJuryMode('multi')}
                      className={`px-4 py-1.5 rounded-full transition-all ${juryMode === 'multi' ? 'bg-purple-500 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                    >
                      Çoklu
                    </button>
                  </div>
                </div>

                {juryMode === 'single' ? (
                  <div className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Tekli Jüri Persona</span>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => moveSinglePersona('left')} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200 hover:bg-white/10">←</button>
                        <button type="button" onClick={() => moveSinglePersona('right')} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200 hover:bg-white/10">→</button>
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
                      <p className="text-sm font-bold text-white">{PERSONA_MAP[formData.singlePersonaId]?.label}</p>
                      <p className="mt-1 text-[10px] font-mono text-slate-400">{PERSONA_MAP[formData.singlePersonaId]?.detail}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <label className="block text-sm font-medium text-slate-300">Çoklu Jüri Persona Seçimi</label>
                      <span className="text-[10px] font-mono text-slate-400">{selectedMultiPersonaIds.length}/4 seçili (min 2)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {PERSONA_OPTIONS.map((persona) => {
                        const selected = selectedMultiPersonaIds.includes(persona.id);
                        const disableSelect = !selected && selectedMultiPersonaIds.length >= 4;
                        const disableUnselect = selected && selectedMultiPersonaIds.length <= 2;
                        return (
                          <button
                            key={persona.id}
                            type="button"
                            onClick={() => toggleMultiPersona(persona.id)}
                            disabled={disableSelect || disableUnselect}
                            className={`rounded-lg border px-3 py-2 text-left transition-colors ${selected ? 'border-purple-400/50 bg-purple-500/20 text-purple-100' : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'} disabled:opacity-45 disabled:cursor-not-allowed`}
                          >
                            <p className="text-xs font-mono uppercase tracking-wider">{persona.label}</p>
                            <p className="mt-1 text-[10px] text-slate-400 leading-relaxed">{persona.detail}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-auto">
            {isGuestAtLimit && (
              <div className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3">
                <p className="font-mono text-[11px] leading-relaxed text-amber-100 mb-3">
                  You&apos;ve completed your 1-drawing trial! Create an account to submit more designs and save your work.
                </p>
                <button
                  onClick={onUpgradeClick}
                  className="w-full py-2 px-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 rounded text-amber-100 text-sm font-mono transition-colors"
                >
                  Upgrade Now
                </button>
              </div>
            )}

            {isAuthenticated && !isPremiumUser && !isGuestAtLimit && (
              <div className="mb-3 rounded-lg border border-cyan-400/30 bg-cyan-400/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[11px] text-cyan-100">
                    Trial Bakiye: <span className="font-bold">{Math.max(0, rapidoPens).toFixed(1)} / {trialTotal} Rapido</span>
                  </p>
                  <button
                    type="button"
                    onClick={onUpgradeClick}
                    className="text-[10px] font-mono uppercase tracking-wider text-cyan-200 hover:text-white transition-colors"
                  >
                    Premium&apos;a Geç
                  </button>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-cyan-400" style={{ width: `${trialPercent}%` }} />
                </div>
                <p className="mt-2 text-[10px] text-cyan-100/80 font-mono">
                  Trial ilerlemesi arttıkça premium modlar ve daha yüksek Rapido limiti önerilir.
                </p>
              </div>
            )}

            {!isAuthenticated && (
              <div className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3">
                <p className="font-mono text-[11px] leading-relaxed text-amber-100">
                  Analiz modları yalnızca giriş yapan kullanıcılar için açıktır. Giriş yaptıktan sonra Rapido bakiyeniz gerçek hesabınızdan kullanılır.
                </p>
              </div>
            )}

            {uploadValidationError && (
              <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <p className="font-mono text-[11px] leading-relaxed text-red-200">{uploadValidationError}</p>
                <p className="mt-1 font-mono text-[10px] text-red-200/80">
                  Gönderim kapatıldı. Lütfen dosya boyutunu küçültüp yeniden yükleyin.
                </p>
              </div>
            )}

            <button
              onClick={isGuestAtLimit ? onGuestUpgradeRequired : (isAuthenticated ? handleAnalyze : onAuthRequired)}
              disabled={(isAuthenticated && (!canRunAnalysis || isFileProcessing)) || isGuestAtLimit}
              className={`w-full py-4 font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 mb-3 ${(canRunAnalysis && !isGuestAtLimit) || (!isAuthenticated && !isGuestAtLimit) ? 'bg-white text-black hover:bg-slate-200' : 'bg-white/10 text-white/30 cursor-not-allowed'}`}
            >
              {isGuestAtLimit ? (
                'Guest Limit Reached - Upgrade to Continue'
              ) : isAuthenticated ? (
                isFileProcessing ? (
                  'Dosya işleniyor...'
                ) : uploadValidationError ? (
                  'Dosyayı Küçült ve Yeniden Yükle'
                ) : (
                  <>
                    Jüri Karşısına Çık <span className="text-xs font-mono opacity-70">({isRevisionMode ? RAPIDO_COSTS.REVISION_SAME : RAPIDO_COSTS.SINGLE_JURY} Rapido)</span>
                  </>
                )
              ) : (
                'Giriş Yap ve Analize Başla'
              )}
            </button>

            {!isRevisionMode && (
              <button
                onClick={isGuestAtLimit ? onGuestUpgradeRequired : (!isAuthenticated ? onAuthRequired : isPremiumUser ? handleMultiAnalyze : onUpgradeClick)}
                disabled={(isAuthenticated && (!canRunAnalysis || isFileProcessing)) || isGuestAtLimit}
                className={`w-full py-3 font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 border-2 ${(canRunAnalysis && !isGuestAtLimit) || (!isAuthenticated && !isGuestAtLimit) ? 'border-purple-500 text-purple-400 hover:bg-purple-500/10' : 'border-white/10 text-white/30 cursor-not-allowed'}`}
              >
                {isGuestAtLimit ? (
                  <>
                    <Layers size={18} /> Upgrade to Access Multi-Jury
                  </>
                ) : isAuthenticated ? isPremiumUser ? (
                  <>
                    <Layers size={18} /> Çoklu Jüri ({selectedMultiPersonaIds.length} Persona) <span className="text-xs font-mono opacity-70">({RAPIDO_COSTS.MULTI_JURY} Rapido)</span>
                  </>
                ) : (
                  <>
                    <Layers size={18} /> Çoklu Jüri Premium&apos;da <span className="text-xs font-mono opacity-70">(Yükselt)</span>
                  </>
                ) : (
                  <>
                    <Layers size={18} /> Çoklu Jüri için Giriş Yap
                  </>
                )}
              </button>
            )}

            {!isRevisionMode && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  onClick={isAuthenticated ? handleAutoConcept : onAuthRequired}
                  disabled={isAuthenticated ? !canRunAnalysis : false}
                  className={`py-3 font-bold uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 border-2 rounded-lg text-[10px] leading-tight ${canRunAnalysis || !isAuthenticated ? 'border-sky-500 text-sky-400 hover:bg-sky-500/10' : 'border-white/10 text-white/30 cursor-not-allowed'}`}
                >
                  {isAuthenticated ? (
                    <>
                      <Lightbulb size={16} /> Konsept Analizi ve Onerisi <span className="opacity-70">({RAPIDO_COSTS.AUTO_CONCEPT} Rapido)</span>
                    </>
                  ) : (
                    <>
                      <Lightbulb size={16} /> Konsept Analizi için Giriş Yap
                    </>
                  )}
                </button>
                <button
                  onClick={!isAuthenticated ? onAuthRequired : isPremiumUser ? handleMaterialBoard : onUpgradeClick}
                  disabled={isAuthenticated ? !canRunAnalysis : false}
                  className={`py-3 font-bold uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 border-2 rounded-lg text-[10px] leading-tight ${canRunAnalysis || !isAuthenticated ? 'border-amber-500 text-amber-400 hover:bg-amber-500/10' : 'border-white/10 text-white/30 cursor-not-allowed'}`}
                >
                  {isAuthenticated ? isPremiumUser ? (
                    <>
                      <Layers size={16} /> Malzeme Analizi <span className="opacity-70">({RAPIDO_COSTS.MATERIAL_BOARD} Rapido)</span>
                    </>
                  ) : (
                    <>
                      <Layers size={16} /> Malzeme Analizi Premium&apos;da <span className="opacity-70">(Yükselt)</span>
                    </>
                  ) : (
                    <>
                      <Layers size={16} /> Malzeme Analizi için Giriş Yap
                    </>
                  )}
                </button>
              </div>
            )}

            {!isPremiumUser && (
              <p className="text-[10px] text-slate-500 font-mono text-center mt-3 leading-relaxed">
                Projeleriniz yalnızca tarayıcı oturumunuzda tutulur ve herkese açık olarak sergilenmez.
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
