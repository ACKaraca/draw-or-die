/**
 * useAnalysis.ts
 *
 * All AI analysis handlers for Draw-or-Die.
 * Reads required state from drawOrDieStore and writes results back.
 * Accepts auth context (user, profile, isPremiumUser, rapidoPens, refreshProfile)
 * so this hook is pure of auth side-effects.
 */
'use client';

import { useCallback, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { generateAIResponse } from '@/lib/ai';
import { RAPIDO_COSTS } from '@/lib/pricing';
import { reportClientError } from '@/lib/logger';
import { PremiumData, MultiPersonaData } from '@/types';
import { useDrawOrDieStore } from '@/stores/drawOrDieStore';
import { trackConversionEvent } from '@/lib/growth-tracking';
import type { UserProfile } from '@/hooks/useAuth';
import type { AppUser } from '@/hooks/useAuth';
import { account } from '@/lib/appwrite';
import { normalizeCritiqueText } from '@/lib/critique';
import { normalizeLanguage, type SupportedLanguage } from '@/lib/i18n';
import { deriveAspectRatio } from '@/lib/aspect-ratio';

const PREVIEW_MAX_BYTES = 5 * 1024 * 1024;
const PREVIEW_JPEG_QUALITIES = [0.82, 0.74, 0.66, 0.58, 0.5, 0.42];
const PREMIUM_MAX_RENDERED_PAGES = 12;
const ANALYSIS_PRESERVE_COST = 1.5;
const COMMUNITY_SHARE_CONFIRMATION_TEXT = [
  'Community paylasimi onayi',
  '',
  'Asagidaki maddeleri okudum ve onayliyorum:',
  '1) Yukledigim pafta/gorsel icin paylasim hakkina sahibim.',
  '2) Kisisel veri (telefon, e-posta, ogrenci no, imza vb.) iceren alanlari kontrol ettim.',
  '3) Topluluk kurallarini okudum, anladim ve paylasim sorumlulugunu kabul ediyorum.',
  '',
  '"Okudum, anladim ve community paylasimini onayliyorum."',
  '',
  'Devam etmek istiyor musunuz?',
].join('\n');

function pickLanguageCopy(language: SupportedLanguage, trText: string, enText: string): string {
  return language === 'en' ? enText : trText;
}

interface UseAnalysisOptions {
  user: AppUser | null;
  profile: UserProfile | null;
  isPremiumUser: boolean;
  rapidoPens: number;
  refreshProfile: () => Promise<void>;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  preferredLanguage?: SupportedLanguage;
}

type PremiumRescuePageInput = {
  page: number;
  pageLabel: string;
  sourceName: string;
  base64: string;
  mimeType: 'image/jpeg';
  previewUrl: string;
};

type PremiumRescuePreparation = {
  mainPayload: {
    imageBase64: string;
    mimeType: string;
  };
  pages: PremiumRescuePageInput[];
  additionalFiles: Array<{
    name: string;
    mimeType: string;
    base64: string;
    page: number;
    pageLabel: string;
    sourceName: string;
  }>;
};

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace('%', '').trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function clampPercent(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function toPercent(value: number): number {
  // Some models return normalized coordinates (0..1) instead of percentages.
  if (value >= 0 && value <= 1) return value * 100;
  return value;
}

function normalizePercentValue(value: unknown): number | null {
  const parsed = parseFiniteNumber(value);
  if (parsed === null) return null;
  return clampPercent(toPercent(parsed));
}

function normalizeTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function pickFlawReason(flaw: Record<string, unknown>, idx: number, language: SupportedLanguage): string {
  if (typeof flaw.reason === 'string' && flaw.reason.trim()) return flaw.reason;
  if (typeof flaw.description === 'string' && flaw.description.trim()) return flaw.description;
  if (typeof flaw.title === 'string' && flaw.title.trim()) return flaw.title;
  if (typeof flaw.issue === 'string' && flaw.issue.trim()) return flaw.issue;
  if (typeof flaw.problem === 'string' && flaw.problem.trim()) return flaw.problem;
  return `${pickLanguageCopy(language, 'Hata', 'Error')} ${idx + 1}`;
}

function parsePersonaResult(value: unknown, language: SupportedLanguage): { critique: string; score: number } {
  const fallback = {
    critique: pickLanguageCopy(language, 'Hata', 'Error'),
    score: 0,
  };
  if (!value) return fallback;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return {
        critique: String(parsed?.critique ?? fallback.critique),
        score: Number(parsed?.score ?? fallback.score),
      };
    } catch {
      return fallback;
    }
  }
  if (typeof value === 'object') {
    const parsed = value as { critique?: unknown; score?: unknown };
    return {
      critique: typeof parsed.critique === 'string' ? parsed.critique : fallback.critique,
      score: typeof parsed.score === 'number' ? parsed.score : fallback.score,
    };
  }
  return fallback;
}

function normalizePersonaNameFromId(personaId: string, language: SupportedLanguage): string {
  const map: Record<string, { tr: string; en: string }> = {
    constructive: { tr: 'Yapici Mentor', en: 'Constructive Mentor' },
    structural: { tr: 'Strukturcu', en: 'Structural Critic' },
    conceptual: { tr: 'Konseptuel', en: 'Concept Critic' },
    grumpy: { tr: 'Huysuz Juri', en: 'Brutal Critic' },
    contextualist: { tr: 'Baglamci', en: 'Context Reviewer' },
    sustainability: { tr: 'Surdurulebilirlik Uzm.', en: 'Sustainability Expert' },
  };

  if (!map[personaId]) return personaId;
  return language === 'en' ? map[personaId].en : map[personaId].tr;
}

function parseMultiJuryResult(raw: string, language: SupportedLanguage): MultiPersonaData {
  const cleaned = stripFence(raw || '');
  const parsed = safeParseJsonObject(cleaned);
  const projectTitle =
    typeof parsed.projectTitle === 'string' && parsed.projectTitle.trim()
      ? parsed.projectTitle.trim()
      : undefined;

  const fromArray = Array.isArray(parsed.personas)
    ? parsed.personas
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const data = entry as Record<string, unknown>;
        const id = typeof data.id === 'string' ? data.id.trim() : '';
        if (!id) return null;

        const persona = parsePersonaResult(data, language);
        const name =
          typeof data.name === 'string' && data.name.trim()
            ? data.name.trim()
            : normalizePersonaNameFromId(id, language);

        return {
          id,
          name,
          critique: persona.critique,
          score: persona.score,
        };
      })
      .filter((entry): entry is { id: string; name: string; critique: string; score: number } => Boolean(entry))
    : [];

  if (fromArray.length > 0) {
    const structural = fromArray.find((entry) => entry.id === 'structural');
    const conceptual = fromArray.find((entry) => entry.id === 'conceptual');
    const grumpy = fromArray.find((entry) => entry.id === 'grumpy');

    return {
      personas: fromArray,
      projectTitle,
      ...(structural ? { structural: { critique: structural.critique, score: structural.score } } : {}),
      ...(conceptual ? { conceptual: { critique: conceptual.critique, score: conceptual.score } } : {}),
      ...(grumpy ? { grumpy: { critique: grumpy.critique, score: grumpy.score } } : {}),
    };
  }

  const structural = parsePersonaResult(parsed.structural, language);
  const conceptual = parsePersonaResult(parsed.conceptual, language);
  const grumpy = parsePersonaResult(parsed.grumpy, language);

  const personas = [
    {
      id: 'structural',
      name: normalizePersonaNameFromId('structural', language),
      critique: structural.critique,
      score: structural.score,
    },
    {
      id: 'conceptual',
      name: normalizePersonaNameFromId('conceptual', language),
      critique: conceptual.critique,
      score: conceptual.score,
    },
    {
      id: 'grumpy',
      name: normalizePersonaNameFromId('grumpy', language),
      critique: grumpy.critique,
      score: grumpy.score,
    },
  ];

  return {
    personas,
    projectTitle,
    structural,
    conceptual,
    grumpy,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractBase64Only(value: string): string {
  return value.includes(',') ? value.split(',')[1] ?? '' : value;
}

function estimateBase64SizeBytes(value: string): number {
  const raw = extractBase64Only(value).replace(/\s+/g, '');
  if (!raw) return 0;

  const padding = raw.endsWith('==') ? 2 : raw.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((raw.length * 3) / 4) - padding);
}

