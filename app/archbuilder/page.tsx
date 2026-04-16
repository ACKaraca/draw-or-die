'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Compass, FileDown, LayoutGrid, Ruler } from 'lucide-react';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';

const PLANNING_STEPS = ['site', 'constraints', 'envelope', 'program', 'stacking', 'adjacency'] as const;

const FEATURE_CARDS = [
	{
		icon: Compass,
		titleTr: 'Niyet -> planlama -> çizim',
		titleEn: 'Intent -> planning -> drawing',
		bodyTr:
			'ArchBuilder, proje niyetini adım adım planlama çıktısına dönüştürür ve onaylanan adımlardan çizim üretir.',
		bodyEn:
			'ArchBuilder turns project intent into structured planning outputs and generates drawings from approved steps.',
	},
	{
		icon: LayoutGrid,
		titleTr: 'Deterministik doğrulama',
		titleEn: 'Deterministic validation',
		bodyTr:
			'Program alan toplamı, tekrar eden mekan kontrolü ve kat dağılımı gibi doğrulamalar otomatik uygulanır.',
		bodyEn:
			'Automatic checks cover program area consistency, duplicate spaces, and floor allocation consistency.',
	},
	{
		icon: Ruler,
		titleTr: 'Mobilya yerleşimi + çakışma skoru',
		titleEn: 'Furniture placement + collision scoring',
		bodyTr:
			'MVP varlıklarıyla temel yerleşim yapılır; yerleşim çıktıları export katmanına taşınır.',
		bodyEn:
			'MVP assets support basic placement, and placement outputs are synced into exports.',
	},
	{
		icon: FileDown,
		titleTr: 'DXF odaklı export',
		titleEn: 'DXF-first exports',
		bodyTr:
			'Çıkış formatları DXF ve PNG önizleme odaklıdır; IFC üretimi özellik bayrağı ile kontrollüdür.',
		bodyEn:
			'Exports focus on DXF and PNG previews, while IFC is controlled behind feature flags.',
	},
] as const;

export default function ArchBuilderPage() {
	const language = useLanguage();

	return (
		<div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(245,158,11,0.14),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,0.14),transparent_35%),radial-gradient(circle_at_50%_100%,rgba(34,197,94,0.08),transparent_45%)]" />

			<main className="relative mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 pb-20 pt-28 sm:px-6 lg:px-8">
				<section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm sm:p-10">
					<motion.div
						initial={{ opacity: 0, y: 16 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.45, ease: 'easeOut' }}
						className="max-w-3xl"
					>
						<p className="mb-4 inline-flex rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-amber-200">
							{pickLocalized(language, 'ArchBuilder Tanıtım Ekranı', 'ArchBuilder Intro Screen')}
						</p>
						<h1 className="font-display text-3xl uppercase tracking-wide text-white sm:text-5xl">
							{pickLocalized(
								language,
								'Mimari planlama akışını tek bir omurgada birleştiren yeni modül',
								'A new module unifying architectural planning in one flow',
							)}
						</h1>
						<p className="mt-5 text-sm leading-relaxed text-slate-300 sm:text-base">
							{pickLocalized(
								language,
								'Bu sayfa ArchBuilder projesini tanıtır. Sistem; proje niyeti toplama, adım bazlı planlama, onay checkpointleri, çizim üretimi, mobilya yerleşimi ve export üretimini aynı süreçte birleştirir.',
								'This page introduces the ArchBuilder project. The system combines project intent capture, step-based planning, approval checkpoints, drawing generation, furniture placement, and exports in a single flow.',
							)}
						</p>

						<div className="mt-8 flex flex-wrap gap-3">
							<Link
								href="/"
								className="inline-flex items-center gap-2 border border-amber-300/50 bg-amber-300/10 px-5 py-3 font-mono text-xs uppercase tracking-widest text-amber-100 transition-colors hover:bg-amber-300/20"
							>
								{pickLocalized(language, 'Ana sayfaya dön', 'Back to home')}
								<ArrowRight size={14} />
							</Link>
							<a
								href="/docs/ARCHBUILDER_MVP.md"
								className="inline-flex items-center gap-2 border border-white/25 px-5 py-3 font-mono text-xs uppercase tracking-widest text-slate-200 transition-colors hover:border-white/40 hover:text-white"
							>
								{pickLocalized(language, 'MVP dokümantasyonu', 'MVP documentation')}
							</a>
						</div>
					</motion.div>
				</section>

				<section className="grid gap-4 sm:grid-cols-2">
					{FEATURE_CARDS.map((card, index) => (
						<motion.article
							key={card.titleEn}
							initial={{ opacity: 0, y: 14 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.32, ease: 'easeOut', delay: 0.05 * index }}
							className="rounded-2xl border border-white/10 bg-black/30 p-5"
						>
							<card.icon className="mb-4 h-6 w-6 text-amber-300" strokeWidth={1.5} />
							<h2 className="font-display text-lg uppercase tracking-wide text-white">
								{pickLocalized(language, card.titleTr, card.titleEn)}
							</h2>
							<p className="mt-2 text-sm leading-relaxed text-slate-300">
								{pickLocalized(language, card.bodyTr, card.bodyEn)}
							</p>
						</motion.article>
					))}
				</section>

				<section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 sm:p-8">
					<h2 className="font-display text-xl uppercase tracking-wide text-white sm:text-2xl">
						{pickLocalized(language, 'MVP planlama adımları', 'MVP planning steps')}
					</h2>
					<p className="mt-3 text-sm leading-relaxed text-slate-300">
						{pickLocalized(
							language,
							'Her adım ayrı üretilir, kaydedilir ve onaylanmadan sonraki aşamaya geçilmez.',
							'Each step is generated, persisted, and gated by approval before moving forward.',
						)}
					</p>
					<div className="mt-5 flex flex-wrap gap-2">
						{PLANNING_STEPS.map((step) => (
							<span
								key={step}
								className="inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.15em] text-emerald-200"
							>
								<CheckCircle2 size={12} />
								{step}
							</span>
						))}
					</div>
				</section>
			</main>
		</div>
	);
}
