import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react';
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
  ScanLine,
  Route,
  Accessibility,
} from 'lucide-react';
import { RAPIDO_COSTS, TIER_DEFAULTS } from '@/lib/pricing';
import { generateAIResponse } from '@/lib/ai';
import { DialogFrame } from '@/components/DialogFrame';
import { SimplePdfPreview } from '@/components/SimplePdfPreview';
import { InteractiveImagePreview } from '@/components/InteractiveImagePreview';
import { pickLocalized, type SupportedLanguage } from '@/lib/i18n';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import {
  STUDIO_CATEGORY_VALUES,
  STUDIO_PERSONA_I18N,
  studioCategoryLabel,
  studioTutorialSteps,
} from '@/lib/locales/uploadForm';
import { useDrawOrDieStore, type AdditionalUpload } from '@/stores/drawOrDieStore';

import type { DropzoneState } from 'react-dropzone';
import type { DesignInsightOperation } from '@/lib/design-insights';
import type { AnalysisLengthOption, FormData, JuryPersonaId } from '@/types';

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
  getRootProps: DropzoneState['getRootProps'];
  getInputProps: DropzoneState['getInputProps'];
  isDragActive: boolean;
  previewUrl: string | null;
  mimeType: string | null;
  formData: FormData;
  setFormData: (data: FormData) => void;
  handleAnalyze: () => void;
  handleMultiAnalyze: () => void;
  handleAutoConcept: () => void;
  handleMaterialBoard: () => void;
  handleDesignInsight: (operation: DesignInsightOperation) => void;
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
  /** Server-driven: when true, multi-jury is available without Premium (promo). */
  multiJuryPromoActive?: boolean;
}