function resizeCanvas(source: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return source;

  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasToConstrainedJpegBase64(source: HTMLCanvasElement): string | null {
  let canvas = source;

  for (let resizeAttempt = 0; resizeAttempt < 6; resizeAttempt++) {
    for (const quality of PREVIEW_JPEG_QUALITIES) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const base64 = extractBase64Only(dataUrl);
      if (estimateBase64SizeBytes(base64) <= PREVIEW_MAX_BYTES) {
        return base64;
      }
    }

    const nextWidth = Math.max(1, Math.floor(canvas.width * 0.82));
    const nextHeight = Math.max(1, Math.floor(canvas.height * 0.82));
    if (nextWidth === canvas.width && nextHeight === canvas.height) {
      break;
    }
    canvas = resizeCanvas(canvas, nextWidth, nextHeight);
  }

  return null;
}

function stripFence(value: string): string {
  return value
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(extractBase64Only(base64));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function renderPdfToJpegPages(
  bytes: Uint8Array,
  sourceName: string,
  pageStart: number,
  maxPages: number,
): Promise<PremiumRescuePageInput[]> {
  if (maxPages <= 0) return [];

  try {
    const pdfjs = await import('pdfjs-dist');
    const workerSources = getPdfWorkerSources(pdfjs.version);

    for (const workerSrc of workerSources) {
      try {
        pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
        const pdf = await pdfjs.getDocument({ data: bytes }).promise;
        const count = Math.min(pdf.numPages, maxPages);
        const pages: PremiumRescuePageInput[] = [];

        for (let pageIndex = 1; pageIndex <= count; pageIndex += 1) {
          const page = await pdf.getPage(pageIndex);
          const viewport = page.getViewport({ scale: 1.6 });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          canvas.width = Math.max(1, Math.floor(viewport.width));
          canvas.height = Math.max(1, Math.floor(viewport.height));
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;

          const jpeg = canvasToConstrainedJpegBase64(canvas) ?? extractBase64Only(canvas.toDataURL('image/jpeg', 0.72));
          const absolutePage = pageStart + pageIndex - 1;
          pages.push({
            page: absolutePage,
            pageLabel: `Pafta ${absolutePage}`,
            sourceName,
            base64: jpeg,
            mimeType: 'image/jpeg',
            previewUrl: `data:image/jpeg;base64,${jpeg}`,
          });
        }

        if (pages.length > 0) return pages;
      } catch {
        continue;
      }
    }
  } catch {
    // Intentional no-op. Fallback path will handle empty pages.
  }

  return [];
}

async function preparePremiumRescueInputs(params: {
  image: File | null;
  imageBase64: string;
  mimeType: string;
  additionalUploads: Array<{ name: string; mimeType: string; base64: string }>;
}): Promise<PremiumRescuePreparation> {
  const pages: PremiumRescuePageInput[] = [];
  let pageCursor = 1;

  const pushImagePage = (base64: string, sourceName: string) => {
    const normalizedBase64 = extractBase64Only(base64);
    pages.push({
      page: pageCursor,
      pageLabel: `Pafta ${pageCursor}`,
      sourceName,
      base64: normalizedBase64,
      mimeType: 'image/jpeg',
      previewUrl: `data:image/jpeg;base64,${normalizedBase64}`,
    });
    pageCursor += 1;
  };

  if (params.mimeType === 'application/pdf') {
    let pdfBytes: Uint8Array | null = null;
    if (params.image) {
      pdfBytes = new Uint8Array(await params.image.arrayBuffer());
    } else {
      pdfBytes = base64ToUint8Array(params.imageBase64);
    }

    const maxMainPages = Math.max(1, PREMIUM_MAX_RENDERED_PAGES - pages.length);
    const renderedMainPages = await renderPdfToJpegPages(
      pdfBytes,
      params.image?.name ?? 'ana-dosya.pdf',
      pageCursor,
      maxMainPages,
    );
    pages.push(...renderedMainPages);
    pageCursor += renderedMainPages.length;
  } else {
    pushImagePage(params.imageBase64, params.image?.name ?? 'ana-dosya');
  }

  for (const extra of params.additionalUploads) {
    if (pages.length >= PREMIUM_MAX_RENDERED_PAGES) break;

    if (extra.mimeType === 'application/pdf') {
      const remaining = PREMIUM_MAX_RENDERED_PAGES - pages.length;
      if (remaining <= 0) break;
      const bytes = base64ToUint8Array(extra.base64);
      const rendered = await renderPdfToJpegPages(bytes, extra.name, pageCursor, remaining);
      pages.push(...rendered);
      pageCursor += rendered.length;
      continue;
    }

    const jpegBase64 = extractBase64Only(extra.base64);
    pages.push({
      page: pageCursor,
      pageLabel: `Pafta ${pageCursor}`,
      sourceName: extra.name,
      base64: jpegBase64,
      mimeType: 'image/jpeg',
      previewUrl: `data:image/jpeg;base64,${jpegBase64}`,
    });
    pageCursor += 1;
  }

  const mainPayload =
    params.mimeType === 'application/pdf'
      ? {
          imageBase64: params.imageBase64,
          mimeType: params.mimeType,
        }
      : {
          imageBase64: pages[0]?.base64 ?? params.imageBase64,
          mimeType: 'image/jpeg',
        };

  const additionalFiles = pages.map((entry) => ({
    name: `${entry.sourceName}-p${entry.page}.jpg`,
    mimeType: entry.mimeType,
    base64: entry.base64,
    page: entry.page,
    pageLabel: entry.pageLabel,
    sourceName: entry.sourceName,
  }));

  return {
    mainPayload,
    pages,
    additionalFiles,
  };
}

function parseCritiqueResult(raw: string): {
  data: Record<string, unknown>;
  critique: string;
  score: number | null;
  projectTitle: string | null;
  gallerySuggestion: 'HALL_OF_FAME' | 'WALL_OF_DEATH' | 'NONE' | null;
} {
  const cleaned = stripFence(raw || '');
  const data = safeParseJsonObject(cleaned);

  const critique = normalizeCritiqueText(
    typeof data.critique === 'string' && data.critique.trim()
      ? data.critique
      : cleaned
  );

  const score = typeof data.score === 'number' ? data.score : null;
  const projectTitle =
    typeof data.projectTitle === 'string' && data.projectTitle.trim()
      ? data.projectTitle.trim().substring(0, 120)
      : null;
  const placementRaw = typeof data.galleryPlacement === 'string' ? data.galleryPlacement : null;
  const gallerySuggestion =
    placementRaw === 'HALL_OF_FAME' || placementRaw === 'WALL_OF_DEATH' || placementRaw === 'NONE'
      ? placementRaw
      : null;

  return { data, critique, score, projectTitle, gallerySuggestion };
}

function resolveGalleryPlacement(
  score: number | null,
  suggested: 'HALL_OF_FAME' | 'WALL_OF_DEATH' | 'NONE' | null
): 'HALL_OF_FAME' | 'WALL_OF_DEATH' | 'NONE' {
  if (suggested) return suggested;
  if (score === null) return 'NONE';
  if (score >= 85) return 'HALL_OF_FAME';
  if (score <= 25) return 'WALL_OF_DEATH';
  return 'NONE';
}

function getPdfWorkerSources(version: string): string[] {
  return [
    `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`,
    '/pdf.worker.min.mjs',
  ];
}

async function renderPdfFirstPageToJpegBase64(file: File): Promise<string | null> {
  try {
    const pdfjs = await import('pdfjs-dist');
    const workerSources = getPdfWorkerSources(pdfjs.version);

    const bytes = await file.arrayBuffer();
    for (const workerSrc of workerSources) {
      try {
        pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
        const pdf = await pdfjs.getDocument({ data: bytes }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.8 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));

        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.82);
        return extractBase64Only(jpegDataUrl);
      } catch {
        continue;
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function renderImageToJpegBase64(file: File): Promise<string | null> {
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('read failed'));
      reader.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image load failed'));
      el.src = dataUrl;
    });

    const maxSide = 1600;
    const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
    const width = Math.max(1, Math.floor(img.width * ratio));
    const height = Math.max(1, Math.floor(img.height * ratio));

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);
    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.82);
    return extractBase64Only(jpegDataUrl);
  } catch {
    return null;
  }
}

