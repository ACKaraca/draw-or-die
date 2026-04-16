'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { captureUTMFromCurrentUrl, trackConversionEvent } from '@/lib/growth-tracking';
import { normalizeLanguage, pickLocalized, type SupportedLanguage } from '@/lib/i18n';

const ARCHBUILDER_URL =
	'https://archbuilder.app/?utm_source=drawordie&utm_medium=referral&utm_campaign=archbuilder_bridge';

const usageSteps = [
	{
		id: '01',
		tr: 'Kisa bir proje briefi yaz ve arsayi tanimla.',
		en: 'Write a short project brief and define your site context.',
	},
	{
		id: '02',
		tr: 'AI taslagi olustursun, sonra 2D/3D duzenleme ile hizli iyilestir.',
		en: 'Generate an AI draft, then improve it quickly in 2D/3D editing.',
	},
	{
		id: '03',
		tr: 'Proje hazir oldugunda DXF/PDF ciktilarini al ve paylas.',
		en: 'When ready, export DXF/PDF outputs and share with your team.',
	},
];

function getCopy(language: SupportedLanguage) {
	return {
		badge: pickLocalized(language, 'YENI AKIS', 'NEW FLOW'),
		title: pickLocalized(language, 'DrawOrDie x ArchBuilder', 'DrawOrDie x ArchBuilder'),
		subtitle: pickLocalized(
			language,
			'Mimari projeyi yalnizca analiz etmek yerine, dogrudan tasarlamak ve export etmek ister misin?',
			'Want to do more than critique? Design and export your architectural project directly.',
		),
		primaryCta: pickLocalized(language, 'ArchBuilder.app e Git', 'Go To ArchBuilder.app'),
		secondaryCta: pickLocalized(language, 'DrawOrDie Ana Ekrana Don', 'Back To DrawOrDie Home'),
		usageTitle: pickLocalized(language, 'Nasil Kullanilir?', 'How It Works'),
		usageNote: pickLocalized(
			language,
			'Bu akis DrawOrDie kullanicilarini hizli sekilde ArchBuilder uygulamasina gecirir.',
			'This path moves DrawOrDie users into ArchBuilder with a fast handoff.',
		),
		featuresTitle: pickLocalized(language, 'Neden ArchBuilder?', 'Why ArchBuilder?'),
		featureA: pickLocalized(language, 'Prompttan proje baslatma', 'Prompt-first project creation'),
		featureB: pickLocalized(language, '2D/3D ortak duzenleme', 'Unified 2D/3D editing'),
		featureC: pickLocalized(language, 'DXF/PDF cikti hatti', 'DXF/PDF export pipeline'),
	};
}

export default function ArchBuilderPage() {
	const [language, setLanguage] = useState<SupportedLanguage>('tr');

	useEffect(() => {
		const nextLanguage = normalizeLanguage(
			typeof navigator !== 'undefined' ? navigator.language : 'tr',
			'tr',
		);
		setLanguage(nextLanguage);
		captureUTMFromCurrentUrl();

		void trackConversionEvent('archbuilder_bridge_viewed', {
			source: '/archbuilder',
			destination: 'https://archbuilder.app',
			language: nextLanguage,
		});
	}, []);

	const copy = useMemo(() => getCopy(language), [language]);

	const handlePrimaryClick = () => {
		void trackConversionEvent('archbuilder_bridge_clicked', {
			source: '/archbuilder',
			destination: 'https://archbuilder.app',
			language,
		});
	};

	return (
		<main className="relative min-h-screen overflow-hidden bg-[#05080F] px-6 py-10 text-slate-100 md:px-10">
			<div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden>
				<div className="absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-neon-red/25 blur-[130px]" />
				<div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-cyan-400/15 blur-[120px]" />
			</div>

			<section className="relative mx-auto max-w-6xl">
				<div className="rounded-3xl border border-white/10 bg-[#0B1220]/85 p-6 shadow-2xl backdrop-blur-xl md:p-10">
					<div className="mb-8 inline-flex items-center rounded-full border border-neon-red/60 bg-neon-red/15 px-3 py-1 text-[11px] font-mono font-bold tracking-[0.24em] text-neon-red">
						{copy.badge}
					</div>

					<h1 className="font-display text-4xl font-black uppercase tracking-wide text-white md:text-6xl">
						{copy.title}
					</h1>
					<p className="mt-4 max-w-3xl text-base text-slate-300 md:text-lg">{copy.subtitle}</p>

					<div className="mt-8 flex flex-col gap-3 sm:flex-row">
						<a
							href={ARCHBUILDER_URL}
							target="_blank"
							rel="noopener noreferrer"
							onClick={handlePrimaryClick}
							className="inline-flex items-center justify-center rounded-xl border border-neon-red bg-neon-red px-6 py-3 font-mono text-sm font-bold uppercase tracking-[0.16em] text-white shadow-[0_0_28px_rgba(255,0,51,0.5)] transition hover:-translate-y-0.5 hover:bg-[#ff1f53]"
						>
							{copy.primaryCta}
						</a>
						<Link
							href="/"
							className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 font-mono text-sm font-bold uppercase tracking-[0.16em] text-slate-100 transition hover:border-white/35 hover:bg-white/10"
						>
							{copy.secondaryCta}
						</Link>
					</div>
				</div>

				<div className="mt-7 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
					<article className="rounded-3xl border border-white/10 bg-[#0A1120]/80 p-6 md:p-8">
						<h2 className="font-display text-2xl font-bold uppercase tracking-wide text-white">{copy.usageTitle}</h2>
						<p className="mt-2 text-sm text-slate-300">{copy.usageNote}</p>

						<div className="mt-6 space-y-4">
							{usageSteps.map((step) => (
								<div key={step.id} className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
									<span className="rounded-md border border-neon-red/60 bg-neon-red/20 px-2 py-1 font-mono text-xs font-bold tracking-[0.2em] text-neon-red">
										{step.id}
									</span>
									<p className="text-sm text-slate-200">{pickLocalized(language, step.tr, step.en)}</p>
								</div>
							))}
						</div>
					</article>

					<aside className="rounded-3xl border border-white/10 bg-[#0A1120]/80 p-6 md:p-8">
						<h3 className="font-display text-xl font-bold uppercase tracking-wide text-white">{copy.featuresTitle}</h3>
						<div className="mt-4 space-y-3 font-mono text-sm">
							<p className="rounded-xl border border-cyan-400/35 bg-cyan-400/10 px-4 py-3 text-cyan-100">{copy.featureA}</p>
							<p className="rounded-xl border border-yellow-300/35 bg-yellow-300/10 px-4 py-3 text-yellow-100">{copy.featureB}</p>
							<p className="rounded-xl border border-emerald-400/35 bg-emerald-400/10 px-4 py-3 text-emerald-100">{copy.featureC}</p>
						</div>
					</aside>
				</div>
			</section>
		</main>
	);
}