const STUDIO_TUTORIAL_STORAGE_KEY = 'dod_studio_tutorial_seen_v1';
const UPLOAD_INPUT_ID = 'studio-desk-upload-input';

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
  title,
  onLabel,
  offLabel,
  onToggle,
}: {
  enabled: boolean;
  title: string;
  onLabel: string;
  offLabel: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors ${enabled ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200' : 'border-white/20 bg-white/5 text-slate-400 hover:text-slate-200'}`}
      title={title}
    >
      <Sparkles size={10} /> {enabled ? onLabel : offLabel}
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
  handleDesignInsight,
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
  preferredLanguage: _preferredLanguage = 'tr',
  multiJuryPromoActive = false,
}: UploadStepProps) {
  const language = useLanguage();
  const fieldIdPrefix = useId();
  const fieldIds = {
    topic: `${fieldIdPrefix}-topic`,
    site: `${fieldIdPrefix}-site`,
    concept: `${fieldIdPrefix}-concept`,
    defense: `${fieldIdPrefix}-defense`,
    category: `${fieldIdPrefix}-category`,
    analysisLength: `${fieldIdPrefix}-analysis-length`,
    harshness: `${fieldIdPrefix}-harshness`,
    juryMode: `${fieldIdPrefix}-jury-mode`,
    singlePersona: `${fieldIdPrefix}-single-persona`,
    multiPersona: `${fieldIdPrefix}-multi-persona`,
  };
  const tutorialTitleId = `${fieldIdPrefix}-tutorial-title`;
  const tutorialTextId = `${fieldIdPrefix}-tutorial-text`;
  const dropzoneHintId = `${fieldIdPrefix}-dropzone-hint`;
  const uploadErrorId = `${fieldIdPrefix}-upload-error`;
  const tutorialNextRef = useRef<HTMLButtonElement>(null);
  const tutorialSteps = useMemo(() => studioTutorialSteps(language), [language]);
  const personaOptions = useMemo(
    () =>
      STUDIO_PERSONA_I18N.map((p) => ({
        id: p.id,
        label: pickLocalized(language, p.label.tr, p.label.en),
        detail: pickLocalized(language, p.detail.tr, p.detail.en),
      })),
    [language],
  );
  const personaMap = useMemo(
    () =>
      Object.fromEntries(personaOptions.map((persona) => [persona.id, persona])) as Record<
        JuryPersonaId,
        (typeof personaOptions)[number]
      >,
    [personaOptions],
  );

  const canRunAnalysis = Boolean(image) && Boolean(imageBase64) && isAuthenticated && !uploadValidationError;
  const isFileProcessing = Boolean(image) && !Boolean(imageBase64);
  const isGuestAtLimit = isAnonymous && !isPremiumUser && guestDrawingCount >= 1;

  const trialTotal = isAnonymous ? TIER_DEFAULTS.ANONYMOUS : TIER_DEFAULTS.REGISTERED;
  const trialUsed = Math.max(0, trialTotal - Math.max(0, rapidoPens));
  const trialPercent = Math.min(100, Math.max(0, (trialUsed / trialTotal) * 100));
  const showTrialLowBalanceWarning =
    isAuthenticated && !isPremiumUser && !isGuestAtLimit && rapidoPens < 15;

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
        badge: pickLocalized(language, 'Ana Dosya', 'Main file'),
        name: image.name,
        mimeType: resolvedMime || 'application/octet-stream',
        sizeBytes: image.size,
        previewUrl: previewUrl ?? inlineImageUrl,
      });
    }

    additionalUploads.forEach((entry, index) => {
      files.push({
        id: `extra-${index}`,
        badge: pickLocalized(language, `Ek Dosya ${index + 1}`, `Extra sheet ${index + 1}`),
        name: entry.name,
        mimeType: entry.mimeType,
        sizeBytes: entry.sizeBytes,
        previewUrl: entry.base64 ? toDataUrl(entry.base64, entry.mimeType) : null,
      });
    });

    return files;
  }, [additionalUploads, image, imageBase64, language, mimeType, previewUrl]);

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
      currentMulti.filter((entry): entry is JuryPersonaId => Boolean(personaMap[entry as JuryPersonaId])),
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
  }, [formData, personaMap, setFormData]);

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
    const ids = personaOptions.map((persona) => persona.id);
    const currentIndex = Math.max(0, ids.indexOf(formData.singlePersonaId));
    const nextIndex = direction === 'left'
      ? (currentIndex - 1 + ids.length) % ids.length
      : (currentIndex + 1) % ids.length;
    setFormData({ ...formData, singlePersonaId: ids[nextIndex] });
  };

  const harshnessLabels: Record<number, string> = {
    1: pickLocalized(language, 'Yapıcı (Acı Gerçekler)', 'Constructive (hard truths)'),
    2: pickLocalized(language, 'Normal', 'Normal'),
    3: pickLocalized(language, 'Sert', 'Harsh'),
    4: pickLocalized(language, 'Roast (Göm)', 'Roast'),
    5: pickLocalized(language, 'Brutal', 'Brutal'),
  };
  const harshnessLabel = harshnessLabels[formData.harshness] ?? '';

  const handleAutoFill = async () => {
    if (!isAuthenticated) {
      onAuthRequired();
      return;
    }

    if (!imageBase64 || !mimeType) {
      setAutoFillNotice(pickLocalized(language, 'Önce bir dosya yükleyip işlenmesini beklemelisin.', 'Upload a file and wait for it to process first.'));
      return;
    }

    setIsAutoFilling(true);
    setAutoFillNotice(null);

    try {
      const response = await generateAIResponse({
        locale: language,
        operation: 'AUTO_FILL_FORM',
        imageBase64,
        imageMimeType: mimeType,
        params: {
          language,
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
        setAutoFillNotice(pickLocalized(language, 'Otomatik doldurma yanıtı alınamadı. Tekrar dene.', 'Auto-fill response failed. Try again.'));
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
          STUDIO_CATEGORY_VALUES.includes(payload.category.trim() as (typeof STUDIO_CATEGORY_VALUES)[number])
            ? payload.category.trim()
            : formData.category,
        analysisLength:
          autoFillFields.analysisLength && availableLengths.includes(nextLength)
            ? nextLength
            : formData.analysisLength,
      };

      setFormData(merged);
      setAutoFillNotice(pickLocalized(language, 'Studio Desk alanları otomatik dolduruldu.', 'Studio Desk fields were auto-filled.'));
    } catch (error) {
      setAutoFillNotice(error instanceof Error ? error.message : pickLocalized(language, 'Otomatik doldurma başarısız oldu.', 'Auto-fill failed.'));
    } finally {
      setIsAutoFilling(false);
    }
  };

  const hasPreviewFiles = previewFiles.length > 0;
  const rootProps = getRootProps({
    onClick: (event: MouseEvent<HTMLElement>) => {
      if (hasPreviewFiles) {
        event.stopPropagation();
      }
    },
    // Empty zone acts as the file-picker button; once files are previewed it only receives drops and the
    // explicit "Replace file" button takes over, so the zone must not stay a nameless tab stop.
    ...(hasPreviewFiles
      ? { role: undefined, tabIndex: -1 }
      : {
          role: 'button',
          'aria-label': pickLocalized(language, 'Pafta yükle: dosya seç', 'Upload board: choose files'),
          'aria-describedby': dropzoneHintId,
        }),
  });
  const openFilePicker = () => {
    document.getElementById(UPLOAD_INPUT_ID)?.click();
  };

  return (
    <>
      <DialogFrame
        isOpen={showTutorial}
        onClose={dismissTutorial}
        labelledBy={tutorialTitleId}
        describedBy={tutorialTextId}
        initialFocusRef={tutorialNextRef}
        panelClassName="w-full max-w-xl rounded-2xl border border-white/[0.13] bg-bg-1 p-6 text-left focus:outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-neon-red/90">
              {pickLocalized(language, 'Studio Desk Rehberi', 'Studio Desk Tutorial')} {tutorialStep + 1}/{tutorialSteps.length}
            </p>
            <h3 id={tutorialTitleId} className="mt-2 font-display text-2xl text-white">{tutorialSteps[tutorialStep].title}</h3>
          </div>
          <button
            type="button"
            onClick={dismissTutorial}
            className="rounded-full border border-white/20 p-2 text-slate-300 hover:text-white hover:border-white/40"
            title={pickLocalized(language, 'Rehberi kapat', 'Close tutorial')}
            aria-label={pickLocalized(language, 'Rehberi kapat', 'Close tutorial')}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <p id={tutorialTextId} className="mt-4 text-slate-300 leading-relaxed">{tutorialSteps[tutorialStep].text}</p>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={dismissTutorial}
            className="px-4 py-2 rounded-lg border border-white/20 text-slate-200 hover:bg-white/10 text-sm font-mono"
          >
            {pickLocalized(language, 'Rehberi atla', 'Skip tutorial')}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTutorialStep((prev) => Math.max(0, prev - 1))}
              disabled={tutorialStep === 0}
              className="px-4 py-2 rounded-lg border border-white/20 text-slate-200 hover:bg-white/10 text-sm font-mono disabled:opacity-40"
            >
              {pickLocalized(language, 'Geri', 'Back')}
            </button>
            <button
              ref={tutorialNextRef}
              type="button"
              onClick={() => {
                if (tutorialStep >= tutorialSteps.length - 1) {
                  dismissTutorial();
                  return;
                }
                setTutorialStep((prev) => Math.min(tutorialSteps.length - 1, prev + 1));
              }}
              className="px-4 py-2 rounded-lg bg-neon-red text-white hover:bg-neon-red/90 text-sm font-mono font-bold uppercase tracking-wider"
            >
              {tutorialStep >= tutorialSteps.length - 1 ? pickLocalized(language, 'Başla', 'Start') : pickLocalized(language, 'İleri', 'Next')}
            </button>
          </div>
        </div>
      </DialogFrame>

      <motion.div
        key="upload"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
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
              className="min-h-6 px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 hover:text-white"
            >
              {pickLocalized(language, 'Rehber', 'Tutorial')}
            </button>
          </div>

          <input
            {...getInputProps({
              id: UPLOAD_INPUT_ID,
              'aria-label': pickLocalized(language, 'Pafta dosyası seç', 'Choose board files'),
            })}
          />
          <div
            {...rootProps}
            className={`flex-1 min-h-[340px] sm:min-h-[420px] border-2 border-dashed rounded-xl flex flex-col p-3 sm:p-4 text-center transition-colors relative overflow-hidden ${isDragActive ? 'border-neon-red bg-neon-red/5' : 'border-white/20 hover:border-white/40 bg-white/5'} ${activePreview?.previewUrl ? 'cursor-default' : 'cursor-pointer justify-center items-center p-6 sm:p-8'}`}
          >
            {activePreview?.previewUrl ? (
              <>
                <div className="flex items-center justify-between gap-2 mb-3 px-1">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-slate-300">
                    {activePreview.badge}: {activePreview.name}
                  </p>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openFilePicker();
                    }}
                    className="px-3 py-1.5 rounded border border-white/20 text-[11px] font-mono text-slate-200 hover:border-neon-red hover:text-white transition-colors cursor-pointer"
                  >
                    {pickLocalized(language, 'Dosya Değiştir', 'Replace file')}
                  </button>
                  {previewFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAllStudioFiles}
                      className="px-3 py-1.5 rounded border border-red-400/40 text-[11px] font-mono text-red-200 hover:bg-red-500/15 transition-colors"
                    >
                      {pickLocalized(language, 'Dosyaları Sil', 'Remove files')}
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
                    <InteractiveImagePreview
                      src={activePreview.previewUrl}
                      alt={activePreview.name}
                      fileName={activePreview.name}
                      className="h-full w-full"
                    />
                  )}
                </div>

                <p className="mt-2 text-[11px] font-mono text-slate-400 text-left px-1">
                  {pickLocalized(
                    language,
                    'Dosyayı büyüt, kaydır ve detayları incele. Farklı paftalara alttaki dosya listesiyle geçiş yap.',
                    'Zoom, pan, and inspect details. Switch sheets using the file list below.',
                  )}
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
                  <Upload size={24} className="text-slate-300" />
                </div>
                <p className="font-mono text-lg mb-2">
                  {pickLocalized(language, 'A0/A1 Pafta, Eskiz veya Render Yükle', 'Upload A0/A1 sheet, sketch, or render')}
                </p>
                <div id={dropzoneHintId}>
                  <p className="text-sm text-slate-500">
                    {pickLocalized(language, 'Sürükle bırak veya seçmek için tıkla (JPG, PNG, PDF)', 'Drag and drop or click to select (JPG, PNG, PDF)')}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-400 font-mono">
                    {pickLocalized(language, 'Maksimum 8 dosya, toplam 35 MB', 'Up to 8 files, 35 MB total')}
                  </p>
                </div>
              </>
            )}
          </div>

          {previewFiles.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-mono text-[11px] uppercase tracking-wider text-slate-300">
                  {pickLocalized(language, 'Studio Desk Dosyaları', 'Studio Desk files')} ({previewFiles.length})
                </p>
                <p className="font-mono text-[11px] text-cyan-300">{totalUploadedSizeMb} MB / 35 MB</p>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {previewFiles.map((file, index) => {
                  const selected = index === selectedPreviewIndex;
                  return (
                    <div
                      key={file.id}
                      className={`min-w-[180px] rounded-lg border px-3 py-2 transition-colors ${selected ? 'border-neon-red bg-neon-red/10 text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/30'}`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedPreviewIndex(index)}
                        aria-pressed={selected}
                        className="block w-full text-left"
                        title={file.name}
                      >
                        <span className="block text-[10px] font-mono uppercase tracking-widest opacity-80">{file.badge}</span>
                        <span className="block truncate text-xs mt-1">{file.name}</span>
                        <span className="block text-[10px] text-slate-400 mt-1">{(file.sizeBytes / 1024).toFixed(0)} KB</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removePreviewFile(index)}
                        aria-label={pickLocalized(language, `${file.name} dosyasını sil`, `Remove ${file.name}`)}
                        className="mt-2 inline-block rounded border border-red-400/40 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-red-200 hover:bg-red-500/15"
                      >
                        {pickLocalized(language, 'Sil', 'Remove')}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6 bg-white/5 p-6 rounded-xl border border-white/10">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-2">
            <h3 className="font-mono text-sm uppercase tracking-widest text-slate-400">
              {pickLocalized(language, 'Proje Savunması', 'Project defense')}
            </h3>
            <button
              type="button"
              onClick={handleAutoFill}
              disabled={isAutoFilling || !imageBase64 || !isAuthenticated}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <Wand2 size={12} />{' '}
              {isAutoFilling
                ? pickLocalized(language, 'Dolduruluyor...', 'Filling...')
                : pickLocalized(language, 'Otomatik Doldur', 'Auto-fill')}
            </button>
          </div>

          {autoFillNotice && (
            <div role="status" className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-[11px] font-mono text-cyan-100">
              {autoFillNotice}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label htmlFor={fieldIds.topic} className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <FileText size={14} aria-hidden="true" /> {pickLocalized(language, 'Konu', 'Topic')}
                </label>
                <AutoToggle
                  enabled={autoFillFields.topic}
                  title={pickLocalized(language, 'Konu alanı için otomatik doldurmayı aç veya kapat', 'Toggle auto-fill for the topic field')}
                  onLabel={pickLocalized(language, 'Otomatik Açık', 'Auto on')}
                  offLabel={pickLocalized(language, 'Otomatik Kapalı', 'Auto off')}
                  onToggle={() => toggleAutoFillField('topic')}
                />
              </div>
              <input
                id={fieldIds.topic}
                type="text"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                placeholder={pickLocalized(language, 'Örn: Sürdürülebilir Kütüphane', 'e.g. Sustainable library')}
                className="w-full bg-black/50 border border-white/10 rounded-md px-4 py-2 text-white focus:outline-none focus:border-neon-red transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label htmlFor={fieldIds.site} className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <Map size={14} aria-hidden="true" /> {pickLocalized(language, 'Arazi', 'Site')}
                </label>
                <AutoToggle
                  enabled={autoFillFields.site}
                  title={pickLocalized(language, 'Arazi alanı için otomatik doldurmayı aç veya kapat', 'Toggle auto-fill for the site field')}
                  onLabel={pickLocalized(language, 'Otomatik Açık', 'Auto on')}
                  offLabel={pickLocalized(language, 'Otomatik Kapalı', 'Auto off')}
                  onToggle={() => toggleAutoFillField('site')}
                />
              </div>
              <input
                id={fieldIds.site}
                type="text"
                value={formData.site}
                onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                placeholder={pickLocalized(language, 'Örn: Karaköy, İstanbul', 'e.g. Karaköy, Istanbul')}
                className="w-full bg-black/50 border border-white/10 rounded-md px-4 py-2 text-white focus:outline-none focus:border-neon-red transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label htmlFor={fieldIds.concept} className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <Lightbulb size={14} aria-hidden="true" /> {pickLocalized(language, 'Konsept', 'Concept')}
                </label>
                <AutoToggle
                  enabled={autoFillFields.concept}
                  title={pickLocalized(language, 'Konsept alanı için otomatik doldurmayı aç veya kapat', 'Toggle auto-fill for the concept field')}
                  onLabel={pickLocalized(language, 'Otomatik Açık', 'Auto on')}
                  offLabel={pickLocalized(language, 'Otomatik Kapalı', 'Auto off')}
                  onToggle={() => toggleAutoFillField('concept')}
                />
              </div>
              <textarea
                id={fieldIds.concept}
                value={formData.concept}
                onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                placeholder={pickLocalized(language, 'Örn: Boşlukların geçirgenliği üzerine...', 'e.g. On the permeability of voids...')}
                rows={3}
                className="w-full bg-black/50 border border-white/10 rounded-md px-4 py-2 text-white focus:outline-none focus:border-neon-red transition-colors resize-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label htmlFor={fieldIds.defense} className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <FileText size={14} aria-hidden="true" /> {pickLocalized(language, 'Jüri Önü Savunma Metni', 'Defense statement for the jury')}
                </label>
                <AutoToggle
                  enabled={autoFillFields.defense}
                  title={pickLocalized(language, 'Savunma alanı için otomatik doldurmayı aç veya kapat', 'Toggle auto-fill for the defense field')}
                  onLabel={pickLocalized(language, 'Otomatik Açık', 'Auto on')}
                  offLabel={pickLocalized(language, 'Otomatik Kapalı', 'Auto off')}
                  onToggle={() => toggleAutoFillField('defense')}
                />
              </div>
              <textarea
                id={fieldIds.defense}
                value={formData.defense}
                onChange={(e) => setFormData({ ...formData, defense: e.target.value })}
                placeholder={pickLocalized(
                  language,
                  'Jüriye açıklamak istediğin güçlü yönler, kararların ve gerekçelerin...',
                  'Strengths, decisions, and reasoning you want to explain to the jury...',
                )}
                rows={4}
                className="w-full bg-black/50 border border-white/10 rounded-md px-4 py-2 text-white focus:outline-none focus:border-neon-red transition-colors resize-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label htmlFor={fieldIds.category} className="block text-sm font-medium text-slate-300">
                    {pickLocalized(language, 'Kategori', 'Category')}
                  </label>
                  <AutoToggle
                    enabled={autoFillFields.category}
                    title={pickLocalized(language, 'Kategori alanı için otomatik doldurmayı aç veya kapat', 'Toggle auto-fill for the category field')}
                    onLabel={pickLocalized(language, 'Otomatik Açık', 'Auto on')}
                    offLabel={pickLocalized(language, 'Otomatik Kapalı', 'Auto off')}
                    onToggle={() => toggleAutoFillField('category')}
                  />
                </div>
                <select
                  id={fieldIds.category}
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-md px-4 py-2 text-white focus:outline-none focus:border-neon-red transition-colors appearance-none"
                >
                  {STUDIO_CATEGORY_VALUES.map((entry) => (
                    <option key={entry} value={entry}>
                      {studioCategoryLabel(language, entry)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label htmlFor={fieldIds.analysisLength} className="block text-sm font-medium text-slate-300">
                    {pickLocalized(language, 'Analiz Uzunluğu', 'Analysis length')}
                  </label>
                  <AutoToggle
                    enabled={autoFillFields.analysisLength}
                    title={pickLocalized(language, 'Analiz uzunluğu için otomatik doldurmayı aç veya kapat', 'Toggle auto-fill for analysis length')}
                    onLabel={pickLocalized(language, 'Otomatik Açık', 'Auto on')}
                    offLabel={pickLocalized(language, 'Otomatik Kapalı', 'Auto off')}
                    onToggle={() => toggleAutoFillField('analysisLength')}
                  />
                </div>
                <select
                  id={fieldIds.analysisLength}
                  value={formData.analysisLength}
                  onChange={(e) => setFormData({ ...formData, analysisLength: e.target.value as AnalysisLengthOption })}
                  className="w-full bg-black/50 border border-white/10 rounded-md px-4 py-2 text-white focus:outline-none focus:border-neon-red transition-colors appearance-none"
                >
                  <option value="SHORT">{pickLocalized(language, 'Kısa', 'Short')}</option>
                  <option value="MEDIUM" disabled={!canUseMedium}>
                    {pickLocalized(language, 'Orta', 'Medium')}
                    {!canUseMedium ? ` ${pickLocalized(language, '(kayıtlı kullanıcı)', '(signed-in)')}` : ''}
                  </option>
                  <option value="LONG" disabled={!canUseLong}>
                    {pickLocalized(language, 'Uzun', 'Long')}
                    {!canUseLong ? ` ${pickLocalized(language, '(premium)', '(premium)')}` : ''}
                  </option>
                </select>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor={fieldIds.harshness} className="flex items-center gap-1 text-sm font-medium text-slate-300">
                    <GraduationCap size={14} aria-hidden="true" /> {pickLocalized(language, 'Jüri Sertliği', 'Jury harshness')}
                  </label>
                  <span className="text-neon-red font-mono text-xs" aria-hidden="true">
                    {harshnessLabel}
                  </span>
                </div>
                <input
                  id={fieldIds.harshness}
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  aria-valuetext={`${formData.harshness}/5 — ${harshnessLabel}`}
                  value={formData.harshness}
                  onChange={(e) => setFormData({ ...formData, harshness: parseInt(e.target.value, 10) })}
                  className="w-full h-2 bg-black/50 rounded-lg appearance-none cursor-pointer accent-neon-red"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-2 px-1">
                  <span>{pickLocalized(language, 'Yapıcı', 'Mild')}</span>
                  <span>{pickLocalized(language, 'Brutal', 'Brutal')}</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span id={fieldIds.juryMode} className="block text-sm font-medium text-slate-300">
                    {pickLocalized(language, 'Jüri Modu', 'Jury mode')}
                  </span>
                  <div
                    role="group"
                    aria-labelledby={fieldIds.juryMode}
                    className="inline-flex rounded-full border border-white/10 bg-black/40 p-1 text-[10px] font-mono uppercase tracking-wider"
                  >
                    <button
                      type="button"
                      aria-pressed={juryMode === 'single'}
                      onClick={() => setJuryMode('single')}
                      className={`px-4 py-1.5 rounded-full transition-all ${juryMode === 'single' ? 'bg-white text-black font-bold' : 'text-slate-400 hover:text-white'}`}
                    >
                      {pickLocalized(language, 'Tekli', 'Single')}
                    </button>
                    <button
                      type="button"
                      aria-pressed={juryMode === 'multi'}
                      onClick={() => setJuryMode('multi')}
                      className={`px-4 py-1.5 rounded-full transition-all ${juryMode === 'multi' ? 'bg-purple-500 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                    >
                      {pickLocalized(language, 'Çoklu', 'Multi')}
                    </button>
                  </div>
                </div>

                {juryMode === 'single' ? (
                  <div className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span id={fieldIds.singlePersona} className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        {pickLocalized(language, 'Tekli Jüri Persona', 'Single-jury persona')}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveSinglePersona('left')}
                          aria-label={pickLocalized(language, 'Önceki persona', 'Previous persona')}
                          className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200 hover:bg-white/10"
                        >
                          <span aria-hidden="true">←</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSinglePersona('right')}
                          aria-label={pickLocalized(language, 'Sonraki persona', 'Next persona')}
                          className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200 hover:bg-white/10"
                        >
                          <span aria-hidden="true">→</span>
                        </button>
                      </div>
                    </div>
                    <div
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-3"
                      aria-live="polite"
                      aria-labelledby={fieldIds.singlePersona}
                      role="group"
                    >
                      <p className="text-sm font-bold text-white">{personaMap[formData.singlePersonaId]?.label}</p>
                      <p className="mt-1 text-[10px] font-mono text-slate-400">{personaMap[formData.singlePersonaId]?.detail}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span id={fieldIds.multiPersona} className="block text-sm font-medium text-slate-300">
                        {pickLocalized(language, 'Çoklu Jüri Persona Seçimi', 'Multi-jury persona selection')}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {selectedMultiPersonaIds.length}/4 {pickLocalized(language, 'seçili (min 2)', 'selected (min 2)')}
                      </span>
                    </div>
                    <div role="group" aria-labelledby={fieldIds.multiPersona} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {personaOptions.map((persona) => {
                        const selected = selectedMultiPersonaIds.includes(persona.id);
                        const disableSelect = !selected && selectedMultiPersonaIds.length >= 4;
                        const disableUnselect = selected && selectedMultiPersonaIds.length <= 2;
                        return (
                          <button
                            key={persona.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleMultiPersona(persona.id)}
                            disabled={disableSelect || disableUnselect}
                            className={`rounded-lg border px-3 py-2 text-left transition-colors ${selected ? 'border-purple-400/50 bg-purple-500/20 text-purple-100' : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'} disabled:opacity-45 disabled:cursor-not-allowed`}
                          >
                            <span className="block text-xs font-mono uppercase tracking-wider">{persona.label}</span>
                            <span className="mt-1 block text-[10px] text-slate-400 leading-relaxed">{persona.detail}</span>
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
                  {pickLocalized(
                    language,
                    'Tek çizimlik denemen tamamlandı! Daha fazla gönderi ve kayıt için hesap oluştur.',
                    "You've completed your 1-drawing trial! Create an account to submit more designs and save your work.",
                  )}
                </p>
                <button
                  type="button"
                  onClick={onAuthRequired}
                  className="w-full py-2 px-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 rounded text-amber-100 text-sm font-mono transition-colors"
                >
                  {pickLocalized(language, 'Hesap Oluştur', 'Create account')}
                </button>
              </div>
            )}

            {showTrialLowBalanceWarning && (
              <div className="mb-3 rounded-lg border border-amber-300/45 bg-amber-400/[0.12] p-3 shadow-[inset_0_0_0_1px_rgba(253,230,138,0.12)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[11px] text-amber-50">
                    {pickLocalized(
                      language,
                      'Rapido bakiyeniz azalıyor.',
                      'Your Rapido balance is running low.',
                    )}{' '}
                    <span className="font-bold">
                      {Math.max(0, rapidoPens).toFixed(1)} / {trialTotal} Rapido
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={onUpgradeClick}
                    className="text-[10px] font-mono uppercase tracking-wider text-amber-100 hover:text-white transition-colors"
                  >
                    {pickLocalized(language, "Premium'a Geç", 'Go Premium')}
                  </button>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-amber-300/90" style={{ width: `${trialPercent}%` }} />
                </div>
                <p className="mt-2 text-[10px] font-mono text-amber-100/85">
                  {pickLocalized(
                    language,
                    'Deneme limitine yaklaşıyorsunuz. Premium ile daha yüksek Rapido ve ek modlar açılır.',
                    'You are close to your trial limit. Premium unlocks higher Rapido and extra modes.',
                  )}
                </p>
              </div>
            )}

            {!isAuthenticated && (
              <div className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3">
                <p className="font-mono text-[11px] leading-relaxed text-amber-100">
                  {pickLocalized(
                    language,
                    'Analiz modları yalnızca giriş yapan kullanıcılar için açıktır. Giriş sonrası Rapido bakiyeniz hesabınızdan kullanılır.',
                    'Analysis modes are only available when signed in. After sign-in, Rapido is drawn from your account.',
                  )}
                </p>
              </div>
            )}

            {uploadValidationError && (
              <div id={uploadErrorId} role="alert" className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <p className="font-mono text-[11px] leading-relaxed text-red-200">{uploadValidationError}</p>
                <p className="mt-1 font-mono text-[10px] text-red-200/80">
                  {pickLocalized(
                    language,
                    'Gönderim kapatıldı. Yukarıdaki sorunu düzeltip dosyayı yeniden yükleyin.',
                    'Submission is blocked. Fix the issue above and upload the file again.',
                  )}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={isGuestAtLimit ? onGuestUpgradeRequired : (isAuthenticated ? handleAnalyze : onAuthRequired)}
              disabled={(isAuthenticated && (!canRunAnalysis || isFileProcessing)) || isGuestAtLimit}
              aria-describedby={uploadValidationError ? uploadErrorId : undefined}
              className={`w-full py-4 rounded-none font-mono text-[13px] font-bold uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2 mb-3 ${(canRunAnalysis && !isGuestAtLimit) || (!isAuthenticated && !isGuestAtLimit) ? 'bg-neon-red text-white shadow-[0_0_24px_rgba(255,0,51,0.35)] hover:bg-neon-red/90' : 'bg-white/[0.06] text-white/25 cursor-not-allowed'}`}
            >
              {isGuestAtLimit ? (
                pickLocalized(language, 'Misafir limiti — devam için hesap oluştur', 'Guest limit reached — create an account to continue')
              ) : isAuthenticated ? (
                isFileProcessing ? (
                  pickLocalized(language, 'Dosya işleniyor...', 'Processing file...')
                ) : uploadValidationError ? (
                  pickLocalized(language, 'Dosyayı Düzelt ve Yeniden Yükle', 'Fix the file and re-upload')
                ) : !image ? (
                  pickLocalized(language, 'Jüri Karşısına Çık — önce dosya yükle', 'Face the jury — upload a file first')
                ) : (
                  <>
                    {pickLocalized(language, 'Jüri Karşısına Çık', 'Face the jury')}{' '}
                    <span className="text-[10px] font-normal opacity-60">
                      ({isRevisionMode ? RAPIDO_COSTS.REVISION_SAME : RAPIDO_COSTS.SINGLE_JURY} Rapido)
                    </span>
                  </>
                )
              ) : (
                pickLocalized(language, 'Giriş Yap ve Analize Başla', 'Sign in and start analysis')
              )}
            </button>

            {!isRevisionMode && (
              <button
                onClick={
                  isGuestAtLimit
                    ? onGuestUpgradeRequired
                    : !isAuthenticated
                      ? onAuthRequired
                      : isPremiumUser || multiJuryPromoActive
                        ? handleMultiAnalyze
                        : onUpgradeClick
                }
                disabled={(isAuthenticated && (!canRunAnalysis || isFileProcessing)) || isGuestAtLimit}
                className={`w-full py-3 font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 border-2 ${(canRunAnalysis && !isGuestAtLimit) || (!isAuthenticated && !isGuestAtLimit) ? 'border-purple-500 text-purple-400 hover:bg-purple-500/10' : 'border-white/10 text-white/30 cursor-not-allowed'}`}
              >
                {isGuestAtLimit ? (
                  <>
                    <Layers size={18} /> {pickLocalized(language, 'Çoklu Jüri için yükselt', 'Upgrade for multi-jury')}
                  </>
                ) : isAuthenticated ? isPremiumUser || multiJuryPromoActive ? (
                  <>
                    <Layers size={18} /> {pickLocalized(language, 'Çoklu Jüri', 'Multi-jury')} ({selectedMultiPersonaIds.length}{' '}
                    {pickLocalized(language, 'persona', 'personas')}){' '}
                    <span className="text-xs font-mono opacity-70">({RAPIDO_COSTS.MULTI_JURY} Rapido)</span>
                    {!isPremiumUser && multiJuryPromoActive ? (
                      <span className="ml-1 text-[9px] font-mono uppercase text-purple-300">
                        {pickLocalized(language, 'Promo', 'Promo')}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Layers size={18} /> {pickLocalized(language, "Çoklu Jüri Premium'da", 'Multi-jury on Premium')}{' '}
                    <span className="text-xs font-mono opacity-70">({pickLocalized(language, 'Yükselt', 'Upgrade')})</span>
                  </>
                ) : (
                  <>
                    <Layers size={18} /> {pickLocalized(language, 'Çoklu Jüri için giriş yap', 'Sign in for multi-jury')}
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
                      <Lightbulb size={16} /> {pickLocalized(language, 'Konsept Analizi ve Önerisi', 'Concept analysis & proposal')}{' '}
                      <span className="opacity-70">({RAPIDO_COSTS.AUTO_CONCEPT} Rapido)</span>
                    </>
                  ) : (
                    <>
                      <Lightbulb size={16} /> {pickLocalized(language, 'Konsept analizi için giriş yap', 'Sign in for concept analysis')}
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
                      <Layers size={16} /> {pickLocalized(language, 'Malzeme Analizi', 'Material analysis')}{' '}
                      <span className="opacity-70">({RAPIDO_COSTS.MATERIAL_BOARD} Rapido)</span>
                    </>
                  ) : (
                    <>
                      <Layers size={16} /> {pickLocalized(language, "Malzeme analizi Premium'da", 'Material analysis on Premium')}{' '}
                      <span className="opacity-70">({pickLocalized(language, 'Yükselt', 'Upgrade')})</span>
                    </>
                  ) : (
                    <>
                      <Layers size={16} /> {pickLocalized(language, 'Malzeme analizi için giriş yap', 'Sign in for material analysis')}
                    </>
                  )}
                </button>
              </div>
            )}

            {!isRevisionMode && (
              <div className="mt-3 border-t border-white/10 pt-3">
                <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">
                  <span>◇</span>
                  {pickLocalized(language, 'Tasarım Denetimleri', 'Design checks')}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => isAuthenticated ? handleDesignInsight('DRAWING_CONSISTENCY') : onAuthRequired()}
                    disabled={isAuthenticated ? !canRunAnalysis : false}
                    className="min-h-20 rounded-lg border border-white/10 bg-black/20 px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-200 transition-colors hover:border-white/20 hover:bg-white/5 disabled:cursor-not-allowed disabled:text-white/30"
                  >
                    <ScanLine className="mx-auto mb-2" size={16} strokeWidth={1.5} />
                    {pickLocalized(language, 'Çizim Tutarlılığını Denetle', 'Check Drawing Consistency')}
                    <span className="mt-1 block text-neon-red">
                      ({RAPIDO_COSTS.DRAWING_CONSISTENCY} Rapido)
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => isAuthenticated ? handleDesignInsight('CIRCULATION_ADJACENCY') : onAuthRequired()}
                    disabled={isAuthenticated ? !canRunAnalysis : false}
                    className="min-h-20 rounded-lg border border-white/10 bg-black/20 px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-200 transition-colors hover:border-white/20 hover:bg-white/5 disabled:cursor-not-allowed disabled:text-white/30"
                  >
                    <Route className="mx-auto mb-2" size={16} strokeWidth={1.5} />
                    {pickLocalized(language, 'Dolaşımı Denetle', 'Check Circulation')}
                    <span className="mt-1 block text-neon-red">
                      ({RAPIDO_COSTS.CIRCULATION_ADJACENCY} Rapido)
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => isAuthenticated ? handleDesignInsight('ACCESSIBILITY_EGRESS') : onAuthRequired()}
                    disabled={isAuthenticated ? !canRunAnalysis : false}
                    className="min-h-20 rounded-lg border border-white/10 bg-black/20 px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-200 transition-colors hover:border-white/20 hover:bg-white/5 disabled:cursor-not-allowed disabled:text-white/30"
                  >
                    <Accessibility className="mx-auto mb-2" size={16} strokeWidth={1.5} />
                    {pickLocalized(language, 'Erişilebilirliği Ön Kontrol Et', 'Pre-check Accessibility')}
                    <span className="mt-1 block text-neon-red">
                      ({RAPIDO_COSTS.ACCESSIBILITY_EGRESS} Rapido)
                    </span>
                  </button>
                </div>
              </div>
            )}

            <p className="text-[10px] text-slate-500 font-mono text-center mt-3 leading-relaxed">
              {pickLocalized(
                language,
                'Projelerin, sen paylaşmayı seçmedikçe herkese açık sergilenmez.',
                'Your projects are never shown publicly unless you choose to share them.',
              )}
            </p>
          </div>
        </div>
      </motion.div>
    </>
  );
}