export function safeParseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(stripFence(value));
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function parsePremiumRescueResult(raw: unknown, language: SupportedLanguage): PremiumData {
  const fallback: PremiumData = {
    flaws: [],
    practicalSolutions: [],
    reference: pickLanguageCopy(language, 'Belirtilmedi', 'Not specified'),
  };
  if (!raw || typeof raw !== 'object') return fallback;

  const payload = raw as Record<string, unknown>;
  const rawFlaws =
    (Array.isArray(payload.flaws) && payload.flaws) ||
    (Array.isArray(payload.issues) && payload.issues) ||
    (Array.isArray(payload.criticalFlaws) && payload.criticalFlaws) ||
    (Array.isArray(payload.annotations) && payload.annotations) ||
    [];

  const flaws: PremiumData['flaws'] = rawFlaws.map((candidate, idx) => {
    const flaw = (candidate && typeof candidate === 'object' ? candidate : {}) as Record<string, unknown>;
    const bbox =
      (flaw.bbox && typeof flaw.bbox === 'object' ? flaw.bbox : null) as Record<string, unknown> | null;
    const rect =
      (flaw.rect && typeof flaw.rect === 'object' ? flaw.rect : null) as Record<string, unknown> | null;

    const x =
      normalizePercentValue(flaw.x) ??
      normalizePercentValue(flaw.left) ??
      normalizePercentValue(bbox?.x) ??
      normalizePercentValue(rect?.x) ??
      normalizePercentValue(rect?.left);
    const y =
      normalizePercentValue(flaw.y) ??
      normalizePercentValue(flaw.top) ??
      normalizePercentValue(bbox?.y) ??
      normalizePercentValue(rect?.y) ??
      normalizePercentValue(rect?.top);
    const width =
      normalizePercentValue(flaw.width) ??
      normalizePercentValue(flaw.w) ??
      normalizePercentValue(bbox?.width) ??
      normalizePercentValue(rect?.width) ??
      normalizePercentValue(rect?.w);
    const height =
      normalizePercentValue(flaw.height) ??
      normalizePercentValue(flaw.h) ??
      normalizePercentValue(bbox?.height) ??
      normalizePercentValue(rect?.height) ??
      normalizePercentValue(rect?.h);

    const page = parseFiniteNumber(flaw.page) ?? parseFiniteNumber(flaw.pageNumber) ?? parseFiniteNumber(flaw.sheet);
    const pageLabel = typeof flaw.pageLabel === 'string' && flaw.pageLabel.trim() ? flaw.pageLabel.trim() : undefined;
    const drawingGuide = typeof flaw.drawingGuide === 'string' && flaw.drawingGuide.trim() ? flaw.drawingGuide.trim() : undefined;

    if (x !== null && y !== null && width !== null && height !== null) {
      return {
        x,
        y,
        width,
        height,
        reason: pickFlawReason(flaw, idx, language),
        ...(page !== null ? { page: Math.max(1, Math.floor(page)) } : {}),
        ...(pageLabel ? { pageLabel } : {}),
        ...(drawingGuide ? { drawingGuide } : {}),
      };
    }

    // Fallback overlay placement to keep entries visible even when coords are absent.
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    return {
      x: 10 + col * 30,
      y: 10 + row * 30,
      width: 25,
      height: 20,
      reason: pickFlawReason(flaw, idx, language),
      ...(page !== null ? { page: Math.max(1, Math.floor(page)) } : {}),
      ...(pageLabel ? { pageLabel } : {}),
      ...(drawingGuide ? { drawingGuide } : {}),
    };
  });

  const practicalSolutionsCandidates = [
    normalizeTextArray(payload.practicalSolutions),
    normalizeTextArray(payload.practical_solutions),
    normalizeTextArray(payload.solutions),
  ];
  const practicalSolutions =
    practicalSolutionsCandidates.find((entries) => entries.length > 0) ?? [];

  const referenceCandidates = [
    payload.reference,
    payload.referenceProject,
    payload.referenceArchitect,
    payload.referans,
  ];
  const reference =
    referenceCandidates.find((value) => typeof value === 'string' && value.trim()) as string | undefined;

  const drawingInstructions = normalizeTextArray(payload.drawingInstructions);
  const summary = typeof payload.summary === 'string' ? payload.summary.trim() : '';

  const result: PremiumData = {
    flaws,
    practicalSolutions,
    reference: reference ?? pickLanguageCopy(language, 'Belirtilmedi', 'Not specified'),
  };

  if (drawingInstructions.length > 0) {
    result.drawingInstructions = drawingInstructions;
  }

  if (summary) {
    result.summary = summary;
  }

  return result;
}

