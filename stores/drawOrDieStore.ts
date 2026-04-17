/**
 * drawOrDieStore.ts
 *
 * Central Zustand store for Draw-or-Die application state.
 * State is grouped by domain to keep concerns separated.
 *
 * Domains:
 *  - step: current UI step / navigation
 *  - image: uploaded file data
 *  - form: project metadata form
 *  - result: AI analysis outputs
 *  - defense: jury defense chat
 *  - gallery: gallery items and placement
 *  - ui: toasts, modals, transient UI state
 */

import { create } from 'zustand';
import {
  StepType,
  GalleryPlacementType,
  GalleryItem,
  FormData,
  PremiumData,
  MultiPersonaData,
  DefenseMessage,
} from '@/types';

// ---------------------------------------------------------------------------
// Toast type (local to store — avoids circular imports with page.tsx)
// ---------------------------------------------------------------------------
export interface Toast {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'badge';
}

let _toastId = 0;

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface StepState {
  step: StepType;
  setStep: (step: StepType) => void;
}

interface ImageState {
  image: File | null;
  imageBase64: string | null;
  additionalUploads: AdditionalUpload[];
  mimeType: string | null;
  previewUrl: string | null;
  pdfText: string | null;
  uploadValidationError: string | null;
  setImage: (image: File | null) => void;
  setImageBase64: (v: string | null) => void;
  setAdditionalUploads: (v: AdditionalUpload[]) => void;
  setMimeType: (v: string | null) => void;
  setPreviewUrl: (v: string | null) => void;
  setPdfText: (v: string | null) => void;
  setUploadValidationError: (v: string | null) => void;
}

interface FormState {
  formData: FormData;
  setFormData: (data: FormData | ((prev: FormData) => FormData)) => void;
}

interface ResultState {
  critique: string | null;
  premiumData: PremiumData | null;
  multiData: MultiPersonaData | null;
  latestAnalysisKind: string | null;
  previousProject: {
    imageBase64: string;
    mimeType: string;
    critique: string;
    pagePreviews?: string[];
  } | null;
  lastProgression: number | null;
  isRevisionMode: boolean;
  selectedFlawIndex: number | null;
  setCritique: (v: string | null) => void;
  setPremiumData: (v: PremiumData | null) => void;
  setMultiData: (v: MultiPersonaData | null) => void;
  setLatestAnalysisKind: (v: string | null) => void;
  setPreviousProject: (
    v: {
      imageBase64: string;
      mimeType: string;
      critique: string;
      pagePreviews?: string[];
    } | null
  ) => void;
  setLastProgression: (v: number | null) => void;
  setIsRevisionMode: (v: boolean) => void;
  setSelectedFlawIndex: (v: number | null) => void;
}

interface DefenseState {
  isDefending: boolean;
  defenseMessages: DefenseMessage[];
  defenseTurnCount: number;
  defenseInput: string;
  isDefenseLoading: boolean;
  setIsDefending: (v: boolean) => void;
  setDefenseMessages: (v: DefenseMessage[] | ((prev: DefenseMessage[]) => DefenseMessage[])) => void;
  setDefenseTurnCount: (v: number | ((prev: number) => number)) => void;
  setDefenseInput: (v: string) => void;
  setIsDefenseLoading: (v: boolean) => void;
}

interface GalleryState {
  galleryPlacement: GalleryPlacementType;
  galleryConsent: boolean | null;
  currentGallery: 'HALL_OF_FAME' | 'WALL_OF_DEATH' | 'COMMUNITY';
  galleryItems: GalleryItem[];
  setGalleryPlacement: (v: GalleryPlacementType) => void;
  setGalleryConsent: (v: boolean | null) => void;
  setCurrentGallery: (v: 'HALL_OF_FAME' | 'WALL_OF_DEATH' | 'COMMUNITY') => void;
  setGalleryItems: (v: GalleryItem[] | ((prev: GalleryItem[]) => GalleryItem[])) => void;
}

interface UiState {
  isAuthModalOpen: boolean;
  checkoutMessage: string | null;
  toasts: Toast[];
  guestDrawingCount: number; // P0.3: Track guest mode drawings (limit: 1)
  showGuestUpgradePrompt: boolean; // Show upgrade modal after guest completes 1st drawing
  setIsAuthModalOpen: (v: boolean) => void;
  setCheckoutMessage: (v: string | null) => void;
  addToast: (message: string, type?: Toast['type'], duration?: number) => void;
  removeToast: (id: number) => void;
  setGuestDrawingCount: (v: number) => void;
  setShowGuestUpgradePrompt: (v: boolean) => void;
}

