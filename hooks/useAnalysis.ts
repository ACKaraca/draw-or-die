/**
 * useAnalysis.ts
 *
 * All AI analysis handlers for Draw-or-Die.
 * Reads required state from drawOrDieStore and writes results back.
 * Accepts auth context (user, profile, isPremiumUser, rapidoPens, refreshProfile)
 * so this hook is pure of auth side-effects.
 */
'use client';

import { useCallback, useMemo, useRef } from 'react';
import type confetti from 'canvas-confetti';
import { generateAIResponse } from '@/lib/ai';
import { HISTORY_RAPIDO_COSTS, RAPIDO_COSTS } from '@/lib/pricing';
import { reportClientError } from '@/lib/logger';
import type { PremiumData, MultiPersonaData, StepType } from '@/types';
import { useDrawOrDieStore } from '@/stores/drawOrDieStore';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { trackConversionEvent } from '@/lib/growth-tracking';
import type { UserProfile } from '@/hooks/useAuth';
import type { AppUser } from '@/hooks/useAuth';
import { normalizeCritiqueText } from '@/lib/critique';
import { normalizeLanguage, type SupportedLanguage } from '@/lib/i18n';
import { deriveAspectRatio } from '@/lib/aspect-ratio';
import { buildGalleryConsent } from '@/lib/gallery-consent';
import { analysisKindLabel } from '@/lib/locales/analysisKindLabels';
import type { DesignInsightOperation } from '@/lib/design-insights';

const PREVIEW_MAX_BYTES = 5 * 1024 * 1024;
const PREVIEW_JPEG_QUALITIES = [0.82, 0.74, 0.66, 0.58, 0.5, 0.42];
const PREMIUM_MAX_RENDERED_PAGES = 12;
export const ANALYSIS_PRESERVE_COST = HISTORY_RAPIDO_COSTS.ANALYSIS_PRESERVE;
const PREMIUM_RESCUE_IMAGE_EDITING_ENABLED =
  process.env.NEXT_PUBLIC_PREMIUM_RESCUE_IMAGE_EDITING_ENABLED === 'true';
type FlawSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

type ActionLock = 'analysis' | 'defense' | 'preserve' | 'share' | 'gallery';

type ProjectSnapshot = {
  imageBase64: string;
  mimeType: string;
  critique: string;
};

export type CommunityShareRequest = {
  /** Must be true: callers collect explicit consent (CommunityShareButton) before sharing. */
  confirmed?: boolean;
};

/** Prefix for supplementary outputs appended below an existing report; ResultStep splits on it. */
export const APPENDED_SECTION_PREFIX = '## ◈ ';

function pickLanguageCopy(language: SupportedLanguage, trText: string, enText: string): string {
  return language === 'en' ? enText : trText;
}

function appendReportSection(baseCritique: string, heading: string, body: string): string {
  return `${baseCritique.trim()}\n\n---\n\n${APPENDED_SECTION_PREFIX}${heading}\n\n${body.trim()}`;
}

function fireConfetti(options: confetti.Options): void {
  void import('canvas-confetti')
    .then(({ default: launchConfetti }) => {
      void launchConfetti(options);
    })
    .catch(() => {
      // Celebration effects are optional; a failed chunk load must never affect the result flow.
    });
}

function isMachineErrorCode(message: string): boolean {
  if (/\s/.test(message)) return false;
  const [code = ''] = message.split(':');
  return code.length >= 4 && code.includes('_') && /^[A-Z0-9_]+$/.test(code);
}

type ApiErrorPayload = {
  error?: string;
  code?: string;
  requestId?: string;
  rawBody?: string;
};

async function readApiErrorPayload(response: Response): Promise<ApiErrorPayload> {
  const rawBody = await response.text().catch(() => '');
  if (!rawBody.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    return {
      error: typeof parsed.error === 'string' ? parsed.error : undefined,
      code: typeof parsed.code === 'string' ? parsed.code : undefined,
      requestId: typeof parsed.requestId === 'string' ? parsed.requestId : undefined,
      rawBody,
    };
  } catch {
    return {
      error: rawBody.trim(),
      rawBody,
    };
  }
}