export function useAnalysis({
  user,
  profile,
  isPremiumUser,
  rapidoPens,
  refreshProfile,
  setProfile,
  preferredLanguage,
}: UseAnalysisOptions) {
  const store = useDrawOrDieStore();
  const uiLanguage = useMemo<SupportedLanguage>(() => {
    if (preferredLanguage) return normalizeLanguage(preferredLanguage, 'tr');
    if (profile?.preferred_language) return normalizeLanguage(profile.preferred_language, 'tr');
    if (typeof window !== 'undefined') return normalizeLanguage(window.navigator.language, 'tr');
    return 'tr';
  }, [preferredLanguage, profile?.preferred_language]);

  const withLanguage = useCallback(
    (params: Record<string, unknown>) => ({
      ...params,
      language: uiLanguage,
    }),
    [uiLanguage]
  );

  const handleInsufficientRapido = useCallback(
    (cost: number, featureLabel: string) => {
      if (!isPremiumUser) {
        store.addToast(
          pickLanguageCopy(
            uiLanguage,
            `${featureLabel} için ${cost} Rapido gerekiyor. Trial limitine yaklaştın; Premium'a geçerek devam edebilirsin.`,
            `${featureLabel} requires ${cost} Rapido. You're close to the trial limit; continue with Premium.`,
          ),
          'info',
          6000
        );
        store.setStep('premium-upgrade');
        return;
      }
      store.addToast(
        pickLanguageCopy(
          uiLanguage,
          `Yeterli Rapido Kaleminiz yok! (${cost} gerekli)`,
          `Not enough Rapido pens! (${cost} required)`,
        ),
        'error'
      );
    },
    [isPremiumUser, store, uiLanguage]
  );

  const getReadyImagePayload = useCallback(
    (imageBase64: string | null, mimeType: string | null) => {
      if (!imageBase64 || !mimeType) {
        store.addToast(
          pickLanguageCopy(
            uiLanguage,
            'Dosya hala işleniyor. Lütfen birkaç saniye bekleyip tekrar deneyin.',
            'File is still processing. Please wait a few seconds and try again.',
          ),
          'info'
        );
        return null;
      }
      return { imageBase64, mimeType };
    },
    [store, uiLanguage]
  );

  const toUserErrorMessage = useCallback(
    (error: unknown, fallback?: string) => {
      const fb = fallback ?? pickLanguageCopy(uiLanguage, 'Bir hata oluştu.', 'Something went wrong.');
      if (!(error instanceof Error)) return fb;

      if (error.message.startsWith('RATE_LIMITED:')) {
        const waitSecondsRaw = Number(error.message.split(':')[1] ?? '60');
        const waitSeconds = Number.isFinite(waitSecondsRaw) ? Math.max(1, Math.ceil(waitSecondsRaw)) : 60;
        return pickLanguageCopy(
          uiLanguage,
          `Çok fazla istek gönderdin. Lütfen ${waitSeconds} sn bekleyiniz.`,
          `Too many requests. Please wait ${waitSeconds} seconds.`,
        );
      }

      if (error.message === 'MENTOR_PREMIUM_LIMIT_REACHED') {
        return pickLanguageCopy(
          uiLanguage,
          'Bu mentor sohbeti 12K limite ulaştı. 2x Rapido ile devam edebilir veya yeni sohbet açabilirsin.',
          'This mentor chat hit the 12K limit. Continue with 2× Rapido or open a new chat.',
        );
      }

      if (error.message === 'CHAT_TOKEN_LIMIT_REACHED') {
        return pickLanguageCopy(
          uiLanguage,
          'Bu mentor sohbetinin token limiti doldu. Yeni sohbet açmalısın.',
          'This mentor chat reached its token limit. Open a new chat.',
        );
      }

      return error.message || fb;
    },
    [uiLanguage],
  );

  // -------------------------------------------------------------------------
  // applyGameState — mirrors Edge Function's DB updates into local profile
  // -------------------------------------------------------------------------
  const applyGameState = useCallback(
    (gameState: NonNullable<Awaited<ReturnType<typeof generateAIResponse>>>['game_state']) => {
      if (!gameState) return;
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              progression_score: gameState.progression_score,
              wall_of_death_count: gameState.wall_of_death_count,
              earned_badges: gameState.earned_badges,
            }
          : null
      );
      for (const badge of gameState.new_badges ?? []) {
        setTimeout(
          () => store.addToast(`🏆 YENİ ROZET: ${badge.name}`, 'badge', 6000),
          800
        );
      }
    },
    [setProfile, store]
  );

  const buildGalleryPreviewPayload = useCallback(async () => {
    const { image, imageBase64, mimeType } = store;
    if (!imageBase64 || !mimeType) return null;

    if (mimeType === 'application/pdf' && image) {
      const firstPageJpeg = await renderPdfFirstPageToJpegBase64(image);
      if (firstPageJpeg) {
        const ratio = await new Promise<number>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(deriveAspectRatio(img.naturalWidth, img.naturalHeight));
          img.onerror = () => resolve(0.75);
          img.src = `data:image/jpeg;base64,${firstPageJpeg}`;
        });
        return {
          imageBase64: firstPageJpeg,
          mimeType: 'image/jpeg',
          aspectRatio: ratio,
        };
      }
    }

    if (mimeType.startsWith('image/') && image) {
      const optimizedJpeg = await renderImageToJpegBase64(image);
      if (optimizedJpeg) {
        const ratio = await new Promise<number>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(deriveAspectRatio(img.naturalWidth, img.naturalHeight));
          img.onerror = () => resolve(0.75);
          img.src = `data:image/jpeg;base64,${optimizedJpeg}`;
        });
        return {
          imageBase64: optimizedJpeg,
          mimeType: 'image/jpeg',
          aspectRatio: ratio,
        };
      }
    }

    return {
      imageBase64,
      mimeType,
      aspectRatio: 0.75,
    };
  }, [store]);

  const submitGalleryItem = useCallback(
    async (
      galleryType: 'HALL_OF_FAME' | 'WALL_OF_DEATH' | 'COMMUNITY',
      options?: { autoApproved?: boolean; title?: string; juryQuote?: string; analysisKind?: string }
    ) => {
      if (!user?.id) {
        store.addToast('Galeriye eklemek için giriş yapmalısınız.', 'error');
        return false;
      }

      const title = options?.title || store.formData.topic || 'İsimsiz Proje';
      const juryQuote = options?.juryQuote || (
        store.critique
          ? normalizeCritiqueText(store.critique).substring(0, 1200)
          : 'Jüri yorumu bulunamadı.'
      );

      const previewPayload = await buildGalleryPreviewPayload();
      if (!previewPayload) {
        store.addToast('Galeri önizlemesi hazırlanamadı.', 'error');
        return false;
      }

      try {
        const jwt = await account.createJWT();
        const response = await fetch('/api/gallery', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt.jwt}`,
          },
          body: JSON.stringify({
            title,
            juryQuote,
            galleryType,
            imageBase64: previewPayload.imageBase64,
            mimeType: previewPayload.mimeType,
            aspectRatio: previewPayload.aspectRatio,
            autoApproved: Boolean(options?.autoApproved),
            analysisKind: options?.analysisKind ?? store.latestAnalysisKind ?? 'SINGLE_JURY',
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          console.error('[gallery] API insert failed:', payload);
          store.addToast('Galeri kaydedilirken hata oluştu.', 'error');
          return false;
        }

        const payload = await response.json() as {
          item?: {
            id: string;
            img: string;
            title: string;
            jury: string;
            type: 'HALL_OF_FAME' | 'WALL_OF_DEATH';
            analysisKind?: string;
          };
        };

        if (payload.item) {
          store.setGalleryItems((prev) => [
            {
              ...payload.item!,
              analysisKind: payload.item?.analysisKind ?? 'SINGLE_JURY',
            },
            ...prev,
          ]);
        }

        store.addToast(galleryType === 'COMMUNITY' ? 'Community paylasimi tamamlandi!' : 'Proje galeriye eklendi!', 'success');
        return true;
      } catch (err) {
        console.error('[gallery] Unexpected error:', err);
        store.addToast('Galeri kaydedilirken hata oluştu.', 'error');
        return false;
      }
    },
    [buildGalleryPreviewPayload, store, user]
  );

  const handleShareToCommunity = useCallback(async () => {
    if (!user?.id) {
      store.addToast('Community paylasimi icin giris yapmalisiniz.', 'error');
      store.setIsAuthModalOpen(true);
      return false;
    }

    if (typeof window !== 'undefined') {
      const approved = window.confirm(COMMUNITY_SHARE_CONFIRMATION_TEXT);
      if (!approved) {
        store.addToast('Community paylasimi onaylanmadi.', 'info');
        return false;
      }
    }

    const analysisKind = (store.latestAnalysisKind ?? 'SINGLE_JURY').toUpperCase();
    const title = (store.formData.topic || 'Isimsiz Proje').substring(0, 120);

    let juryQuote = normalizeCritiqueText(store.critique ?? '').trim();

    if (!juryQuote && analysisKind === 'MULTI_JURY' && store.multiData?.personas?.length) {
      juryQuote = normalizeCritiqueText(
        store.multiData.personas
          .map((persona, index) => `${index + 1}. ${persona.name}: ${persona.critique}`)
          .join('\n\n'),
      );
    }

    if (!juryQuote && analysisKind === 'PREMIUM_RESCUE' && store.premiumData) {
      juryQuote = normalizeCritiqueText(
        store.premiumData.summary || [
          store.premiumData.flaws.length > 0
            ? `Tespit edilen sorunlar:\n${store.premiumData.flaws.map((entry, idx) => `${idx + 1}. ${entry.reason}`).join('\n')}`
            : '',
          store.premiumData.practicalSolutions.length > 0
            ? `Pratik cozumler:\n${store.premiumData.practicalSolutions.map((entry, idx) => `${idx + 1}. ${entry}`).join('\n')}`
            : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
      );
    }

    if (!juryQuote) {
      juryQuote = 'Topluluga acik pafta paylasimi.';
    }

    return submitGalleryItem('COMMUNITY', {
      autoApproved: true,
      title,
      juryQuote: juryQuote.substring(0, 1200),
      analysisKind,
    });
  }, [store, submitGalleryItem, user]);

  const handlePreserveAnalysis = useCallback(async () => {
    if (!user?.id) {
      store.addToast('Analizi korumak için giriş yapmalısınız.', 'error');
      store.setIsAuthModalOpen(true);
      return;
    }

    const sourceBase64 = (store.imageBase64 ?? '').trim();
    const sourceMimeType = (store.mimeType ?? 'image/jpeg').trim() || 'image/jpeg';
    if (!sourceBase64) {
      store.addToast('Korunacak pafta verisi bulunamadı. Lütfen analizi tekrar üretin.', 'error');
      return;
    }

    const analysisKind = (store.latestAnalysisKind ?? 'SINGLE_JURY').toUpperCase();
    const galleryType = store.galleryPlacement;
    const titleBase = store.formData.topic || 'Isimsiz Proje';

    let critiquePayload = '';
    let scorePayload: number | null = null;

    if (analysisKind === 'MULTI_JURY' && store.multiData) {
      const personas = Array.isArray(store.multiData.personas) ? store.multiData.personas : [];
      const structuredHistory = {
        mode: 'MULTI_JURY',
        projectTitle: store.multiData.projectTitle || titleBase,
        personas,
      };
      critiquePayload = JSON.stringify(structuredHistory);
      const scores = personas.map((entry) => Number(entry.score) || 0);
      scorePayload = scores.length > 0
        ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
        : null;
    } else if (analysisKind === 'PREMIUM_RESCUE' && store.premiumData) {
      critiquePayload = normalizeCritiqueText(
        store.premiumData.summary || [
          store.premiumData.flaws.length > 0
            ? `Tespit edilen sorunlar:\n${store.premiumData.flaws.map((entry, idx) => `${idx + 1}. ${entry.reason}`).join('\n')}`
            : '',
          store.premiumData.practicalSolutions.length > 0
            ? `Pratik cozumler:\n${store.premiumData.practicalSolutions.map((entry, idx) => `${idx + 1}. ${entry}`).join('\n')}`
            : '',
        ]
          .filter(Boolean)
          .join('\n\n')
      );
      scorePayload = null;
    } else {
      critiquePayload = normalizeCritiqueText(store.critique || '');
      scorePayload = null;
    }

    if (!critiquePayload) {
      store.addToast('Korunacak analiz içeriği bulunamadı.', 'error');
      return;
    }

    try {
      const jwt = await account.createJWT();
      const response = await fetch('/api/analysis-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt.jwt}`,
        },
        body: JSON.stringify({
          preserveMode: true,
          title: titleBase,
          critique: critiquePayload,
          score: scorePayload,
          galleryType,
          analysisKind,
          sourceBase64,
          sourceMimeType,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        required?: number;
        available?: number;
        rapido_remaining?: number;
      };

      if (!response.ok) {
        if (payload.code === 'INSUFFICIENT_RAPIDO') {
          store.addToast(
            `Yetersiz Rapido. Gerekli: ${payload.required ?? ANALYSIS_PRESERVE_COST}, Mevcut: ${payload.available ?? 0}`,
            'error',
          );
          return;
        }

        throw new Error(payload.error || 'Analiz korunamadı.');
      }

      store.addToast(
        `Analiz korundu. ${ANALYSIS_PRESERVE_COST} Rapido dusuldu. Kalan: ${payload.rapido_remaining ?? '-'} Rapido`,
        'success',
      );
      await refreshProfile();
    } catch (error) {
      console.error('[history] preserve failed:', error);
      store.addToast(error instanceof Error ? error.message : 'Analiz korunamadı.', 'error');
    }
  }, [refreshProfile, store, user]);

  // -------------------------------------------------------------------------
  // handleGalleryConsent
  // -------------------------------------------------------------------------
  const handleGalleryConsent = useCallback(
    async (consent: boolean) => {
      store.setGalleryConsent(consent);
      if (consent && store.galleryPlacement !== 'NONE') {
        const galleryType = store.galleryPlacement as 'HALL_OF_FAME' | 'WALL_OF_DEATH';
        await submitGalleryItem(galleryType, { autoApproved: true });
      }
    },
    [store, submitGalleryItem]
  );

  // -------------------------------------------------------------------------
  // handleAnalyze — SINGLE_JURY or REVISION_SAME
  // -------------------------------------------------------------------------
  const handleAnalyze = useCallback(async () => {
    const { imageBase64, mimeType, formData, pdfText, isRevisionMode, previousProject, additionalUploads } = store;
    const readyPayload = getReadyImagePayload(imageBase64, mimeType);
    if (!readyPayload) return;
    const { imageBase64: readyImageBase64, mimeType: readyMimeType } = readyPayload;
    const additionalFiles = (additionalUploads ?? []).map((entry) => ({
      name: entry.name,
      mimeType: entry.mimeType,
      base64: entry.base64,
    }));

    if (!user) {
      store.addToast('Jüriye çıkmak için lütfen giriş yapın.', 'error');
      store.setIsAuthModalOpen(true);
      return;
    }

    if (isRevisionMode && previousProject) {
      if (rapidoPens < RAPIDO_COSTS.REVISION_SAME) {
        handleInsufficientRapido(RAPIDO_COSTS.REVISION_SAME, 'Revizyon analizi');
        return;
      }
    } else {
      if (rapidoPens < RAPIDO_COSTS.SINGLE_JURY) {
        handleInsufficientRapido(RAPIDO_COSTS.SINGLE_JURY, 'Jüri analizi');
        return;
      }
    }

    void trackConversionEvent('critique_started', {
      type: isRevisionMode && previousProject ? 'revision' : 'standard',
      isPremium: isPremiumUser,
    });
    store.setStep('analyzing');

    try {
      if (isRevisionMode && previousProject) {
        const aiResponse = await generateAIResponse({
          locale: uiLanguage,
          operation: 'REVISION_SAME',
          imageBase64: readyImageBase64,
          imageMimeType: readyMimeType,
          params: withLanguage({
            category: formData.category,
            topic: formData.topic,
            concept: formData.concept,
            defense: formData.defense,
            personaId: formData.singlePersonaId,
            harshness: formData.harshness,
            analysisLength: formData.analysisLength,
            pdfText: pdfText?.substring(0, 1000),
            previousCritique: previousProject.critique,
            additionalFiles,
          }),
        });

        if (aiResponse) {
          const { data, critique, score, projectTitle, gallerySuggestion } = parseCritiqueResult(aiResponse.result);
          applyGameState(aiResponse.game_state);
          await refreshProfile();

          if (projectTitle && (!formData.topic || /^isimsiz/i.test(formData.topic.trim()))) {
            store.setFormData({
              ...formData,
              topic: projectTitle,
            });
          }

          store.setLastProgression(typeof data.progressionScore === 'number' ? data.progressionScore : null);
          store.setCritique(critique);

          const placement = resolveGalleryPlacement(score, gallerySuggestion);
          store.setGalleryPlacement(placement);
          store.setGalleryConsent(null);
          const previewPayload = await buildGalleryPreviewPayload();
          store.setPreviousProject({
            imageBase64: previewPayload?.imageBase64 ?? readyImageBase64,
            mimeType: previewPayload?.mimeType ?? readyMimeType,
            critique,
          });
          store.setStep('result');
          void trackConversionEvent('critique_completed', {
            type: 'revision',
            isPremium: isPremiumUser,
          });

          store.setLatestAnalysisKind(isRevisionMode ? 'REVISION_SAME' : 'SINGLE_JURY');

          if (!isPremiumUser && placement !== 'NONE') {
            store.setGalleryConsent(true);
            void submitGalleryItem(placement, { autoApproved: true });
          }

          if (data.isSameProject) {
            if ((typeof data.progressionScore === 'number' ? data.progressionScore : 0) > 50) {
              confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#10B981', '#ffffff'] });
            }
          } else {
            store.setLastProgression(null);
            store.addToast(
              `Jüri Notu: Yüklediğin pafta öncekiyle alakasız görünüyor. Bu yüzden yeni proje olarak değerlendirildi ve ${RAPIDO_COSTS.REVISION_DIFFERENT} Rapido kesildi.`,
              'info',
              7000
            );
          }
        } else {
          store.addToast('Jüri sessiz kaldı. Tekrar dene.', 'error');
          store.setStep('upload');
        }
      } else {
        // SINGLE_JURY
        const aiResponse = await generateAIResponse({
          locale: uiLanguage,
          operation: 'SINGLE_JURY',
          imageBase64: readyImageBase64,
          imageMimeType: readyMimeType,
          params: withLanguage({
            category: formData.category,
            topic: formData.topic,
            concept: formData.concept,
            defense: formData.defense,
            personaId: formData.singlePersonaId,
            harshness: formData.harshness,
            analysisLength: formData.analysisLength,
            pdfText: pdfText?.substring(0, 1000),
            additionalFiles,
          }),
        });

        if (aiResponse) {
          const { critique, score, projectTitle, gallerySuggestion } = parseCritiqueResult(aiResponse.result);
          applyGameState(aiResponse.game_state);
          await refreshProfile();

          if (projectTitle && (!formData.topic || /^isimsiz/i.test(formData.topic.trim()))) {
            store.setFormData({
              ...formData,
              topic: projectTitle,
            });
          }

          store.setLastProgression(null);
          store.setCritique(critique);

          const placement = resolveGalleryPlacement(score, gallerySuggestion);
          store.setGalleryPlacement(placement);
          store.setGalleryConsent(null);
          const previewPayload = await buildGalleryPreviewPayload();
          store.setPreviousProject({
            imageBase64: previewPayload?.imageBase64 ?? readyImageBase64,
            mimeType: previewPayload?.mimeType ?? readyMimeType,
            critique,
          });
          store.setStep('result');
          void trackConversionEvent('critique_completed', {
            type: 'standard',
            isPremium: isPremiumUser,
          });

          store.setLatestAnalysisKind('SINGLE_JURY');

          if (!isPremiumUser && placement !== 'NONE') {
            store.setGalleryConsent(true);
            void submitGalleryItem(placement, { autoApproved: true });
          }
        } else {
          store.addToast('Jüri sessiz kaldı. Tekrar dene.', 'error');
          store.setStep('upload');
        }
      }
    } catch (error) {
      console.error(error);
      void reportClientError({
        scope: 'analysis.single_or_revision',
        message: 'Analysis request failed',
        details: {
          operation: isRevisionMode ? 'REVISION_SAME' : 'SINGLE_JURY',
          error: error instanceof Error ? error.message : String(error),
        },
      });
      store.addToast(toUserErrorMessage(error), 'error');
      store.setStep('upload');
    }
  }, [
    store,
    user,
    rapidoPens,
    isPremiumUser,
    refreshProfile,
    applyGameState,
    handleInsufficientRapido,
    getReadyImagePayload,
    toUserErrorMessage,
    buildGalleryPreviewPayload,
    submitGalleryItem,
    withLanguage,
  ]);

  // -------------------------------------------------------------------------
  // handleMultiAnalyze — MULTI_JURY (Premium)
  // -------------------------------------------------------------------------
  const handleMultiAnalyze = useCallback(async () => {
    const { imageBase64, mimeType, additionalUploads, formData, pdfText } = store;
    const readyPayload = getReadyImagePayload(imageBase64, mimeType);
    if (!readyPayload) return;
    const { imageBase64: readyImageBase64, mimeType: readyMimeType } = readyPayload;
    const additionalFiles = (additionalUploads ?? []).map((entry) => ({
      name: entry.name,
      mimeType: entry.mimeType,
      base64: entry.base64,
    }));
    const personaIds = Array.from(new Set(Array.isArray(formData.multiPersonaIds) ? formData.multiPersonaIds : []));

    if (personaIds.length < 2 || personaIds.length > 4) {
      store.addToast('Çoklu jüri için en az 2, en fazla 4 persona seçmelisin.', 'info');
      return;
    }

    if (!isPremiumUser) {
      store.addToast('Çoklu Jüri analizi Premium üyelere özeldir!', 'error');
      return;
    }
    if (rapidoPens < RAPIDO_COSTS.MULTI_JURY) {
      store.addToast(
        `Yeterli Rapido Kaleminiz yok! (Çoklu Jüri analizi ${RAPIDO_COSTS.MULTI_JURY} Rapido gerektirir)`,
        'error'
      );
      return;
    }

    void trackConversionEvent('critique_started', {
      type: 'multi',
      isPremium: isPremiumUser,
    });
    store.setStep('multi-analyzing');

    try {
      const aiResponse = await generateAIResponse({
        locale: uiLanguage,
        operation: 'MULTI_JURY',
        imageBase64: readyImageBase64,
        imageMimeType: readyMimeType,
        params: withLanguage({
          category: formData.category,
          topic: formData.topic,
          site: formData.site,
          concept: formData.concept,
          defense: formData.defense,
          personaIds,
          harshness: formData.harshness,
          analysisLength: formData.analysisLength,
          pdfText: pdfText?.substring(0, 1000),
          additionalFiles,
        }),
      });

      if (aiResponse) {
        const multiData = parseMultiJuryResult(aiResponse.result, uiLanguage);
        const scores = multiData.personas.map((entry) => Number(entry.score) || 0);
        const averagedScore = scores.length > 0
          ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
          : null;
        const structuredHistory = {
          mode: 'MULTI_JURY',
          projectTitle: multiData.projectTitle || formData.topic || 'Isimsiz Proje',
          personas: multiData.personas,
        };

        store.setMultiData(multiData);
        await refreshProfile();

        if (multiData.projectTitle && (!formData.topic || /^isimsiz/i.test(formData.topic.trim()))) {
          store.setFormData({
            ...formData,
            topic: multiData.projectTitle,
          });
        }

        store.setLatestAnalysisKind('MULTI_JURY');

        store.setStep('multi-result');
        void trackConversionEvent('critique_completed', {
          type: 'multi',
          isPremium: isPremiumUser,
        });
      } else {
        store.addToast('Jürilerden geçerli bir yanıt alınamadı. Tekrar deneyin.', 'error');
        store.setStep('upload');
      }
    } catch (e) {
      console.error(e);
      const errorMessage = toUserErrorMessage(e, 'Jüriler toplanamadı.');
      void reportClientError({
        scope: 'analysis.multi_jury',
        message: 'Multi jury request failed',
        details: {
          error: errorMessage,
        },
      });

      if (errorMessage === 'PREMIUM_REQUIRED') {
        store.addToast('Çoklu Jüri analizi Premium üyelere özeldir!', 'error');
      } else if (errorMessage.startsWith('INSUFFICIENT_RAPIDO')) {
        store.addToast(
          `Yeterli Rapido Kaleminiz yok! (Çoklu Jüri analizi ${RAPIDO_COSTS.MULTI_JURY} Rapido gerektirir)`,
          'error'
        );
      } else {
        store.addToast(errorMessage || 'Jüriler toplanamadı.', 'error');
      }

      store.setStep('upload');
    }
  }, [store, isPremiumUser, rapidoPens, refreshProfile, getReadyImagePayload, toUserErrorMessage, withLanguage, uiLanguage]);

  // -------------------------------------------------------------------------
  // handlePremium — PREMIUM_RESCUE
  // -------------------------------------------------------------------------
  const handlePremium = useCallback(async () => {
    const { image, imageBase64, mimeType, formData, pdfText, additionalUploads } = store;
    const readyPayload = getReadyImagePayload(imageBase64, mimeType);
    if (!readyPayload) return;
    const { imageBase64: readyImageBase64, mimeType: readyMimeType } = readyPayload;

    if (rapidoPens < RAPIDO_COSTS.PREMIUM_RESCUE) {
      handleInsufficientRapido(RAPIDO_COSTS.PREMIUM_RESCUE, 'Premium analiz');
      return;
    }

    const premiumPrepared = await preparePremiumRescueInputs({
      image,
      imageBase64: readyImageBase64,
      mimeType: readyMimeType,
      additionalUploads: (additionalUploads ?? []).map((entry) => ({
        name: entry.name,
        mimeType: entry.mimeType,
        base64: entry.base64,
      })),
    });

    void trackConversionEvent('critique_started', {
      type: 'premium',
      isPremium: isPremiumUser,
    });
    store.setStep('premium-analyzing');

    try {
      const aiResponse = await generateAIResponse({
        locale: uiLanguage,
        operation: 'PREMIUM_RESCUE',
        imageBase64: premiumPrepared.mainPayload.imageBase64,
        imageMimeType: premiumPrepared.mainPayload.mimeType,
        params: withLanguage({
          category: formData.category,
          topic: formData.topic,
          site: formData.site,
          concept: formData.concept,
          analysisLength: formData.analysisLength,
          pdfText: pdfText?.substring(0, 1000),
          additionalFiles: premiumPrepared.additionalFiles,
          pageTemplate: premiumPrepared.pages.map((entry) => ({
            page: entry.page,
            pageLabel: entry.pageLabel,
            sourceName: entry.sourceName,
          })),
        }),
      });

      if (aiResponse) {
        const raw = safeParseJsonObject(aiResponse.result);
        const data = parsePremiumRescueResult(raw, uiLanguage);
        if (premiumPrepared.pages.length > 0) {
          data.pages = premiumPrepared.pages.map((entry) => ({
            page: entry.page,
            pageLabel: entry.pageLabel,
            previewUrl: entry.previewUrl,
            mimeType: entry.mimeType,
            sourceName: entry.sourceName,
          }));
        }
        if (data.flaws.length > 0 || data.practicalSolutions.length > 0) {
          const historyCritique = normalizeCritiqueText(
            data.summary || [
              data.flaws.length > 0
                ? `Tespit edilen sorunlar:\n${data.flaws.map((entry, idx) => `${idx + 1}. ${entry.reason}`).join('\n')}`
                : '',
              data.practicalSolutions.length > 0
                ? `Pratik cozumler:\n${data.practicalSolutions.map((entry, idx) => `${idx + 1}. ${entry}`).join('\n')}`
                : '',
            ]
              .filter(Boolean)
              .join('\n\n')
          );

          store.setPremiumData(data);
          store.setLatestAnalysisKind('PREMIUM_RESCUE');
          store.setStep('premium');
          void trackConversionEvent('critique_completed', {
            type: 'premium',
            isPremium: isPremiumUser,
          });
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#FF0033', '#ffffff', '#0A0F1A'],
          });
        } else {
          store.addToast('Analiz başarısız oldu.', 'error');
          store.setStep('result');
        }
      } else {
        store.addToast('Analiz başarısız oldu.', 'error');
        store.setStep('result');
      }
    } catch (error) {
      console.error(error);
      void reportClientError({
        scope: 'analysis.premium_rescue',
        message: 'Premium rescue request failed',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
      store.addToast(toUserErrorMessage(error), 'error');
      store.setStep('result');
    }
  }, [store, rapidoPens, isPremiumUser, handleInsufficientRapido, getReadyImagePayload, toUserErrorMessage, withLanguage]);

  // -------------------------------------------------------------------------
  // handleAutoConcept — AUTO_CONCEPT
  // -------------------------------------------------------------------------
  const handleAutoConcept = useCallback(async () => {
    const { imageBase64, mimeType, additionalUploads, formData } = store;
    const readyPayload = getReadyImagePayload(imageBase64, mimeType);
    if (!readyPayload) return;
    const { imageBase64: readyImageBase64, mimeType: readyMimeType } = readyPayload;
    const additionalFiles = (additionalUploads ?? []).map((entry) => ({
      name: entry.name,
      mimeType: entry.mimeType,
      base64: entry.base64,
    }));

    if (rapidoPens < RAPIDO_COSTS.AUTO_CONCEPT) {
      handleInsufficientRapido(RAPIDO_COSTS.AUTO_CONCEPT, 'Konsept üretimi');
      return;
    }

    void trackConversionEvent('critique_started', {
      type: 'auto_concept',
      isPremium: isPremiumUser,
    });
    store.setStep('analyzing');

    try {
      const aiResponse = await generateAIResponse({
        locale: uiLanguage,
        operation: 'AUTO_CONCEPT',
        imageBase64: readyImageBase64,
        imageMimeType: readyMimeType,
        params: withLanguage({
          analysisLength: formData.analysisLength,
          additionalFiles,
        }),
      });

      if (aiResponse) {
        const data = safeParseJsonObject(aiResponse.result);
        const critiqueText = normalizeCritiqueText(typeof data.critique === 'string' ? data.critique : '');
        await refreshProfile();
        store.setLastProgression(null);
        store.setCritique(critiqueText);
        store.setGalleryPlacement('NONE');
        store.setGalleryConsent(null);
        store.setPreviousProject(null);

        store.setLatestAnalysisKind('AUTO_CONCEPT');

        store.setStep('result');
        void trackConversionEvent('critique_completed', {
          type: 'auto_concept',
          isPremium: isPremiumUser,
        });
      } else {
        store.addToast('İlham gelmedi. Tekrar dene.', 'error');
        store.setStep('upload');
      }
    } catch (error) {
      console.error(error);
      void reportClientError({
        scope: 'analysis.auto_concept',
        message: 'Auto concept request failed',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
      store.addToast(toUserErrorMessage(error), 'error');
      store.setStep('upload');
    }
  }, [store, rapidoPens, isPremiumUser, refreshProfile, handleInsufficientRapido, getReadyImagePayload, toUserErrorMessage, withLanguage]);

  // -------------------------------------------------------------------------
  // handleMaterialBoard — MATERIAL_BOARD (Premium)
  // -------------------------------------------------------------------------
  const handleMaterialBoard = useCallback(async () => {
    const { imageBase64, mimeType, additionalUploads, formData } = store;
    const readyPayload = getReadyImagePayload(imageBase64, mimeType);
    if (!readyPayload) return;
    const { imageBase64: readyImageBase64, mimeType: readyMimeType } = readyPayload;
    const additionalFiles = (additionalUploads ?? []).map((entry) => ({
      name: entry.name,
      mimeType: entry.mimeType,
      base64: entry.base64,
    }));

    if (!isPremiumUser) {
      store.addToast('Malzeme Paftası Analizi Premium üyelere özeldir!', 'error');
      return;
    }
    if (rapidoPens < RAPIDO_COSTS.MATERIAL_BOARD) {
      handleInsufficientRapido(RAPIDO_COSTS.MATERIAL_BOARD, 'Malzeme analizi');
      return;
    }

    void trackConversionEvent('critique_started', {
      type: 'material_board',
      isPremium: isPremiumUser,
    });
    store.setStep('analyzing');

    try {
      const aiResponse = await generateAIResponse({
        locale: uiLanguage,
        operation: 'MATERIAL_BOARD',
        imageBase64: readyImageBase64,
        imageMimeType: readyMimeType,
        params: withLanguage({
          analysisLength: formData.analysisLength,
          additionalFiles,
        }),
      });

      if (aiResponse) {
        const data = safeParseJsonObject(aiResponse.result);
        const critiqueText = normalizeCritiqueText(typeof data.critique === 'string' ? data.critique : '');
        await refreshProfile();
        store.setLastProgression(null);
        store.setCritique(critiqueText);
        store.setGalleryPlacement('NONE');
        store.setGalleryConsent(null);
        store.setPreviousProject(null);

        store.setLatestAnalysisKind('MATERIAL_BOARD');

        store.setStep('result');
        void trackConversionEvent('critique_completed', {
          type: 'material_board',
          isPremium: isPremiumUser,
        });
      } else {
        store.addToast('Analiz başarısız oldu.', 'error');
        store.setStep('upload');
      }
    } catch (error) {
      console.error(error);
      void reportClientError({
        scope: 'analysis.material_board',
        message: 'Material board request failed',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
      store.addToast(toUserErrorMessage(error), 'error');
      store.setStep('upload');
    }
  }, [store, isPremiumUser, rapidoPens, refreshProfile, handleInsufficientRapido, getReadyImagePayload, toUserErrorMessage, withLanguage]);

  // -------------------------------------------------------------------------
  // handleDefenseSubmit — DEFENSE (Premium, up to 3 turns)
  // -------------------------------------------------------------------------
  const handleDefenseSubmit = useCallback(async () => {
    const { defenseInput, isDefenseLoading, defenseTurnCount, defenseMessages, critique, formData } = store;
    if (!defenseInput.trim() || isDefenseLoading) return;

    if (!isPremiumUser) {
      store.addToast('Jüri Savunması Premium üyelere özeldir!', 'error');
      return;
    }
    if (defenseTurnCount === 0 && rapidoPens < RAPIDO_COSTS.DEFENSE) {
      handleInsufficientRapido(RAPIDO_COSTS.DEFENSE, 'Jüri savunması');
      return;
    }

    if (defenseTurnCount >= 3) {
      store.addToast('Jüri ile en fazla 3 tur tartışabilirsiniz!', 'info');
      return;
    }

    const newUserMsg = { role: 'user' as const, text: defenseInput };
    store.setDefenseMessages((prev) => [...prev, newUserMsg]);
    store.setDefenseInput('');
    store.setIsDefenseLoading(true);

    try {
      const defenseStudentLabel = pickLanguageCopy(uiLanguage, 'Öğrenci', 'Student');
      const defenseJuryLabel = pickLanguageCopy(uiLanguage, 'Jüri', 'Jury');
      let chatHistoryText = defenseMessages
        .map((m) => `${m.role === 'user' ? defenseStudentLabel : defenseJuryLabel}: ${m.text}`)
        .join('\n');
      chatHistoryText += `\n${defenseStudentLabel}: ${newUserMsg.text}`;

      const aiResponse = await generateAIResponse({
        locale: uiLanguage,
        operation: 'DEFENSE',
        params: withLanguage({
          critique,
          userMessage: newUserMsg.text,
          chatHistory: chatHistoryText,
          turnCount: defenseTurnCount,
          harshness: formData.harshness,
        }),
      });

      if (aiResponse) {
        const data = safeParseJsonObject(aiResponse.result);
        store.setDefenseMessages((prev) => [
          ...prev,
          {
            role: 'jury',
            text: typeof data.juryResponse === 'string'
              ? data.juryResponse
              : pickLanguageCopy(uiLanguage, 'Jüri cevap veremedi.', 'The jury could not respond.'),
          },
        ]);

        if (defenseTurnCount === 2) {
          applyGameState(aiResponse.game_state);
          await refreshProfile();

          const scoreChange = typeof data.scoreChange === 'number' ? data.scoreChange : 0;
          if (scoreChange !== 0) {
            store.setLastProgression(scoreChange);
            if (scoreChange > 0) {
              confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#10B981', '#ffffff'] });
              store.addToast(`Jüriyi ikna ettin! +${scoreChange} Puan!`, 'success');
            } else {
              store.addToast(`Jüri ikna olmadı... ${scoreChange} Puan!`, 'info');
            }
          }
        }
        store.setDefenseTurnCount((prev) => prev + 1);
      }
    } catch (e) {
      console.error(e);
      void reportClientError({
        scope: 'analysis.defense',
        message: 'Defense request failed',
        details: {
          error: e instanceof Error ? e.message : String(e),
          turnCount: defenseTurnCount,
        },
      });
      store.addToast(toUserErrorMessage(e, 'Savunma iletilemedi.'), 'error');
    } finally {
      store.setIsDefenseLoading(false);
    }
  }, [store, isPremiumUser, rapidoPens, refreshProfile, applyGameState, handleInsufficientRapido, toUserErrorMessage, withLanguage]);

  return {
    handleAnalyze,
    handleMultiAnalyze,
    handlePremium,
    handleAutoConcept,
    handleMaterialBoard,
    handleDefenseSubmit,
    handleGalleryConsent,
    handlePreserveAnalysis,
    handleShareToCommunity,
  };
}