interface ArchBuilderState {
  archBuilderProject: ArchBuilderProjectSummary | null;
  archBuilderSession: ArchBuilderSessionSummary | null;
  archBuilderCurrentStep: string | null;
  archBuilderOutputs: Record<string, ArchBuilderStepOutputState>;
  archBuilderExports: ArchBuilderExportSummary[];
  archBuilderBusy: boolean;
  archBuilderError: string | null;
  archBuilderHydrated: boolean;
  setArchBuilderProject: (v: ArchBuilderProjectSummary | null) => void;
  setArchBuilderSession: (
    v:
      | ArchBuilderSessionSummary
      | null
      | ((prev: ArchBuilderSessionSummary | null) => ArchBuilderSessionSummary | null)
  ) => void;
  setArchBuilderCurrentStep: (v: string | null) => void;
  setArchBuilderStepOutput: (stepKey: string, v: ArchBuilderStepOutputState) => void;
  setArchBuilderOutputs: (
    v:
      | Record<string, ArchBuilderStepOutputState>
      | ((
          prev: Record<string, ArchBuilderStepOutputState>,
        ) => Record<string, ArchBuilderStepOutputState>)
  ) => void;
  setArchBuilderExports: (
    v:
      | ArchBuilderExportSummary[]
      | ((prev: ArchBuilderExportSummary[]) => ArchBuilderExportSummary[])
  ) => void;
  setArchBuilderBusy: (v: boolean) => void;
  setArchBuilderError: (v: string | null) => void;
  hydrateArchBuilderState: () => void;
  resetArchBuilder: () => void;
}

// ---------------------------------------------------------------------------
// Compound action slices (cross-domain convenience actions)
// ---------------------------------------------------------------------------

interface CompoundActions {
  /** Reset all image/result/defense state — used when navigating away from a result */
  resetSession: () => void;
  /** Full reset back to hero */
  goHome: () => void;
  /** Reset for new project (keep form, go to upload) */
  startNewProject: () => void;
  /** Reset for revision (set revision mode, go to upload) */
  startRevision: () => void;
}

// ---------------------------------------------------------------------------
// Combined store type
// ---------------------------------------------------------------------------

export type DrawOrDieStore = StepState &
  ImageState &
  FormState &
  ResultState &
  DefenseState &
  GalleryState &
  ArchBuilderState &
  UiState &
  CompoundActions;

export interface AdditionalUpload {
  name: string;
  mimeType: string;
  base64: string;
  sizeBytes: number;
}

export interface ArchBuilderProjectSummary {
  id: string;
  title: string;
  projectType: string;
  location: string;
  targetAreaM2: number;
}

export interface ArchBuilderSessionSummary {
  id: string;
  projectId: string;
  currentStep: string;
  status: string;
  confidenceScore?: number;
}

export interface ArchBuilderExportSummary {
  id: string;
  format: string;
  status: string;
  artifactUrl: string | null;
  previewUrl: string | null;
  includeFurniture?: boolean;
  createdAt?: string;
}

export interface ArchBuilderStepOutputState {
  output: Record<string, unknown> | null;
  clarifications: string[];
  requiresApproval: boolean;
  confidenceScore: number | null;
}

const ARCHBUILDER_STATE_STORAGE_KEY = 'drawOrDieArchBuilderState_v1';