interface UseAnalysisOptions {
  user: AppUser | null;
  profile: UserProfile | null;
  isPremiumUser: boolean;
  rapidoPens: number;
  getJWT: () => Promise<string>;
  refreshProfile: () => Promise<void>;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  preferredLanguage?: SupportedLanguage;
  /** When true, non-premium users may run multi-jury (server + feature_flags). */
  multiJuryPromoActive?: boolean;
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

function normalizeOverlayBox(box: {
  x: number;
  y: number;
  width: number;
  height: number;
}): { x: number; y: number; width: number; height: number } {
  const minSize = 4;
  const x = clampPercent(box.x);
  const y = clampPercent(box.y);
  const width = Math.max(minSize, Math.min(clampPercent(box.width), 100 - x));
  const height = Math.max(minSize, Math.min(clampPercent(box.height), 100 - y));

  return {
    x: Math.min(x, 100 - minSize),
    y: Math.min(y, 100 - minSize),
    width: Math.min(width, 100 - Math.min(x, 100 - minSize)),
    height: Math.min(height, 100 - Math.min(y, 100 - minSize)),
  };
}

function normalizeFlawSeverity(value: unknown): FlawSeverity {
  if (typeof value !== 'string') return 'MEDIUM';
  const normalized = value.trim().toUpperCase();
  if (normalized === 'LOW' || normalized === 'MEDIUM' || normalized === 'HIGH' || normalized === 'CRITICAL') {
    return normalized;
  }
  const aliasMap: Record<string, FlawSeverity> = {
    KRITIK: 'CRITICAL',
    CRITICAL: 'CRITICAL',
    CRITIC: 'CRITICAL',
    HIGH: 'HIGH',
    YUKSEK: 'HIGH',
    MEDIUM: 'MEDIUM',
    ORTA: 'MEDIUM',
    LOW: 'LOW',
    DUSUK: 'LOW',
  };
  if (normalized in aliasMap) {
    return aliasMap[normalized];
  }
  return 'MEDIUM';
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
    constructive: { tr: 'Yapıcı Mentor', en: 'Constructive Mentor' },
    structural: { tr: 'Strüktürcü', en: 'Structural Critic' },
    conceptual: { tr: 'Konseptüel', en: 'Concept Critic' },
    grumpy: { tr: 'Huysuz Jüri', en: 'Brutal Critic' },
    contextualist: { tr: 'Bağlamcı', en: 'Context Reviewer' },
    sustainability: { tr: 'Sürdürülebilirlik Uzm.', en: 'Sustainability Expert' },
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
    .replace(/^\s*```json\s*/i, '')
    .replace(/^\s*```\s*/i, '')
    .replace(/\s*```\s*$/i, '')
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
    const severity = normalizeFlawSeverity(flaw.severity ?? flaw.priority ?? flaw.level);

    if (x !== null && y !== null && width !== null && height !== null) {
      const box = normalizeOverlayBox({ x, y, width, height });
      return {
        ...box,
        reason: pickFlawReason(flaw, idx, language),
        severity,
        ...(page !== null ? { page: Math.max(1, Math.floor(page)) } : {}),
        ...(pageLabel ? { pageLabel } : {}),
        ...(drawingGuide ? { drawingGuide } : {}),
      };
    }

    // Fallback overlay placement to keep entries visible even when coords are absent.
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const box = normalizeOverlayBox({
      x: 8 + col * 30,
      y: 8 + (row % 6) * 14,
      width: 24,
      height: 12,
    });
    return {
      ...box,
      reason: pickFlawReason(flaw, idx, language),
      severity,
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
  const practicalSolutionsRaw =
    practicalSolutionsCandidates.find((entries) => entries.length > 0) ?? [];
  const fallbackSolutions = flaws.map((flaw, index) => {
    const prefix = pickLanguageCopy(language, `#${index + 1} için`, `For #${index + 1}`);
    return `${prefix}: ${flaw.drawingGuide || flaw.reason}`;
  });
  const practicalSolutions = Array.from(new Set([
    ...practicalSolutionsRaw,
    ...fallbackSolutions,
  ]));
  while (practicalSolutions.length > 0 && practicalSolutions.length < 6) {
    practicalSolutions.push(
      pickLanguageCopy(
        language,
        `Eksik kalan kritik pafta kararlarını teknik gerekçeyle yeniden düzenle (${practicalSolutions.length + 1}).`,
        `Rework the remaining critical board decisions with technical justification (${practicalSolutions.length + 1}).`,
      ),
    );
  }
  const clampedPracticalSolutions = practicalSolutions.slice(0, 18);

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
    practicalSolutions: clampedPracticalSolutions,
    reference: reference ?? pickLanguageCopy(language, 'Belirtilmedi', 'Not specified'),
    imageEditPlanEnabled: PREMIUM_RESCUE_IMAGE_EDITING_ENABLED,
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
  getJWT,
  refreshProfile,
  setProfile,
  preferredLanguage,
  multiJuryPromoActive = false,
}: UseAnalysisOptions) {
  const store = useDrawOrDieStore();
  const uiLanguage = useLanguage();
  const responseLanguage = useMemo<SupportedLanguage>(() => {
    if (preferredLanguage) return normalizeLanguage(preferredLanguage, 'tr');
    if (profile?.preferred_language) return normalizeLanguage(profile.preferred_language, 'tr');
    if (typeof window !== 'undefined') return normalizeLanguage(window.navigator.language, 'tr');
    return 'tr';
  }, [preferredLanguage, profile?.preferred_language]);
  const profileLanguageLoaded = Boolean(profile?.preferred_language);

  const t = useCallback(
    (trText: string, enText: string) => pickLanguageCopy(uiLanguage, trText, enText),
    [uiLanguage],
  );

  const withLanguage = useCallback(
    (params: Record<string, unknown>) => ({
      ...params,
      ...(profileLanguageLoaded ? { language: responseLanguage } : {}),
    }),
    [profileLanguageLoaded, responseLanguage]
  );

  const handleInsufficientRapido = useCallback(
    (cost: number, featureLabel: string) => {
      const available = Math.max(0, rapidoPens);
      if (!isPremiumUser) {
        store.addToast(
          pickLanguageCopy(
            uiLanguage,
            `${featureLabel} için ${cost} Rapido gerekiyor (mevcut: ${available}). Deneme limitine yaklaştın; Premium'a geçerek devam edebilirsin.`,
            `${featureLabel} requires ${cost} Rapido (available: ${available}). You're close to the trial limit; continue with Premium.`,
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
          `Yetersiz Rapido. ${featureLabel} için ${cost} Rapido gerekiyor, mevcut: ${available}. Rapido yükleyip tekrar dene.`,
          `Not enough Rapido. ${featureLabel} requires ${cost} Rapido, available: ${available}. Top up and try again.`,
        ),
        'error'
      );
    },
    [isPremiumUser, rapidoPens, store, uiLanguage]
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

  /** Maps the structured codes thrown by lib/ai.ts (formatStructuredAIError) to friendly copy. */
  const toUserErrorMessage = useCallback(
    (error: unknown, fallback?: string) => {
      const fb = fallback ?? pickLanguageCopy(uiLanguage, 'Bir hata oluştu. Lütfen tekrar dene.', 'Something went wrong. Please try again.');
      if (!(error instanceof Error)) return fb;
      const message = error.message.trim();

      if (message.includes('RATE_LIMITED')) {
        const waitSecondsRaw = Number(message.split('RATE_LIMITED:')[1]?.split(/\s/)[0] ?? '60');
        const waitSeconds = Number.isFinite(waitSecondsRaw) && waitSecondsRaw > 0 ? Math.ceil(waitSecondsRaw) : 60;
        return pickLanguageCopy(
          uiLanguage,
          `Çok fazla istek gönderdin. Lütfen ${waitSeconds} sn bekleyip tekrar dene.`,
          `Too many requests. Please wait ${waitSeconds} seconds and try again.`,
        );
      }

      if (message.includes('INSUFFICIENT_RAPIDO')) {
        const [, requiredRaw = '', availableRaw = ''] = message.slice(message.indexOf('INSUFFICIENT_RAPIDO')).split(':');
        const required = Number.parseFloat(requiredRaw);
        const available = Number.parseFloat(availableRaw);
        if (Number.isFinite(required) && Number.isFinite(available)) {
          return pickLanguageCopy(
            uiLanguage,
            `Yetersiz Rapido. Bu işlem için ${required} Rapido gerekiyor, mevcut: ${available}. Rapido yükleyip tekrar dene.`,
            `Not enough Rapido. This action requires ${required} Rapido, available: ${available}. Top up and try again.`,
          );
        }
        return pickLanguageCopy(
          uiLanguage,
          'Yetersiz Rapido. Rapido yükleyip tekrar dene.',
          'Not enough Rapido. Top up and try again.',
        );
      }

      if (message.includes('PREMIUM_REQUIRED')) {
        return pickLanguageCopy(
          uiLanguage,
          "Bu özellik Premium üyelere özeldir. Devam etmek için Premium'a geç.",
          'This feature is for Premium members. Go Premium to continue.',
        );
      }

      if (message === 'MENTOR_PREMIUM_LIMIT_REACHED') {
        return pickLanguageCopy(
          uiLanguage,
          'Bu mentor sohbeti 12K limite ulaştı. 2x Rapido ile devam edebilir veya yeni sohbet açabilirsin.',
          'This mentor chat hit the 12K limit. Continue with 2× Rapido or open a new chat.',
        );
      }

      if (message === 'CHAT_TOKEN_LIMIT_REACHED') {
        return pickLanguageCopy(
          uiLanguage,
          'Bu mentor sohbetinin token limiti doldu. Yeni sohbet açmalısın.',
          'This mentor chat reached its token limit. Open a new chat.',
        );
      }

      if (message === 'GUEST_MENTOR_DISABLED') {
        return pickLanguageCopy(
          uiLanguage,
          'AI Mentor misafir hesaplarda kullanılamaz. Devam etmek için hesap oluştur.',
          'AI Mentor is not available for guest accounts. Create an account to continue.',
        );
      }

      // Never surface an unmapped machine code (e.g. "SOME_CODE:1") to the user.
      if (!message || isMachineErrorCode(message)) return fb;
      return message;
    },
    [uiLanguage],
  );

  // In-flight guards: refs (not state) so a second click in the same frame is rejected
  // before React re-renders the disabled button.
  const locksRef = useRef<Partial<Record<ActionLock, string>>>({});
  const revisionBaselineRef = useRef<ProjectSnapshot | null>(null);
  const lastPreservedPayloadRef = useRef<string | null>(null);

  const runExclusive = useCallback(
    async <T>(lock: ActionLock, key: string, task: () => Promise<T>): Promise<T | undefined> => {
      const activeKey = locksRef.current[lock];
      if (activeKey) {
        if (lock === 'analysis' && activeKey !== key) {
          store.addToast(
            pickLanguageCopy(
              uiLanguage,
              'Bir analiz zaten sürüyor. Bitmesini bekleyip tekrar dene.',
              'An analysis is already running. Wait for it to finish and try again.',
            ),
            'info',
          );
        }
        return undefined;
      }

      locksRef.current[lock] = key;
      try {
        return await task();
      } finally {
        delete locksRef.current[lock];
      }
    },
    [store, uiLanguage],
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
          () =>
            store.addToast(
              `${t('🏆 YENİ ROZET:', '🏆 NEW BADGE:')} ${badge.name}`,
              'badge',
              6000,
            ),
          800,
        );
      }
    },
    [setProfile, store, t]
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
      options?: { title?: string; juryQuote?: string; analysisKind?: string }
    ) => {
      if (!user?.id) {
        store.addToast(t('Galeriye eklemek için giriş yapmalısınız.', 'Sign in to add to the gallery.'), 'error');
        return false;
      }

      // Guests cannot later manage or revoke a public post, so publishing needs a real account.
      if (!user.email) {
        store.addToast(
          t('Galeride paylaşmak için hesap oluşturmalısın.', 'Create an account to publish to the gallery.'),
          'error',
        );
        store.setIsAuthModalOpen(true);
        return false;
      }

      const title = options?.title || store.formData.topic || t('İsimsiz Proje', 'Untitled project');
      const juryQuote = options?.juryQuote || (
        store.critique
          ? normalizeCritiqueText(store.critique).substring(0, 1200)
          : t('Jüri yorumu bulunamadı.', 'No jury comment available.')
      );

      const previewPayload = await buildGalleryPreviewPayload();
      if (!previewPayload) {
        store.addToast(t('Galeri önizlemesi hazırlanamadı.', 'Could not build gallery preview.'), 'error');
        return false;
      }

      try {
        const jwt = await getJWT();
        const response = await fetch('/api/gallery', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            title,
            juryQuote,
            galleryType,
            imageBase64: previewPayload.imageBase64,
            mimeType: previewPayload.mimeType,
            aspectRatio: previewPayload.aspectRatio,
            // Approval state is decided by the server; the client only records explicit consent.
            consent: buildGalleryConsent(galleryType),
            analysisKind: options?.analysisKind ?? store.latestAnalysisKind ?? 'SINGLE_JURY',
          }),
        });

        if (!response.ok) {
          const payload = await readApiErrorPayload(response);
          console.error('[gallery] API insert failed:', {
            status: response.status,
            statusText: response.statusText,
            code: payload.code,
            requestId: payload.requestId,
            error: payload.error,
            rawBody: payload.rawBody,
          });

          if (payload.code === 'COMMUNITY_MODERATION_REJECTED' || payload.code === 'GALLERY_MODERATION_REJECTED') {
            store.addToast(
              payload.error || t('Paylaşım topluluk moderasyonundan geçemedi.', 'Share did not pass community moderation.'),
              'error',
            );
            return false;
          }

          if (response.status === 413 || payload.code === 'GALLERY_IMAGE_TOO_LARGE') {
            store.addToast(
              payload.error || t('Görsel boyutu yüksek. Daha düşük çözünürlükte tekrar deneyin.', 'Image is too large. Retry with a lower resolution.'),
              'error',
            );
            return false;
          }

          if (response.status === 415 || payload.code === 'UNSUPPORTED_IMAGE_TYPE') {
            store.addToast(
              payload.error || t('Desteklenmeyen format. JPG/PNG/WEBP kullanın.', 'Unsupported format. Please use JPG/PNG/WEBP.'),
              'error',
            );
            return false;
          }

          if (payload.code === 'GUEST_PUBLISH_BLOCKED') {
            store.addToast(
              payload.error || t('Galeride paylaşmak için hesap oluşturmalısın.', 'Create an account to publish to the gallery.'),
              'error',
            );
            store.setIsAuthModalOpen(true);
            return false;
          }

          if (response.status === 401) {
            store.addToast(t('Community paylaşımı için tekrar giriş yapmanız gerekiyor.', 'Please sign in again to share with the community.'), 'error');
            store.setIsAuthModalOpen(true);
            return false;
          }

          if (payload.code === 'GALLERY_WRITE_FAILED') {
            store.addToast(
              payload.error || t('Paylaşım servisi şu anda yanıt vermiyor. Lütfen kısa süre sonra tekrar deneyin.', 'Share service is currently unavailable. Please try again shortly.'),
              'error',
            );
            return false;
          }

          store.addToast(
            payload.error || t('Galeri kaydedilirken hata oluştu.', 'Error while saving to gallery.'),
            'error',
          );
          return false;
        }

        const payload = await response.json() as {
          item?: {
            id: string;
            img: string;
            title: string;
            jury: string;
            type: 'HALL_OF_FAME' | 'WALL_OF_DEATH' | 'COMMUNITY';
            status?: 'approved' | 'pending' | 'archived';
            analysisKind?: string;
          };
          moderationPendingReview?: boolean;
          code?: string;
        };

        if (payload.item) {
          store.setGalleryItems((prev) => [
            {
              ...payload.item!,
              status: payload.item?.status,
              analysisKind: payload.item?.analysisKind ?? 'SINGLE_JURY',
            },
            ...prev,
          ]);
        }

        if (payload.moderationPendingReview) {
          store.addToast(
            t(
              'Paylaşımın inceleme kuyruğuna alındı. Moderasyon tamamlanınca galeride görünecek.',
              'Your share is queued for review. It will appear in the gallery after moderation.',
            ),
            'info',
            6500,
          );
        } else {
          store.addToast(
            galleryType === 'COMMUNITY'
              ? t('Community paylaşımı tamamlandı!', 'Community share completed!')
              : t('Proje galeriye eklendi!', 'Project added to gallery!'),
            'success',
          );
        }
        return true;
      } catch (err) {
        console.error('[gallery] Unexpected error:', err);
        store.addToast(t('Galeri kaydedilirken hata oluştu.', 'Error while saving to gallery.'), 'error');
        return false;
      }
    },
    [buildGalleryPreviewPayload, getJWT, store, user, t]
  );

  const buildPremiumSummaryText = useCallback(
    (premiumData: PremiumData): string =>
      normalizeCritiqueText(
        premiumData.summary ||
          [
            premiumData.flaws.length > 0
              ? `${t('Tespit edilen sorunlar', 'Detected issues')}:\n${premiumData.flaws.map((entry, idx) => `${idx + 1}. ${entry.reason}`).join('\n')}`
              : '',
            premiumData.practicalSolutions.length > 0
              ? `${t('Pratik çözümler', 'Practical solutions')}:\n${premiumData.practicalSolutions.map((entry, idx) => `${idx + 1}. ${entry}`).join('\n')}`
              : '',
          ]
            .filter(Boolean)
            .join('\n\n'),
      ),
    [t],
  );

  const shareToCommunity = useCallback(async (request?: CommunityShareRequest): Promise<boolean> => {
    if (!user?.id) {
      store.addToast(t('Community paylaşımı için giriş yapmalısınız.', 'Sign in to share with the community.'), 'error');
      store.setIsAuthModalOpen(true);
      return false;
    }

    if (!request?.confirmed) {
      store.addToast(t('Community paylaşımı onaylanmadı.', 'Community share was not confirmed.'), 'info');
      return false;
    }

    const analysisKind = (store.latestAnalysisKind ?? 'SINGLE_JURY').toUpperCase();
    const title = (store.formData.topic || t('İsimsiz Proje', 'Untitled project')).substring(0, 120);

    let juryQuote = normalizeCritiqueText(store.critique ?? '').trim();

    if (!juryQuote && analysisKind === 'MULTI_JURY' && store.multiData?.personas?.length) {
      juryQuote = normalizeCritiqueText(
        store.multiData.personas
          .map((persona, index) => `${index + 1}. ${persona.name}: ${persona.critique}`)
          .join('\n\n'),
      );
    }

    if (!juryQuote && analysisKind === 'PREMIUM_RESCUE' && store.premiumData) {
      juryQuote = buildPremiumSummaryText(store.premiumData);
    }

    if (!juryQuote) {
      juryQuote = t('Topluluğa açık pafta paylaşımı.', 'Open board share for the community.');
    }

    return submitGalleryItem('COMMUNITY', {
      title,
      juryQuote: juryQuote.substring(0, 1200),
      analysisKind,
    });
  }, [store, submitGalleryItem, user, t, buildPremiumSummaryText]);

  const handleShareToCommunity = useCallback(
    async (request?: CommunityShareRequest): Promise<boolean> =>
      (await runExclusive('share', 'community', () => shareToCommunity(request))) ?? false,
    [runExclusive, shareToCommunity],
  );

  const preserveAnalysis = useCallback(async (): Promise<boolean> => {
    if (!user?.id) {
      store.addToast(t('Analizi korumak için giriş yapmalısınız.', 'Sign in to preserve your analysis.'), 'error');
      store.setIsAuthModalOpen(true);
      return false;
    }

    const sourceBase64 = (store.imageBase64 ?? '').trim();
    const sourceMimeType = (store.mimeType ?? 'image/jpeg').trim() || 'image/jpeg';
    if (!sourceBase64) {
      store.addToast(
        t('Korunacak pafta verisi bulunamadı. Lütfen analizi tekrar üretin.', 'No board data to preserve. Please run the analysis again.'),
        'error',
      );
      return false;
    }

    const analysisKind = (store.latestAnalysisKind ?? 'SINGLE_JURY').toUpperCase();
    const galleryType = store.galleryPlacement;
    const titleBase = store.formData.topic || t('İsimsiz Proje', 'Untitled project');

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
      critiquePayload = buildPremiumSummaryText(store.premiumData);
      scorePayload = null;
    } else {
      critiquePayload = normalizeCritiqueText(store.critique || '');
      scorePayload = null;
    }

    if (!critiquePayload) {
      store.addToast(t('Korunacak analiz içeriği bulunamadı.', 'No analysis content to preserve.'), 'error');
      return false;
    }

    // The result screen remounts after navigation; this stops a second paid save of the same report.
    const preserveSignature = `${analysisKind}\n${critiquePayload}`;
    if (lastPreservedPayloadRef.current === preserveSignature) {
      store.addToast(t('Bu analiz zaten korundu.', 'This analysis is already preserved.'), 'info');
      return true;
    }

    try {
      const jwt = await getJWT();
      const response = await fetch('/api/analysis-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
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
            t(
              `Yetersiz Rapido. Gerekli: ${payload.required ?? ANALYSIS_PRESERVE_COST}, mevcut: ${payload.available ?? 0}. Rapido yükleyip tekrar dene.`,
              `Not enough Rapido. Required: ${payload.required ?? ANALYSIS_PRESERVE_COST}, available: ${payload.available ?? 0}. Top up and try again.`,
            ),
            'error',
          );
          return false;
        }

        throw new Error(payload.error || payload.code || t('Analiz korunamadı.', 'Could not preserve analysis.'));
      }

      lastPreservedPayloadRef.current = preserveSignature;
      store.addToast(
        t(
          `Analiz korundu. ${ANALYSIS_PRESERVE_COST} Rapido düşüldü. Kalan: ${payload.rapido_remaining ?? '-'} Rapido`,
          `Analysis preserved. ${ANALYSIS_PRESERVE_COST} Rapido deducted. Remaining: ${payload.rapido_remaining ?? '-'} Rapido`,
        ),
        'success',
      );
      await refreshProfile();
      return true;
    } catch (error) {
      console.error('[history] preserve failed:', error);
      store.addToast(toUserErrorMessage(error, t('Analiz korunamadı.', 'Could not preserve analysis.')), 'error');
      return false;
    }
  }, [getJWT, refreshProfile, store, user, t, buildPremiumSummaryText, toUserErrorMessage]);

  const handlePreserveAnalysis = useCallback(
    async (): Promise<boolean> => (await runExclusive('preserve', 'preserve', preserveAnalysis)) ?? false,
    [runExclusive, preserveAnalysis],
  );

  // -------------------------------------------------------------------------
  // handleGalleryConsent — explicit opt-in for every tier (nothing is published without it)
  // -------------------------------------------------------------------------
  const submitGalleryConsent = useCallback(
    async (consent: boolean): Promise<boolean> => {
      store.setGalleryConsent(consent);
      if (!consent || store.galleryPlacement === 'NONE') return true;

      const galleryType = store.galleryPlacement as 'HALL_OF_FAME' | 'WALL_OF_DEATH';
      const isSubmitted = await submitGalleryItem(galleryType);
      if (!isSubmitted) {
        // Let the user retry instead of showing "allowed" for a submission that never happened.
        store.setGalleryConsent(null);
      }
      return isSubmitted;
    },
    [store, submitGalleryItem],
  );

  const handleGalleryConsent = useCallback(
    async (consent: boolean): Promise<boolean> =>
      (await runExclusive('gallery', 'gallery', () => submitGalleryConsent(consent))) ?? false,
    [runExclusive, submitGalleryConsent],
  );

  // -------------------------------------------------------------------------
  // handleAnalyze — SINGLE_JURY or REVISION_SAME
  // -------------------------------------------------------------------------
  const runSingleOrRevision = useCallback(async () => {
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
      store.addToast(t('Jüriye çıkmak için lütfen giriş yapın.', 'Please sign in to face the jury.'), 'error');
      store.setIsAuthModalOpen(true);
      return;
    }

    // The newest revised board lives in revisionBaselineRef so the store's previousProject can keep
    // showing the true "before" board in the evolution view.
    const revisionBaseline: ProjectSnapshot | null =
      isRevisionMode && previousProject ? (revisionBaselineRef.current ?? previousProject) : null;

    if (revisionBaseline) {
      if (rapidoPens < RAPIDO_COSTS.REVISION_SAME) {
        handleInsufficientRapido(RAPIDO_COSTS.REVISION_SAME, t('Revizyon analizi', 'Revision analysis'));
        return;
      }
    } else {
      if (rapidoPens < RAPIDO_COSTS.SINGLE_JURY) {
        handleInsufficientRapido(RAPIDO_COSTS.SINGLE_JURY, t('Jüri analizi', 'Jury analysis'));
        return;
      }
    }

    void trackConversionEvent('critique_started', {
      type: revisionBaseline ? 'revision' : 'standard',
      isPremium: isPremiumUser,
    });
    store.setStep('analyzing');

    try {
      if (revisionBaseline) {
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
            previousCritique: revisionBaseline.critique,
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
          revisionBaselineRef.current = {
            imageBase64: previewPayload?.imageBase64 ?? readyImageBase64,
            mimeType: previewPayload?.mimeType ?? readyMimeType,
            critique,
          };
          store.setPreviousProject({
            imageBase64: revisionBaseline.imageBase64,
            mimeType: revisionBaseline.mimeType,
            critique: revisionBaseline.critique,
          });
          store.setLatestAnalysisKind('REVISION_SAME');
          store.setStep('result');
          void trackConversionEvent('critique_completed', {
            type: 'revision',
            isPremium: isPremiumUser,
          });

          if (data.isSameProject) {
            if ((typeof data.progressionScore === 'number' ? data.progressionScore : 0) > 50) {
              fireConfetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#10B981', '#ffffff'] });
            }
          } else {
            store.setLastProgression(null);
            store.addToast(
              t(
                `Jüri Notu: Yüklediğin pafta öncekiyle alakasız görünüyor. Bu yüzden yeni proje olarak değerlendirildi ve ${RAPIDO_COSTS.REVISION_DIFFERENT} Rapido kesildi.`,
                `Jury note: Your upload seems unrelated to the previous board. It was evaluated as a new project and ${RAPIDO_COSTS.REVISION_DIFFERENT} Rapido was charged.`,
              ),
              'info',
              7000
            );
          }
        } else {
          store.addToast(t('Jüri sessiz kaldı. Tekrar dene.', 'The jury stayed silent. Try again.'), 'error');
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
          // A fresh jury run starts a new revision chain: this board becomes the next baseline.
          revisionBaselineRef.current = null;
          store.setPreviousProject({
            imageBase64: previewPayload?.imageBase64 ?? readyImageBase64,
            mimeType: previewPayload?.mimeType ?? readyMimeType,
            critique,
          });
          store.setLatestAnalysisKind('SINGLE_JURY');
          store.setStep('result');
          void trackConversionEvent('critique_completed', {
            type: 'standard',
            isPremium: isPremiumUser,
          });
        } else {
          store.addToast(t('Jüri sessiz kaldı. Tekrar dene.', 'The jury stayed silent. Try again.'), 'error');
          store.setStep('upload');
        }
      }
    } catch (error) {
      console.error(error);
      void reportClientError({
        scope: 'analysis.single_or_revision',
        message: 'Analysis request failed',
        details: {
          operation: revisionBaseline ? 'REVISION_SAME' : 'SINGLE_JURY',
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
    withLanguage,
    t,
    uiLanguage,
  ]);

  const handleAnalyze = useCallback(
    () => runExclusive('analysis', 'single-jury', runSingleOrRevision),
    [runExclusive, runSingleOrRevision],
  );

  // -------------------------------------------------------------------------
  // handleMultiAnalyze — MULTI_JURY (Premium)
  // -------------------------------------------------------------------------
  const runMultiJury = useCallback(async () => {
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
      store.addToast(
        t('Çoklu jüri için en az 2, en fazla 4 persona seçmelisin.', 'Pick between 2 and 4 personas for multi jury.'),
        'info',
      );
      return;
    }

    if (!isPremiumUser && !multiJuryPromoActive) {
      store.addToast(t('Çoklu Jüri analizi Premium üyelere özeldir!', 'Multi jury is for Premium members only!'), 'error');
      return;
    }
    if (rapidoPens < RAPIDO_COSTS.MULTI_JURY) {
      handleInsufficientRapido(RAPIDO_COSTS.MULTI_JURY, t('Çoklu Jüri analizi', 'Multi jury analysis'));
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
        const multiData = parseMultiJuryResult(aiResponse.result, responseLanguage);

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
        store.addToast(
          t('Jürilerden geçerli bir yanıt alınamadı. Tekrar deneyin.', 'No valid response from the jury. Please try again.'),
          'error',
        );
        store.setStep('upload');
      }
    } catch (e) {
      console.error(e);
      void reportClientError({
        scope: 'analysis.multi_jury',
        message: 'Multi jury request failed',
        details: {
          error: e instanceof Error ? e.message : String(e),
        },
      });
      store.addToast(toUserErrorMessage(e, t('Jüriler toplanamadı. Tekrar dene.', 'Could not gather the jury. Try again.')), 'error');
      store.setStep('upload');
    }
  }, [store, isPremiumUser, multiJuryPromoActive, rapidoPens, refreshProfile, handleInsufficientRapido, getReadyImagePayload, toUserErrorMessage, withLanguage, responseLanguage, uiLanguage, t]);

  const handleMultiAnalyze = useCallback(
    () => runExclusive('analysis', 'multi-jury', runMultiJury),
    [runExclusive, runMultiJury],
  );

  // -------------------------------------------------------------------------
  // handlePremium — PREMIUM_RESCUE
  // -------------------------------------------------------------------------
  const runPremiumRescue = useCallback(async () => {
    const { image, imageBase64, mimeType, formData, pdfText, additionalUploads, multiData } = store;
    // A failed rescue must land back on the screen the user started from, never on an empty result.
    const returnStep: StepType = store.step === 'multi-result' && multiData ? 'multi-result' : 'result';
    const readyPayload = getReadyImagePayload(imageBase64, mimeType);
    if (!readyPayload) return;
    const { imageBase64: readyImageBase64, mimeType: readyMimeType } = readyPayload;

    if (rapidoPens < RAPIDO_COSTS.PREMIUM_RESCUE) {
      handleInsufficientRapido(RAPIDO_COSTS.PREMIUM_RESCUE, t('Premium analiz', 'Premium analysis'));
      return;
    }

    let premiumPrepared: PremiumRescuePreparation;
    try {
      premiumPrepared = await preparePremiumRescueInputs({
        image,
        imageBase64: readyImageBase64,
        mimeType: readyMimeType,
        additionalUploads: (additionalUploads ?? []).map((entry) => ({
          name: entry.name,
          mimeType: entry.mimeType,
          base64: entry.base64,
        })),
      });
    } catch (error) {
      void reportClientError({
        scope: 'analysis.premium_rescue.prepare',
        message: 'Premium rescue page preparation failed',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
      store.addToast(
        t(
          'Paftalar hazırlanamadı. Dosyayı yeniden yükleyip tekrar dene.',
          'Could not prepare your sheets. Re-upload the file and try again.',
        ),
        'error',
      );
      return;
    }

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
          multiJuryCritiques: multiData?.personas?.map((persona) => ({
            id: persona.id,
            name: persona.name,
            score: persona.score,
            critique: persona.critique,
          })),
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
        const data = parsePremiumRescueResult(raw, responseLanguage);
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
          store.setPremiumData(data);
          store.setLatestAnalysisKind('PREMIUM_RESCUE');
          store.setStep('premium');
          void trackConversionEvent('critique_completed', {
            type: 'premium',
            isPremium: isPremiumUser,
          });
          fireConfetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#FF0033', '#ffffff', '#0A0F1A'],
          });
        } else {
          store.addToast(t('Kurtarma analizi sonuç üretmedi. Tekrar dene.', 'The rescue analysis returned no result. Try again.'), 'error');
          store.setStep(returnStep);
        }
      } else {
        store.addToast(t('Kurtarma analizi sonuç üretmedi. Tekrar dene.', 'The rescue analysis returned no result. Try again.'), 'error');
        store.setStep(returnStep);
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
      store.setStep(returnStep);
    }
  }, [store, rapidoPens, isPremiumUser, handleInsufficientRapido, getReadyImagePayload, toUserErrorMessage, withLanguage, responseLanguage, uiLanguage, t]);

  const handlePremium = useCallback(
    () => runExclusive('analysis', 'premium-rescue', runPremiumRescue),
    [runExclusive, runPremiumRescue],
  );

  // -------------------------------------------------------------------------
  // handleAutoConcept — AUTO_CONCEPT
  // -------------------------------------------------------------------------
  const runAutoConcept = useCallback(async () => {
    const { imageBase64, mimeType, additionalUploads, formData, critique: currentCritique } = store;
    // From the result screen the concept text is added below the paid report instead of replacing it.
    const shouldAppendToReport = store.step === 'result' && Boolean(currentCritique?.trim());
    const fallbackStep: StepType = shouldAppendToReport ? 'result' : 'upload';
    const readyPayload = getReadyImagePayload(imageBase64, mimeType);
    if (!readyPayload) return;
    const { imageBase64: readyImageBase64, mimeType: readyMimeType } = readyPayload;
    const additionalFiles = (additionalUploads ?? []).map((entry) => ({
      name: entry.name,
      mimeType: entry.mimeType,
      base64: entry.base64,
    }));

    if (rapidoPens < RAPIDO_COSTS.AUTO_CONCEPT) {
      handleInsufficientRapido(RAPIDO_COSTS.AUTO_CONCEPT, t('Konsept üretimi', 'Concept generation'));
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

        if (shouldAppendToReport && currentCritique) {
          store.setCritique(
            appendReportSection(currentCritique, analysisKindLabel('AUTO_CONCEPT', uiLanguage), critiqueText),
          );
          store.setStep('result');
          store.addToast(
            t('Konsept metni jüri raporunun altına eklendi.', 'Concept text was added below the jury report.'),
            'success',
          );
        } else {
          store.setLastProgression(null);
          store.setCritique(critiqueText);
          store.setGalleryPlacement('NONE');
          store.setGalleryConsent(null);
          store.setPreviousProject(null);
          store.setLatestAnalysisKind('AUTO_CONCEPT');
          store.setStep('result');
        }

        void trackConversionEvent('critique_completed', {
          type: 'auto_concept',
          isPremium: isPremiumUser,
        });
      } else {
        store.addToast(t('İlham gelmedi. Tekrar dene.', 'No inspiration came through. Try again.'), 'error');
        store.setStep(fallbackStep);
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
      store.setStep(fallbackStep);
    }
  }, [store, rapidoPens, isPremiumUser, refreshProfile, handleInsufficientRapido, getReadyImagePayload, toUserErrorMessage, withLanguage, uiLanguage, t]);

  const handleAutoConcept = useCallback(
    () => runExclusive('analysis', 'auto-concept', runAutoConcept),
    [runExclusive, runAutoConcept],
  );

  // -------------------------------------------------------------------------
  // handleMaterialBoard — MATERIAL_BOARD (Premium)
  // -------------------------------------------------------------------------
  const runMaterialBoard = useCallback(async () => {
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
      store.addToast(t('Malzeme Paftası Analizi Premium üyelere özeldir!', 'Material board analysis is Premium only!'), 'error');
      return;
    }
    if (rapidoPens < RAPIDO_COSTS.MATERIAL_BOARD) {
      handleInsufficientRapido(RAPIDO_COSTS.MATERIAL_BOARD, t('Malzeme analizi', 'Material analysis'));
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
        store.addToast(t('Analiz başarısız oldu.', 'Analysis failed.'), 'error');
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
  }, [store, isPremiumUser, rapidoPens, refreshProfile, handleInsufficientRapido, getReadyImagePayload, toUserErrorMessage, withLanguage, uiLanguage, t]);

  const handleMaterialBoard = useCallback(
    () => runExclusive('analysis', 'material-board', runMaterialBoard),
    [runExclusive, runMaterialBoard],
  );

  const runDesignInsight = useCallback(async (operation: DesignInsightOperation) => {
    const {
      imageBase64,
      mimeType,
      additionalUploads,
      formData,
      pdfText,
      critique: currentCritique,
    } = store;
    const readyPayload = getReadyImagePayload(imageBase64, mimeType);
    if (!readyPayload) return;

    const cost = RAPIDO_COSTS[operation];
    if (rapidoPens < cost) {
      handleInsufficientRapido(cost, analysisKindLabel(operation, uiLanguage));
      return;
    }

    const additionalFiles = (additionalUploads ?? []).map((entry) => ({
      name: entry.name,
      mimeType: entry.mimeType,
      base64: entry.base64,
    }));
    // From the result screen (e.g. Skill Roadmap) the output is added below the paid report instead of replacing it.
    const shouldAppendToReport = store.step === 'result' && Boolean(currentCritique?.trim());
    const fallbackStep: StepType = shouldAppendToReport || operation === 'SKILL_ROADMAP' ? 'result' : 'upload';

    void trackConversionEvent('critique_started', {
      type: operation.toLowerCase(),
      isPremium: isPremiumUser,
    });
    store.setStep('analyzing');

    try {
      const aiResponse = await generateAIResponse({
        locale: uiLanguage,
        operation,
        imageBase64: readyPayload.imageBase64,
        imageMimeType: readyPayload.mimeType,
        params: withLanguage({
          category: formData.category,
          topic: formData.topic,
          concept: formData.concept,
          defense: formData.defense,
          pdfText: pdfText?.substring(0, 1200),
          currentCritique: currentCritique?.substring(0, 6000),
          additionalFiles,
        }),
      });

      if (!aiResponse) {
        store.addToast(t('Tasarım denetimi sonuç üretmedi. Tekrar deneyin.', 'Design diagnostic returned no result. Try again.'), 'error');
        store.setStep(fallbackStep);
        return;
      }

      const { critique } = parseCritiqueResult(aiResponse.result);
      applyGameState(aiResponse.game_state);
      await refreshProfile();
      if (shouldAppendToReport && currentCritique) {
        const sectionLabel = analysisKindLabel(operation, uiLanguage);
        store.setCritique(appendReportSection(currentCritique, sectionLabel, critique));
        store.setStep('result');
        store.addToast(
          t(`${sectionLabel} raporun altına eklendi.`, `${sectionLabel} was added below the report.`),
          'success',
        );
      } else {
        store.setLastProgression(null);
        store.setCritique(critique);
        store.setGalleryPlacement('NONE');
        store.setGalleryConsent(null);
        store.setLatestAnalysisKind(operation);
        store.setStep('result');
      }

      void trackConversionEvent('critique_completed', {
        type: operation.toLowerCase(),
        isPremium: isPremiumUser,
      });
    } catch (error) {
      void reportClientError({
        scope: 'analysis.design_insight',
        message: 'Design insight request failed',
        details: {
          operation,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      store.addToast(toUserErrorMessage(error), 'error');
      store.setStep(fallbackStep);
    }
  }, [
    applyGameState,
    getReadyImagePayload,
    handleInsufficientRapido,
    isPremiumUser,
    rapidoPens,
    refreshProfile,
    store,
    t,
    toUserErrorMessage,
    uiLanguage,
    withLanguage,
  ]);

  const handleDesignInsight = useCallback(
    (operation: DesignInsightOperation) =>
      runExclusive('analysis', `design-insight:${operation}`, () => runDesignInsight(operation)),
    [runExclusive, runDesignInsight],
  );

  // -------------------------------------------------------------------------
  // handleDefenseSubmit — DEFENSE (Premium, up to 3 turns)
  // -------------------------------------------------------------------------
  const runDefenseTurn = useCallback(async () => {
    const { defenseInput, isDefenseLoading, defenseTurnCount, defenseMessages, critique, formData } = store;
    if (!defenseInput.trim() || isDefenseLoading) return;

    if (!isPremiumUser) {
      store.addToast(t('Jüri Savunması Premium üyelere özeldir!', 'Jury defense is Premium only!'), 'error');
      return;
    }
    if (defenseTurnCount === 0 && rapidoPens < RAPIDO_COSTS.DEFENSE) {
      handleInsufficientRapido(RAPIDO_COSTS.DEFENSE, t('Jüri savunması', 'Jury defense'));
      return;
    }

    if (defenseTurnCount >= 3) {
      store.addToast(t('Jüri ile en fazla 3 tur tartışabilirsiniz!', 'You can debate with the jury for up to 3 rounds!'), 'info');
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
              fireConfetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#10B981', '#ffffff'] });
              store.addToast(t(`Jüriyi ikna ettin! +${scoreChange} Puan!`, `You convinced the jury! +${scoreChange} points!`), 'success');
            } else {
              store.addToast(t(`Jüri ikna olmadı... ${scoreChange} Puan!`, `The jury was not convinced... ${scoreChange} points!`), 'info');
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
      store.addToast(
        toUserErrorMessage(e, pickLanguageCopy(uiLanguage, 'Savunma iletilemedi.', 'Could not send defense.')),
        'error',
      );
    } finally {
      store.setIsDefenseLoading(false);
    }
  }, [store, isPremiumUser, rapidoPens, refreshProfile, applyGameState, handleInsufficientRapido, toUserErrorMessage, withLanguage, uiLanguage, t]);

  const handleDefenseSubmit = useCallback(
    () => runExclusive('defense', 'defense', runDefenseTurn),
    [runExclusive, runDefenseTurn],
  );

  return {
    handleAnalyze,
    handleMultiAnalyze,
    handlePremium,
    handleAutoConcept,
    handleMaterialBoard,
    handleDesignInsight,
    handleDefenseSubmit,
    handleGalleryConsent,
    handlePreserveAnalysis,
    handleShareToCommunity,
  };
}
