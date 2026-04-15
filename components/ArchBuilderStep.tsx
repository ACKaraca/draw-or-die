'use client';

import { useEffect, useMemo, useState } from 'react';
import { Layers, Play, CheckCircle2, PencilRuler, Sofa, Download, Loader2 } from 'lucide-react';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import {
  useDrawOrDieStore,
  type ArchBuilderExportSummary,
  type ArchBuilderProjectSummary,
  type ArchBuilderSessionSummary,
} from '@/stores/drawOrDieStore';

interface ArchBuilderStepProps {
  onAuthRequired: () => void;
}

export function ArchBuilderStep({ onAuthRequired }: ArchBuilderStepProps) {
  const language = useLanguage();
  const { user, getJWT } = useAuth();

  const [title, setTitle] = useState('Studio Courtyard Housing');
  const [projectType, setProjectType] = useState('Residential');
  const [location, setLocation] = useState('Antalya / Muratpasa');
  const [targetAreaM2, setTargetAreaM2] = useState(3600);

  const archBuilderProject = useDrawOrDieStore((s) => s.archBuilderProject);
  const archBuilderSession = useDrawOrDieStore((s) => s.archBuilderSession);
  const archBuilderCurrentStep = useDrawOrDieStore((s) => s.archBuilderCurrentStep);
  const archBuilderOutputs = useDrawOrDieStore((s) => s.archBuilderOutputs);
  const archBuilderExports = useDrawOrDieStore((s) => s.archBuilderExports);
  const archBuilderError = useDrawOrDieStore((s) => s.archBuilderError);
  const archBuilderBusy = useDrawOrDieStore((s) => s.archBuilderBusy);
  const archBuilderHydrated = useDrawOrDieStore((s) => s.archBuilderHydrated);

  const hydrateArchBuilderState = useDrawOrDieStore((s) => s.hydrateArchBuilderState);
  const setArchBuilderProject = useDrawOrDieStore((s) => s.setArchBuilderProject);
  const setArchBuilderSession = useDrawOrDieStore((s) => s.setArchBuilderSession);
  const setArchBuilderCurrentStep = useDrawOrDieStore((s) => s.setArchBuilderCurrentStep);
  const setArchBuilderStepOutput = useDrawOrDieStore((s) => s.setArchBuilderStepOutput);
  const setArchBuilderOutputs = useDrawOrDieStore((s) => s.setArchBuilderOutputs);
  const setArchBuilderExports = useDrawOrDieStore((s) => s.setArchBuilderExports);
  const setArchBuilderBusy = useDrawOrDieStore((s) => s.setArchBuilderBusy);
  const setArchBuilderError = useDrawOrDieStore((s) => s.setArchBuilderError);

  useEffect(() => {
    if (!archBuilderHydrated) {
      hydrateArchBuilderState();
    }
  }, [archBuilderHydrated, hydrateArchBuilderState]);

  const activeStepKey = archBuilderCurrentStep ?? archBuilderSession?.currentStep ?? null;
  const activeStepState = activeStepKey ? archBuilderOutputs[activeStepKey] : undefined;
  const stepOutput = activeStepState?.output ?? null;

  const copy = useMemo(() => ({
    title: pickLocalized(language, 'ArchBuilder (MVP)', 'ArchBuilder (MVP)'),
    subtitle: pickLocalized(language, 'Aşamalı mimari plan üretimi: intent -> onay -> çizim -> export.', 'Progressive architectural planning: intent -> approvals -> drawing -> export.'),
    authRequired: pickLocalized(language, 'ArchBuilder için giriş yapmalısınız.', 'You need to sign in to use ArchBuilder.'),
    createProject: pickLocalized(language, 'Projeyi Başlat', 'Start Project'),
    runStep: pickLocalized(language, 'Adımı Üret', 'Run Step'),
    approveStep: pickLocalized(language, 'Adımı Onayla', 'Approve Step'),
    generateDrawing: pickLocalized(language, 'Çizim Üret', 'Generate Drawing'),
    placeFurniture: pickLocalized(language, 'Mobilya Yerleştir', 'Place Furniture'),
    loadExports: pickLocalized(language, 'Exportları Getir', 'Load Exports'),
    intentCard: pickLocalized(language, 'Proje Niyeti', 'Project Intent'),
    stepCard: pickLocalized(language, 'Adım Çıktısı', 'Step Output'),
    exportsCard: pickLocalized(language, 'Dışa Aktarım', 'Exports'),
    labelTitle: pickLocalized(language, 'Başlık', 'Title'),
    labelType: pickLocalized(language, 'Tür', 'Type'),
    labelLocation: pickLocalized(language, 'Konum', 'Location'),
    labelTargetArea: pickLocalized(language, 'Hedef Alan (m2)', 'Target Area (m2)'),
    labelProject: pickLocalized(language, 'Proje', 'Project'),
    labelSession: pickLocalized(language, 'Oturum', 'Session'),
    labelStep: pickLocalized(language, 'Adım', 'Step'),
    labelStatus: pickLocalized(language, 'Durum', 'Status'),
    labelFormat: pickLocalized(language, 'Format', 'Format'),
    labelArtifact: pickLocalized(language, 'Artefakt', 'Artifact'),
    labelConfidence: pickLocalized(language, 'Güven', 'Confidence'),
    labelApproval: pickLocalized(language, 'Onay', 'Approval'),
    approvalRequired: pickLocalized(language, 'Onay bekliyor', 'Approval required'),
    approvalCompleted: pickLocalized(language, 'Onaylandı', 'Approved'),
    clarificationsCard: pickLocalized(language, 'Açıklama Soruları', 'Clarification Questions'),
    noClarificationsYet: pickLocalized(language, 'Ek açıklama sorusu yok', 'No clarification questions'),
    noStepOutputYet: pickLocalized(language, 'Henüz adım çıktısı yok', 'No step output yet'),
    noExportsYet: pickLocalized(language, 'Henüz dışa aktarım yok', 'No exports yet'),
    working: pickLocalized(language, 'Çalışıyor...', 'Working...'),
  }), [language]);

  const authedFetch = async (url: string, init?: RequestInit): Promise<Response> => {
    if (!user) {
      onAuthRequired();
      throw new Error(copy.authRequired);
    }

    const jwt = await getJWT();
    return fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
        ...(init?.headers ?? {}),
      },
    });
  };

  const toOutputRecord = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  };

  const createProjectAndSession = async () => {
    setArchBuilderBusy(true);
    setArchBuilderError(null);

    try {
      const projectRes = await authedFetch('/api/archbuilder/projects', {
        method: 'POST',
        body: JSON.stringify({
          title,
          projectType,
          location,
          targetAreaM2,
          constraints: [],
          priorities: ['Daylight', 'Walkability'],
        }),
      });

      const projectPayload = await projectRes.json().catch(() => ({}));
      if (!projectRes.ok || !projectPayload?.project?.id) {
        throw new Error(projectPayload?.error || 'ARCHBUILDER_PROJECT_CREATE_FAILED');
      }

      const nextProject = projectPayload.project as ArchBuilderProjectSummary;
      setArchBuilderProject(nextProject);

      const sessionRes = await authedFetch('/api/archbuilder/sessions', {
        method: 'POST',
        body: JSON.stringify({ projectId: nextProject.id }),
      });

      const sessionPayload = await sessionRes.json().catch(() => ({}));
      if (!sessionRes.ok || !sessionPayload?.session?.id) {
        throw new Error(sessionPayload?.error || 'ARCHBUILDER_SESSION_CREATE_FAILED');
      }

      const nextSession = sessionPayload.session as ArchBuilderSessionSummary;
      setArchBuilderSession(nextSession);
      setArchBuilderCurrentStep(nextSession.currentStep);
      setArchBuilderOutputs({});
      setArchBuilderExports([]);
    } catch (e) {
      setArchBuilderError(e instanceof Error ? e.message : 'ARCHBUILDER_CREATE_FAILED');
    } finally {
      setArchBuilderBusy(false);
    }
  };

  const runCurrentStep = async () => {
    if (!archBuilderSession) return;

    setArchBuilderBusy(true);
    setArchBuilderError(null);
    try {
      const res = await authedFetch(`/api/archbuilder/sessions/${archBuilderSession.id}/orchestrate`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || 'ARCHBUILDER_ORCHESTRATE_FAILED');
      }

      const nextStep = typeof payload.step === 'string' ? payload.step : archBuilderSession.currentStep;

      setArchBuilderCurrentStep(nextStep);
      setArchBuilderSession((prev) => (prev ? { ...prev, currentStep: nextStep } : prev));
      setArchBuilderStepOutput(nextStep, {
        output: toOutputRecord(payload.output),
        clarifications: Array.isArray(payload.clarifications)
          ? payload.clarifications.map((item: unknown) => String(item))
          : [],
        requiresApproval: Boolean(payload.requiresApproval),
        confidenceScore:
          typeof payload.confidenceScore === 'number' && Number.isFinite(payload.confidenceScore)
            ? payload.confidenceScore
            : null,
      });
    } catch (e) {
      setArchBuilderError(e instanceof Error ? e.message : 'ARCHBUILDER_ORCHESTRATE_FAILED');
    } finally {
      setArchBuilderBusy(false);
    }
  };

  const approveCurrentStep = async () => {
    if (!archBuilderSession || !activeStepKey) return;

    setArchBuilderBusy(true);
    setArchBuilderError(null);
    try {
      const res = await authedFetch(`/api/archbuilder/sessions/${archBuilderSession.id}/approve-step`, {
        method: 'POST',
        body: JSON.stringify({
          stepKey: activeStepKey,
          approved: true,
          editedOutput: stepOutput,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || 'ARCHBUILDER_APPROVAL_FAILED');
      }

      const nextStep = typeof payload.currentStep === 'string' ? payload.currentStep : activeStepKey;

      setArchBuilderCurrentStep(nextStep);
      setArchBuilderSession((prev) =>
        prev
          ? {
              ...prev,
              currentStep: nextStep,
              status: typeof payload.status === 'string' ? payload.status : prev.status,
            }
          : prev,
      );
      setArchBuilderStepOutput(activeStepKey, {
        output: stepOutput,
        clarifications: activeStepState?.clarifications ?? [],
        requiresApproval: false,
        confidenceScore: activeStepState?.confidenceScore ?? null,
      });
    } catch (e) {
      setArchBuilderError(e instanceof Error ? e.message : 'ARCHBUILDER_APPROVAL_FAILED');
    } finally {
      setArchBuilderBusy(false);
    }
  };

  const generateDrawing = async () => {
    if (!archBuilderSession) return;

    setArchBuilderBusy(true);
    setArchBuilderError(null);
    try {
      const res = await authedFetch(`/api/archbuilder/sessions/${archBuilderSession.id}/generate-drawing`, {
        method: 'POST',
        body: JSON.stringify({ formats: ['DXF', 'PNG'] }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || 'ARCHBUILDER_DRAWING_FAILED');
      }

      setArchBuilderCurrentStep('drawing');
      setArchBuilderSession((prev) => (prev ? { ...prev, currentStep: 'drawing' } : prev));
      setArchBuilderStepOutput('drawing', {
        output: toOutputRecord(payload.drawing),
        clarifications: [],
        requiresApproval: false,
        confidenceScore: null,
      });
      setArchBuilderExports((payload.exports ?? []) as ArchBuilderExportSummary[]);
    } catch (e) {
      setArchBuilderError(e instanceof Error ? e.message : 'ARCHBUILDER_DRAWING_FAILED');
    } finally {
      setArchBuilderBusy(false);
    }
  };

  const placeFurniture = async () => {
    if (!archBuilderSession) return;

    setArchBuilderBusy(true);
    setArchBuilderError(null);
    try {
      const res = await authedFetch(`/api/archbuilder/sessions/${archBuilderSession.id}/place-furniture`, {
        method: 'POST',
        body: JSON.stringify({
          quantities: {
            table: 4,
            chair: 8,
            flower: 4,
            tree: 2,
          },
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || 'ARCHBUILDER_FURNITURE_FAILED');
      }

      setArchBuilderCurrentStep('furniture');
      setArchBuilderSession((prev) => (prev ? { ...prev, currentStep: 'furniture' } : prev));
      setArchBuilderStepOutput('furniture', {
        output: {
          placements: Array.isArray(payload.placements) ? payload.placements : [],
          collisions:
            typeof payload.collisions === 'number' && Number.isFinite(payload.collisions)
              ? payload.collisions
              : 0,
        },
        clarifications: [],
        requiresApproval: false,
        confidenceScore: null,
      });

      await loadExports({ silent: true });
    } catch (e) {
      setArchBuilderError(e instanceof Error ? e.message : 'ARCHBUILDER_FURNITURE_FAILED');
    } finally {
      setArchBuilderBusy(false);
    }
  };

  const loadExports = async (options?: { silent?: boolean }) => {
    if (!archBuilderSession) return;

    if (!options?.silent) {
      setArchBuilderBusy(true);
      setArchBuilderError(null);
    }

    try {
      const res = await authedFetch(`/api/archbuilder/sessions/${archBuilderSession.id}/exports`, {
        method: 'GET',
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || 'ARCHBUILDER_EXPORTS_FAILED');
      }

      setArchBuilderExports((payload.exports ?? []) as ArchBuilderExportSummary[]);
    } catch (e) {
      setArchBuilderError(e instanceof Error ? e.message : 'ARCHBUILDER_EXPORTS_FAILED');
    } finally {
      if (!options?.silent) {
        setArchBuilderBusy(false);
      }
    }
  };

  return (
    <section className="w-full max-w-6xl rounded-2xl border border-white/10 bg-black/30 p-5 md:p-8">
      <div className="mb-6">
        <h2 className="font-display text-2xl uppercase tracking-wide text-white">{copy.title}</h2>
        <p className="mt-2 text-sm text-slate-300">{copy.subtitle}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center gap-2 text-slate-100">
            <Layers size={16} className="text-cyan-300" />
            <h3 className="font-mono text-xs uppercase tracking-widest">{copy.intentCard}</h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-300">
              <span className="mb-1 block">{copy.labelTitle}</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white" />
            </label>
            <label className="text-xs text-slate-300">
              <span className="mb-1 block">{copy.labelType}</span>
              <input value={projectType} onChange={(e) => setProjectType(e.target.value)} className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white" />
            </label>
            <label className="text-xs text-slate-300">
              <span className="mb-1 block">{copy.labelLocation}</span>
              <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white" />
            </label>
            <label className="text-xs text-slate-300">
              <span className="mb-1 block">{copy.labelTargetArea}</span>
              <input
                type="number"
                min={1}
                step={50}
                value={targetAreaM2}
                onChange={(e) => setTargetAreaM2(Number(e.target.value) || 1)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={createProjectAndSession} disabled={archBuilderBusy} className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-xs font-mono uppercase tracking-wider text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50">
              <Play size={14} />
              {copy.createProject}
            </button>
            <button type="button" onClick={runCurrentStep} disabled={archBuilderBusy || !archBuilderSession} className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-mono uppercase tracking-wider text-slate-100 hover:bg-white/10 disabled:opacity-50">
              <Play size={14} />
              {copy.runStep}
            </button>
            <button type="button" onClick={approveCurrentStep} disabled={archBuilderBusy || !archBuilderSession || !activeStepKey} className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-mono uppercase tracking-wider text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50">
              <CheckCircle2 size={14} />
              {copy.approveStep}
            </button>
            <button type="button" onClick={generateDrawing} disabled={archBuilderBusy || !archBuilderSession} className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-mono uppercase tracking-wider text-amber-100 hover:bg-amber-500/20 disabled:opacity-50">
              <PencilRuler size={14} />
              {copy.generateDrawing}
            </button>
            <button type="button" onClick={placeFurniture} disabled={archBuilderBusy || !archBuilderSession} className="inline-flex items-center gap-2 rounded-lg border border-purple-500/40 bg-purple-500/10 px-3 py-2 text-xs font-mono uppercase tracking-wider text-purple-100 hover:bg-purple-500/20 disabled:opacity-50">
              <Sofa size={14} />
              {copy.placeFurniture}
            </button>
            <button type="button" onClick={() => { void loadExports(); }} disabled={archBuilderBusy || !archBuilderSession} className="inline-flex items-center gap-2 rounded-lg border border-neon-red/40 bg-neon-red/10 px-3 py-2 text-xs font-mono uppercase tracking-wider text-neon-red hover:bg-neon-red/20 disabled:opacity-50">
              <Download size={14} />
              {copy.loadExports}
            </button>
          </div>

          {archBuilderProject ? (
            <div className="mt-4 rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-slate-300">
              <p>{copy.labelProject}: <span className="text-white">{archBuilderProject.title}</span></p>
              <p>{copy.labelSession}: <span className="text-white">{archBuilderSession?.id ?? '-'}</span></p>
              <p>{copy.labelStep}: <span className="text-white">{activeStepKey ?? '-'}</span></p>
              <p>{copy.labelStatus}: <span className="text-white">{archBuilderSession?.status ?? '-'}</span></p>
            </div>
          ) : null}

          {archBuilderError ? <p className="mt-3 text-xs text-red-300">{archBuilderError}</p> : null}
          {archBuilderBusy ? <p className="mt-3 inline-flex items-center gap-2 text-xs text-slate-300"><Loader2 size={14} className="animate-spin" /> {copy.working}</p> : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="mb-2 font-mono text-xs uppercase tracking-widest text-slate-100">{copy.stepCard}</h3>
            <pre className="max-h-[260px] overflow-auto rounded-lg bg-black/40 p-3 text-[11px] text-slate-300">{JSON.stringify(stepOutput ?? { status: copy.noStepOutputYet }, null, 2)}</pre>
            {activeStepState ? (
              <div className="mt-3 space-y-1 text-[11px] text-slate-300">
                <p>
                  <span className="text-slate-400">{copy.labelConfidence}:</span>{' '}
                  <span className="text-white">
                    {activeStepState.confidenceScore === null
                      ? '-'
                      : `${Math.round(activeStepState.confidenceScore)}%`}
                  </span>
                </p>
                <p>
                  <span className="text-slate-400">{copy.labelApproval}:</span>{' '}
                  <span className="text-white">
                    {activeStepState.requiresApproval ? copy.approvalRequired : copy.approvalCompleted}
                  </span>
                </p>
              </div>
            ) : null}
            <div className="mt-3">
              <h4 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-300">{copy.clarificationsCard}</h4>
              {activeStepState?.clarifications?.length ? (
                <ul className="space-y-1 text-xs text-slate-300">
                  {activeStepState.clarifications.map((item, index) => (
                    <li key={`${activeStepKey ?? 'step'}-clarification-${index}`} className="rounded bg-black/30 px-2 py-1">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">{copy.noClarificationsYet}</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="mb-2 font-mono text-xs uppercase tracking-widest text-slate-100">{copy.exportsCard}</h3>
            <ul className="space-y-2 text-xs text-slate-300">
              {archBuilderExports.length === 0 ? <li>{copy.noExportsYet}</li> : null}
              {archBuilderExports.map((item) => (
                <li key={item.id} className="rounded-lg border border-white/10 bg-black/30 p-2">
                  <p><span className="text-slate-400">{copy.labelFormat}:</span> <span className="text-white">{item.format}</span></p>
                  <p><span className="text-slate-400">{copy.labelStatus}:</span> <span className="text-white">{item.status}</span></p>
                  <p><span className="text-slate-400">{copy.labelArtifact}:</span> <span className="text-white break-all">{item.artifactUrl ?? '-'}</span></p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