interface PersistedArchBuilderState {
  project: ArchBuilderProjectSummary | null;
  session: ArchBuilderSessionSummary | null;
  currentStep: string | null;
  outputs: Record<string, ArchBuilderStepOutputState>;
  exports: ArchBuilderExportSummary[];
  error: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function parseArchBuilderProject(value: unknown): ArchBuilderProjectSummary | null {
  const parsed = asRecord(value);
  if (!parsed) {
    return null;
  }

  const id = typeof parsed.id === 'string' ? parsed.id : '';
  const title = typeof parsed.title === 'string' ? parsed.title : '';
  const projectType = typeof parsed.projectType === 'string' ? parsed.projectType : '';
  const location = typeof parsed.location === 'string' ? parsed.location : '';
  const targetAreaM2 = typeof parsed.targetAreaM2 === 'number' && Number.isFinite(parsed.targetAreaM2)
    ? parsed.targetAreaM2
    : null;

  if (!id || !title || !projectType || !location || targetAreaM2 === null) {
    return null;
  }

  return {
    id,
    title,
    projectType,
    location,
    targetAreaM2,
  };
}

function parseArchBuilderSession(value: unknown): ArchBuilderSessionSummary | null {
  const parsed = asRecord(value);
  if (!parsed) {
    return null;
  }

  const id = typeof parsed.id === 'string' ? parsed.id : '';
  const projectId = typeof parsed.projectId === 'string' ? parsed.projectId : '';
  const currentStep = typeof parsed.currentStep === 'string' ? parsed.currentStep : '';
  const status = typeof parsed.status === 'string' ? parsed.status : '';

  if (!id || !projectId || !currentStep || !status) {
    return null;
  }

  const confidenceScore =
    typeof parsed.confidenceScore === 'number' && Number.isFinite(parsed.confidenceScore)
      ? parsed.confidenceScore
      : undefined;

  return {
    id,
    projectId,
    currentStep,
    status,
    confidenceScore,
  };
}

function parseArchBuilderOutput(value: unknown): ArchBuilderStepOutputState | null {
  const parsed = asRecord(value);
  if (!parsed) {
    return null;
  }

  const output = asRecord(parsed.output);
  const clarifications = Array.isArray(parsed.clarifications)
    ? parsed.clarifications.map((item) => String(item))
    : [];
  const requiresApproval = Boolean(parsed.requiresApproval);
  const confidenceScore =
    typeof parsed.confidenceScore === 'number' && Number.isFinite(parsed.confidenceScore)
      ? parsed.confidenceScore
      : null;

  return {
    output,
    clarifications,
    requiresApproval,
    confidenceScore,
  };
}

function parseArchBuilderExport(value: unknown): ArchBuilderExportSummary | null {
  const parsed = asRecord(value);
  if (!parsed) {
    return null;
  }

  const id = typeof parsed.id === 'string' ? parsed.id : '';
  const format = typeof parsed.format === 'string' ? parsed.format : '';
  const status = typeof parsed.status === 'string' ? parsed.status : '';

  if (!id || !format || !status) {
    return null;
  }

  return {
    id,
    format,
    status,
    artifactUrl: typeof parsed.artifactUrl === 'string' ? parsed.artifactUrl : null,
    previewUrl: typeof parsed.previewUrl === 'string' ? parsed.previewUrl : null,
    includeFurniture:
      typeof parsed.includeFurniture === 'boolean'
        ? parsed.includeFurniture
        : undefined,
    createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : undefined,
  };
}

function readArchBuilderPersistedState(): PersistedArchBuilderState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(ARCHBUILDER_STATE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = asRecord(JSON.parse(raw));
    if (!parsed) {
      return null;
    }

    const outputMap: Record<string, ArchBuilderStepOutputState> = {};
    const outputsRaw = asRecord(parsed.outputs);
    if (outputsRaw) {
      for (const [stepKey, output] of Object.entries(outputsRaw)) {
        const parsedOutput = parseArchBuilderOutput(output);
        if (parsedOutput) {
          outputMap[stepKey] = parsedOutput;
        }
      }
    }

    const exportItems: ArchBuilderExportSummary[] = [];
    if (Array.isArray(parsed.exports)) {
      for (const item of parsed.exports) {
        const parsedExport = parseArchBuilderExport(item);
        if (parsedExport) {
          exportItems.push(parsedExport);
        }
      }
    }

    const currentStep =
      typeof parsed.currentStep === 'string' && parsed.currentStep.trim().length > 0
        ? parsed.currentStep
        : null;

    const error =
      typeof parsed.error === 'string' && parsed.error.trim().length > 0
        ? parsed.error
        : null;

    return {
      project: parseArchBuilderProject(parsed.project),
      session: parseArchBuilderSession(parsed.session),
      currentStep,
      outputs: outputMap,
      exports: exportItems,
      error,
    };
  } catch {
    return null;
  }
}

function writeArchBuilderPersistedState(state: PersistedArchBuilderState): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(ARCHBUILDER_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore persistence errors in restrictive browser modes.
  }
}

function clearArchBuilderPersistedState(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(ARCHBUILDER_STATE_STORAGE_KEY);
  } catch {
    // Ignore cleanup errors.
  }
}

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

const DEFAULT_FORM_DATA: FormData = {
  topic: '',
  site: '',
  concept: '',
  defense: '',
  category: 'Vaziyet Planı',
  harshness: 3,
  analysisLength: 'SHORT',
  singlePersonaId: 'constructive',
  multiPersonaIds: ['structural', 'conceptual', 'grumpy'],
};

// Gallery items are now loaded from Supabase via useGallery hook.
// The store starts empty; call fetchGallery() when navigating to the gallery step.

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useDrawOrDieStore = create<DrawOrDieStore>((set, get) => {
  const persistArchBuilderStateFromStore = () => {
    const state = get();
    writeArchBuilderPersistedState({
      project: state.archBuilderProject,
      session: state.archBuilderSession,
      currentStep: state.archBuilderCurrentStep,
      outputs: state.archBuilderOutputs,
      exports: state.archBuilderExports,
      error: state.archBuilderError,
    });
  };

  return {
  // ---- Step ----------------------------------------------------------------
  step: 'hero',
  setStep: (step) => set({ step }),

  // ---- Image ---------------------------------------------------------------
  image: null,
  imageBase64: null,
  additionalUploads: [],
  mimeType: null,
  previewUrl: null,
  pdfText: null,
  uploadValidationError: null,
  setImage: (image) => set({ image }),
  setImageBase64: (imageBase64) => set({ imageBase64 }),
  setAdditionalUploads: (additionalUploads) => set({ additionalUploads }),
  setMimeType: (mimeType) => set({ mimeType }),
  setPreviewUrl: (previewUrl) => set({ previewUrl }),
  setPdfText: (pdfText) => set({ pdfText }),
  setUploadValidationError: (uploadValidationError) => set({ uploadValidationError }),

  // ---- Form ----------------------------------------------------------------
  formData: DEFAULT_FORM_DATA,
  setFormData: (data) =>
    set((state) => ({
      formData: typeof data === 'function' ? data(state.formData) : data,
    })),

  // ---- Result --------------------------------------------------------------
  critique: null,
  premiumData: null,
  multiData: null,
  latestAnalysisKind: null,
  previousProject: null,
  lastProgression: null,
  isRevisionMode: false,
  selectedFlawIndex: null,
  setCritique: (critique) => set({ critique }),
  setPremiumData: (premiumData) => set({ premiumData }),
  setMultiData: (multiData) => set({ multiData }),
  setLatestAnalysisKind: (latestAnalysisKind) => set({ latestAnalysisKind }),
  setPreviousProject: (previousProject) => set({ previousProject }),
  setLastProgression: (lastProgression) => set({ lastProgression }),
  setIsRevisionMode: (isRevisionMode) => set({ isRevisionMode }),
  setSelectedFlawIndex: (selectedFlawIndex) => set({ selectedFlawIndex }),

  // ---- Defense -------------------------------------------------------------
  isDefending: false,
  defenseMessages: [],
  defenseTurnCount: 0,
  defenseInput: '',
  isDefenseLoading: false,
  setIsDefending: (isDefending) => set({ isDefending }),
  setDefenseMessages: (v) =>
    set((state) => ({
      defenseMessages: typeof v === 'function' ? v(state.defenseMessages) : v,
    })),
  setDefenseTurnCount: (v) =>
    set((state) => ({
      defenseTurnCount: typeof v === 'function' ? v(state.defenseTurnCount) : v,
    })),
  setDefenseInput: (defenseInput) => set({ defenseInput }),
  setIsDefenseLoading: (isDefenseLoading) => set({ isDefenseLoading }),

  // ---- Gallery -------------------------------------------------------------
  galleryPlacement: 'NONE',
  galleryConsent: null,
  currentGallery: 'WALL_OF_DEATH',
  galleryItems: [],
  setGalleryPlacement: (galleryPlacement) => set({ galleryPlacement }),
  setGalleryConsent: (galleryConsent) => set({ galleryConsent }),
  setCurrentGallery: (currentGallery) => set({ currentGallery }),
  setGalleryItems: (v) =>
    set((state) => ({
      galleryItems: typeof v === 'function' ? v(state.galleryItems) : v,
    })),

  // ---- UI ------------------------------------------------------------------
  isAuthModalOpen: false,
  checkoutMessage: null,
  toasts: [],
  guestDrawingCount: 0,
  showGuestUpgradePrompt: false,
  setIsAuthModalOpen: (isAuthModalOpen) => set({ isAuthModalOpen }),
  setCheckoutMessage: (checkoutMessage) => set({ checkoutMessage }),
  addToast: (message, type = 'info', duration = 4000) => {
    const id = ++_toastId;
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => get().removeToast(id), duration);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  setGuestDrawingCount: (guestDrawingCount) => set({ guestDrawingCount }),
  setShowGuestUpgradePrompt: (showGuestUpgradePrompt) => set({ showGuestUpgradePrompt }),

  // ---- ArchBuilder ---------------------------------------------------------
  archBuilderProject: null,
  archBuilderSession: null,
  archBuilderCurrentStep: null,
  archBuilderOutputs: {},
  archBuilderExports: [],
  archBuilderBusy: false,
  archBuilderError: null,
  archBuilderHydrated: false,
  setArchBuilderProject: (archBuilderProject) => {
    set({ archBuilderProject });
    persistArchBuilderStateFromStore();
  },
  setArchBuilderSession: (v) => {
    set((state) => ({
      archBuilderSession: typeof v === 'function' ? v(state.archBuilderSession) : v,
    }));
    persistArchBuilderStateFromStore();
  },
  setArchBuilderCurrentStep: (archBuilderCurrentStep) => {
    set({ archBuilderCurrentStep });
    persistArchBuilderStateFromStore();
  },
  setArchBuilderStepOutput: (stepKey, v) => {
    set((state) => ({
      archBuilderOutputs: {
        ...state.archBuilderOutputs,
        [stepKey]: v,
      },
    }));
    persistArchBuilderStateFromStore();
  },
  setArchBuilderOutputs: (v) => {
    set((state) => ({
      archBuilderOutputs: typeof v === 'function' ? v(state.archBuilderOutputs) : v,
    }));
    persistArchBuilderStateFromStore();
  },
  setArchBuilderExports: (v) => {
    set((state) => ({
      archBuilderExports: typeof v === 'function' ? v(state.archBuilderExports) : v,
    }));
    persistArchBuilderStateFromStore();
  },
  setArchBuilderBusy: (archBuilderBusy) => set({ archBuilderBusy }),
  setArchBuilderError: (archBuilderError) => {
    set({ archBuilderError });
    persistArchBuilderStateFromStore();
  },
  hydrateArchBuilderState: () => {
    const persisted = readArchBuilderPersistedState();
    if (!persisted) {
      set({ archBuilderHydrated: true });
      return;
    }

    set({
      archBuilderProject: persisted.project,
      archBuilderSession: persisted.session,
      archBuilderCurrentStep: persisted.currentStep,
      archBuilderOutputs: persisted.outputs,
      archBuilderExports: persisted.exports,
      archBuilderError: persisted.error,
      archBuilderHydrated: true,
    });
  },
  resetArchBuilder: () => {
    set({
      archBuilderProject: null,
      archBuilderSession: null,
      archBuilderCurrentStep: null,
      archBuilderOutputs: {},
      archBuilderExports: [],
      archBuilderBusy: false,
      archBuilderError: null,
      archBuilderHydrated: true,
    });
    clearArchBuilderPersistedState();
  },

  // ---- Compound actions ----------------------------------------------------

  resetSession: () =>
    set({
      image: null,
      imageBase64: null,
      additionalUploads: [],
      mimeType: null,
      previewUrl: null,
      critique: null,
      premiumData: null,
      latestAnalysisKind: null,
      lastProgression: null,
      galleryPlacement: 'NONE',
      galleryConsent: null,
      pdfText: null,
      uploadValidationError: null,
      isDefending: false,
      defenseMessages: [],
      defenseTurnCount: 0,
      defenseInput: '',
    }),

  goHome: () =>
    set({
      step: 'hero',
      image: null,
      imageBase64: null,
      additionalUploads: [],
      mimeType: null,
      previewUrl: null,
      critique: null,
      premiumData: null,
      latestAnalysisKind: null,
      isRevisionMode: false,
      selectedFlawIndex: null,
      lastProgression: null,
      galleryPlacement: 'NONE',
      galleryConsent: null,
      pdfText: null,
      uploadValidationError: null,
      isDefending: false,
      defenseMessages: [],
      defenseTurnCount: 0,
      defenseInput: '',
    }),

  startNewProject: () =>
    set({
      step: 'upload',
      image: null,
      imageBase64: null,
      additionalUploads: [],
      mimeType: null,
      previewUrl: null,
      critique: null,
      premiumData: null,
      isRevisionMode: false,
      lastProgression: null,
      previousProject: null,
      galleryPlacement: 'NONE',
      galleryConsent: null,
      pdfText: null,
      uploadValidationError: null,
      isDefending: false,
      defenseMessages: [],
      defenseTurnCount: 0,
      defenseInput: '',
    }),

  startRevision: () =>
    set({
      step: 'upload',
      image: null,
      imageBase64: null,
      additionalUploads: [],
      mimeType: null,
      previewUrl: null,
      critique: null,
      premiumData: null,
      latestAnalysisKind: null,
      isRevisionMode: true,
      selectedFlawIndex: null,
      lastProgression: null,
      galleryPlacement: 'NONE',
      galleryConsent: null,
      pdfText: null,
      uploadValidationError: null,
      isDefending: false,
      defenseMessages: [],
      defenseTurnCount: 0,
      defenseInput: '',
    }),
  };
});
