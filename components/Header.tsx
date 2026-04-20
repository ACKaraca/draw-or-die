import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
    Crown,
    PenTool,
    TrendingUp,
    Sparkles,
    LogOut,
    LogIn,
    UserCircle2,
    Menu,
    X,
    Wallet,
    ChevronDown,
    BookMarked,
    Trophy,
    Skull,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import type { StepType } from '@/types';
import { TIER_DEFAULTS } from '@/lib/pricing';

interface HeaderProps {
    goHome: () => void;
    setCurrentGallery: (gallery: 'HALL_OF_FAME' | 'WALL_OF_DEATH' | 'COMMUNITY') => void;
    setStep: (step: StepType) => void;
    onAuthClick: () => void;
}

export function Header({
    goHome,
    setCurrentGallery,
    setStep,
    onAuthClick,
}: HeaderProps) {
    const { user, profile, signOut } = useAuth();
    const language = useLanguage();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isGalleryMenuOpen, setIsGalleryMenuOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement | null>(null);
    const galleryMenuRef = useRef<HTMLDivElement | null>(null);

    const copy = useMemo(() => {
        if (language === 'en') {
            return {
                displayFallbackName: 'Architect',
                navStudioDesk: 'Studio Desk',
                navArchBuilder: 'ArchBuilder',
                navCommunity: 'Community',
                navAiMentor: 'AI Mentor',
                navGallery: 'Gallery',
                navReferences: 'References',
                navPortfolio: 'Portfolio',
                galleryHallOfFame: 'Hall of Fame',
                galleryWallOfDeath: 'Wall of Death',
                galleryCommunity: 'Community',
                galleryPeerReview: 'Peer Review',
                galleryConfessions: 'Confessions',
                profileMenuTitle: 'User menu',
                profile: 'Profile',
                history: 'Analysis History',
                rapidoShop: 'Rapido Shop',
                buyPremium: 'Buy Premium',
                upgrade: 'Upgrade',
                premiumLabel: 'Premium',
                goPremium: 'Go Premium',
                buyRapido: 'Buy Rapido',
                score: 'XP',
                signOut: 'Sign Out',
                loginJoin: 'Log In / Join',
                openMobileMenu: 'Open mobile menu',
                premiumShort: 'Premium',
            };
        }

        return {
            displayFallbackName: 'Mimar',
            navStudioDesk: 'Studio Desk',
            navArchBuilder: 'ArchBuilder',
            navCommunity: 'Community',
            navAiMentor: 'AI Mentor',
            navGallery: 'Galeri',
            navReferences: 'Referanslar',
            navPortfolio: 'Portfolyo',
            galleryHallOfFame: 'Hall of Fame',
            galleryWallOfDeath: 'Wall of Death',
            galleryCommunity: 'Community',
            galleryPeerReview: 'Akran Jurisi',
            galleryConfessions: 'Itiraflar',
            profileMenuTitle: 'Kullanici menusu',
            profile: 'Profil',
            history: 'Analiz Gecmisi',
            rapidoShop: 'Rapido Magaza',
            buyPremium: 'Premium Satin Al',
            upgrade: 'Upgrade',
            premiumLabel: 'Premium',
            goPremium: 'Premiuma Gec',
            buyRapido: 'Rapido satin al',
            score: 'XP',
            signOut: 'Cikis Yap',
            loginJoin: 'Log In / Join',
            openMobileMenu: 'Mobil menuyu ac',
            premiumShort: 'Premium',
        };
    }, [language]);

    const isPremiumUser = profile?.is_premium ?? false;
    const isAnonymous = user ? user.identities?.[0]?.provider === 'anonymous' : false;
    const rapidoPens = profile?.rapido_pens ?? (isAnonymous ? TIER_DEFAULTS.ANONYMOUS : TIER_DEFAULTS.REGISTERED);
    const isLowBalance = rapidoPens < 5;
    const progressionScore = profile?.progression_score ?? 0;
    const displayName = useMemo(() => {
        if (!user) return null;
        const directName = (user.name ?? '').trim();
        if (directName) return directName;
        const fromEmail = (user.email ?? '').split('@')[0]?.trim();
        if (fromEmail) return fromEmail;
        return copy.displayFallbackName;
    }, [copy.displayFallbackName, user]);

    const closeAllMenus = () => {
        setIsMobileMenuOpen(false);
        setIsProfileMenuOpen(false);
        setIsGalleryMenuOpen(false);
    };

    const goTo = (step: StepType) => {
        setStep(step);
        closeAllMenus();
    };

    const goToGallery = (gallery: 'HALL_OF_FAME' | 'WALL_OF_DEATH' | 'COMMUNITY') => {
        setCurrentGallery(gallery);
        setStep('gallery');
        closeAllMenus();
    };

    useEffect(() => {
        if (!isProfileMenuOpen && !isGalleryMenuOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            if (isProfileMenuOpen && profileMenuRef.current && !profileMenuRef.current.contains(target)) {
                setIsProfileMenuOpen(false);
            }
            if (isGalleryMenuOpen && galleryMenuRef.current && !galleryMenuRef.current.contains(target)) {
                setIsGalleryMenuOpen(false);
            }
        };

        window.addEventListener('pointerdown', handlePointerDown);
        return () => window.removeEventListener('pointerdown', handlePointerDown);
    }, [isProfileMenuOpen, isGalleryMenuOpen]);

    return (
        <header className="glass-header fixed top-0 left-0 w-full z-50">
            <div className="h-16 px-4 md:px-6 flex justify-between items-center gap-3">
                {/* ── Left: Logo + Primary nav ─────────────────────────── */}
                <div className="flex items-center gap-3 md:gap-7 min-w-0">
                    <button className="flex items-center gap-2 cursor-pointer group min-w-0" onClick={goHome}>
                        <div className="relative w-7 h-7 shrink-0">
                            <div className="absolute inset-0 rounded-md bg-neon-red transform rotate-45 transition-transform duration-300 group-hover:rotate-[135deg]" />
                        </div>
                        <h1 className="font-display font-bold text-base sm:text-lg md:text-xl tracking-[0.2em] text-white truncate">
                            DRAW<span className="text-neon-red">OR</span>DIE
                        </h1>
                    </button>

                    {/* Max 6 top-level items */}
                    <nav className="hidden xl:flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em]">
                        <button
                            onClick={() => goTo('upload')}
                            className="px-3 py-2 text-slate-300 hover:text-white transition-colors"
                        >
                            {copy.navStudioDesk}
                        </button>
                        <button
                            onClick={() => goTo('archbuilder')}
                            className="px-3 py-2 text-amber-300 hover:text-amber-200 transition-colors"
                        >
                            {copy.navArchBuilder}
                        </button>
                        <button
                            onClick={() => goToGallery('COMMUNITY')}
                            className="px-3 py-2 text-cyan-300 hover:text-cyan-200 transition-colors"
                        >
                            {copy.navCommunity}
                        </button>
                        <button
                            onClick={() => goTo('ai-mentor')}
                            className="px-3 py-2 text-yellow-300 hover:text-yellow-200 transition-colors flex items-center gap-1.5"
                        >
                            <Sparkles size={11} strokeWidth={2} /> {copy.navAiMentor}
                        </button>

                        {/* Gallery dropdown */}
                        <div className="relative" ref={galleryMenuRef}>
                            <button
                                type="button"
                                onClick={() => setIsGalleryMenuOpen((prev) => !prev)}
                                className="px-3 py-2 text-cyan-300 hover:text-cyan-200 transition-colors flex items-center gap-1"
                            >
                                {copy.navGallery}
                                <ChevronDown size={11} strokeWidth={2} className={`transition-transform ${isGalleryMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isGalleryMenuOpen && (
                                <div className="absolute left-0 mt-2 w-60 rounded-xl border border-white/10 bg-[var(--color-bg-1)]/98 backdrop-blur-xl shadow-2xl p-1.5 z-50">
                                    <button
                                        onClick={() => goToGallery('HALL_OF_FAME')}
                                        className="w-full text-left px-3 py-2.5 rounded-lg text-[11px] font-mono uppercase tracking-[0.1em] text-emerald-200 hover:bg-white/5 flex items-center gap-2.5"
                                    >
                                        <Trophy size={13} strokeWidth={1.75} className="text-emerald-400" />
                                        {copy.galleryHallOfFame}
                                    </button>
                                    <button
                                        onClick={() => goToGallery('WALL_OF_DEATH')}
                                        className="w-full text-left px-3 py-2.5 rounded-lg text-[11px] font-mono uppercase tracking-[0.1em] text-red-200 hover:bg-white/5 flex items-center gap-2.5"
                                    >
                                        <Skull size={13} strokeWidth={1.75} className="text-neon-red" />
                                        {copy.galleryWallOfDeath}
                                    </button>
                                </div>
                            )}
                        </div>

                        <Link
                            href="/references"
                            onClick={closeAllMenus}
                            className="px-3 py-2 text-amber-200 hover:text-amber-100 transition-colors flex items-center gap-1.5"
                        >
                            <BookMarked size={11} strokeWidth={2} /> {copy.navReferences}
                        </Link>
                    </nav>
                </div>

                {/* ── Right: User zone ─────────────────────────────────── */}
                <div className="flex gap-1.5 items-center">
                    {user ? (
                        <>
                            {/* Rapido balance chip */}
                            <button
                                onClick={() => goTo('rapido-shop')}
                                className={`hidden sm:flex items-center gap-1.5 border px-3 py-1.5 rounded-full backdrop-blur-md text-nowrap transition-colors ${
                                    isLowBalance
                                        ? 'bg-neon-red/12 border-neon-red/40 hover:bg-neon-red/20 pulse-soft'
                                        : 'bg-black/40 border-white/10 hover:border-neon-red/40'
                                }`}
                                title={copy.buyRapido}
                            >
                                <PenTool size={13} strokeWidth={1.75} className="text-neon-red" />
                                <span className="font-mono text-[11px] font-bold text-white">
                                    {rapidoPens.toFixed(1)}
                                </span>
                                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-slate-400">
                                    Rapido
                                </span>
                            </button>

                            {/* XP chip */}
                            <div className="hidden lg:flex items-center gap-1.5 bg-black/40 border border-white/10 px-3 py-1.5 rounded-full backdrop-blur-md text-nowrap">
                                <TrendingUp size={13} strokeWidth={1.75} className="text-emerald-400" />
                                <span className="font-mono text-[11px] font-bold text-white">{progressionScore}</span>
                                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-slate-400">
                                    {copy.score}
                                </span>
                            </div>

                            {/* Premium / Upgrade chip */}
                            <button
                                className={`hidden sm:flex items-center gap-1.5 border px-3 py-1.5 rounded-full backdrop-blur-md cursor-pointer transition-colors ${
                                    isPremiumUser
                                        ? 'bg-yellow-500/15 border-yellow-500/45 hover:bg-yellow-500/25 shadow-[0_0_12px_rgba(234,179,8,0.25)]'
                                        : 'bg-black/40 border-white/10 hover:border-yellow-500/40'
                                }`}
                                onClick={() => !isPremiumUser && goTo('premium-upgrade')}
                                title={isPremiumUser ? copy.premiumLabel : copy.goPremium}
                            >
                                <Crown size={13} strokeWidth={1.75} className={isPremiumUser ? 'text-yellow-300' : 'text-slate-400'} />
                                <span className="font-mono text-[10px] uppercase tracking-[0.1em] font-bold text-white">
                                    {isPremiumUser ? copy.premiumLabel : copy.upgrade}
                                </span>
                            </button>

                            {/* Profile dropdown */}
                            <div className="relative hidden md:block" ref={profileMenuRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                                    className="flex items-center gap-2 bg-black/40 border border-white/10 px-3 py-1.5 rounded-full backdrop-blur-md text-nowrap hover:border-indigo-400/40 transition-colors"
                                    title={copy.profileMenuTitle}
                                >
                                    <UserCircle2 size={14} strokeWidth={1.75} className="text-indigo-300" />
                                    <span className="font-mono text-[11px] font-bold text-white max-w-[120px] truncate">
                                        {displayName}
                                    </span>
                                    <ChevronDown size={11} strokeWidth={2} className={`text-slate-400 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isProfileMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-[var(--color-bg-1)]/98 backdrop-blur-xl shadow-2xl p-1.5 z-50">
                                        <button
                                            onClick={() => goTo('profile')}
                                            className="w-full text-left px-3 py-2.5 rounded-lg text-[11px] font-mono uppercase tracking-[0.1em] text-slate-100 hover:bg-white/5"
                                        >
                                            {copy.profile}
                                        </button>
                                        <button
                                            onClick={() => goTo('history')}
                                            className="w-full text-left px-3 py-2.5 rounded-lg text-[11px] font-mono uppercase tracking-[0.1em] text-cyan-200 hover:bg-white/5"
                                        >
                                            {copy.history}
                                        </button>
                                        <div className="my-1 h-px bg-white/8" />
                                        <button
                                            onClick={() => goTo('rapido-shop')}
                                            className="w-full text-left px-3 py-2.5 rounded-lg text-[11px] font-mono uppercase tracking-[0.1em] text-neon-red hover:bg-white/5"
                                        >
                                            {copy.rapidoShop}
                                        </button>
                                        {!isPremiumUser && (
                                            <button
                                                onClick={() => goTo('premium-upgrade')}
                                                className="w-full text-left px-3 py-2.5 rounded-lg text-[11px] font-mono uppercase tracking-[0.1em] text-yellow-300 hover:bg-white/5"
                                            >
                                                {copy.buyPremium}
                                            </button>
                                        )}
                                        <div className="my-1 h-px bg-white/8" />
                                        <Link
                                            href="/portfolio"
                                            onClick={closeAllMenus}
                                            className="w-full text-left px-3 py-2.5 rounded-lg text-[11px] font-mono uppercase tracking-[0.1em] text-emerald-200 hover:bg-white/5 flex items-center gap-2"
                                        >
                                            {copy.navPortfolio}
                                        </Link>
                                        <Link
                                            href="/peer-review"
                                            onClick={closeAllMenus}
                                            className="w-full text-left px-3 py-2.5 rounded-lg text-[11px] font-mono uppercase tracking-[0.1em] text-blue-200 hover:bg-white/5 flex items-center gap-2"
                                        >
                                            {copy.galleryPeerReview}
                                        </Link>
                                        <Link
                                            href="/confessions"
                                            onClick={closeAllMenus}
                                            className="w-full text-left px-3 py-2.5 rounded-lg text-[11px] font-mono uppercase tracking-[0.1em] text-purple-200 hover:bg-white/5 flex items-center gap-2"
                                        >
                                            {copy.galleryConfessions}
                                        </Link>
                                        <Link
                                            href="/references"
                                            onClick={closeAllMenus}
                                            className="w-full text-left px-3 py-2.5 rounded-lg text-[11px] font-mono uppercase tracking-[0.1em] text-amber-200 hover:bg-white/5 flex items-center gap-2"
                                        >
                                            {copy.navReferences}
                                        </Link>
                                        <div className="my-1 h-px bg-white/8" />
                                        <button
                                            onClick={() => signOut()}
                                            className="w-full text-left px-3 py-2.5 rounded-lg text-[11px] font-mono uppercase tracking-[0.1em] text-slate-400 hover:bg-white/5 hover:text-white flex items-center gap-2"
                                        >
                                            <LogOut size={12} strokeWidth={1.75} /> {copy.signOut}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <button
                            onClick={onAuthClick}
                            className="flex items-center gap-2 bg-white text-black hover:bg-gray-200 px-4 py-2 rounded-full font-mono font-bold text-[11px] uppercase tracking-[0.1em] transition-colors"
                        >
                            <LogIn size={14} strokeWidth={2} /> {copy.loginJoin}
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                        className="xl:hidden p-2 rounded-lg border border-white/15 text-slate-200 hover:bg-white/8 transition-colors"
                        aria-label={copy.openMobileMenu}
                    >
                        {isMobileMenuOpen ? <X size={16} strokeWidth={2} /> : <Menu size={16} strokeWidth={2} />}
                    </button>
                </div>
            </div>

            {/* ── Mobile menu ──────────────────────────────────────────── */}
            {isMobileMenuOpen && (
                <div className="xl:hidden border-t border-white/10 bg-[var(--color-bg-1)]/98 backdrop-blur-xl px-3 pb-3 pt-3">
                    {user && (
                        <div className="mb-2.5 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[11px] font-mono uppercase tracking-[0.1em] text-slate-200 flex items-center justify-between">
                            <span className="truncate">{displayName}</span>
                            <span className="inline-flex items-center gap-1.5 text-neon-red">
                                <Wallet size={12} strokeWidth={1.75} /> {rapidoPens.toFixed(1)}
                            </span>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono uppercase tracking-[0.1em]">
                        <button onClick={() => goTo('upload')} className="rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2.5 text-slate-200 hover:bg-white/8">
                            {copy.navStudioDesk}
                        </button>
                        <button onClick={() => goTo('archbuilder')} className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-amber-200 hover:bg-amber-500/15">
                            {copy.navArchBuilder}
                        </button>
                        <button onClick={() => goTo('ai-mentor')} className="rounded-lg border border-yellow-500/35 bg-yellow-500/8 px-3 py-2.5 text-yellow-300 hover:bg-yellow-500/15">
                            {copy.navAiMentor}
                        </button>
                        <button onClick={() => goToGallery('COMMUNITY')} className="rounded-lg border border-cyan-500/35 bg-cyan-500/8 px-3 py-2.5 text-cyan-200 hover:bg-cyan-500/15">
                            {copy.galleryCommunity}
                        </button>
                        <button onClick={() => goToGallery('HALL_OF_FAME')} className="rounded-lg border border-emerald-500/35 bg-emerald-500/8 px-3 py-2.5 text-emerald-200 hover:bg-emerald-500/15">
                            {copy.galleryHallOfFame}
                        </button>
                        <button onClick={() => goToGallery('WALL_OF_DEATH')} className="rounded-lg border border-red-500/35 bg-red-500/8 px-3 py-2.5 text-red-200 hover:bg-red-500/15">
                            {copy.galleryWallOfDeath}
                        </button>
                        <Link href="/references" onClick={closeAllMenus} className="rounded-lg border border-amber-400/35 bg-amber-400/8 px-3 py-2.5 text-amber-200 hover:bg-amber-400/15 text-center">
                            {copy.navReferences}
                        </Link>
                        <Link href="/portfolio" onClick={closeAllMenus} className="rounded-lg border border-emerald-400/35 bg-emerald-400/8 px-3 py-2.5 text-emerald-200 hover:bg-emerald-400/15 text-center">
                            {copy.navPortfolio}
                        </Link>
                        <Link href="/peer-review" onClick={closeAllMenus} className="rounded-lg border border-blue-400/35 bg-blue-400/8 px-3 py-2.5 text-blue-200 hover:bg-blue-400/15 text-center">
                            {copy.galleryPeerReview}
                        </Link>
                        <Link href="/confessions" onClick={closeAllMenus} className="rounded-lg border border-purple-400/35 bg-purple-400/8 px-3 py-2.5 text-purple-200 hover:bg-purple-400/15 text-center">
                            {copy.galleryConfessions}
                        </Link>
                        {user && (
                            <>
                                <button onClick={() => goTo('profile')} className="rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2.5 text-slate-100 hover:bg-white/8">
                                    {copy.profile}
                                </button>
                                <button onClick={() => goTo('history')} className="rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2.5 text-cyan-200 hover:bg-white/8">
                                    {copy.history}
                                </button>
                                <button onClick={() => goTo('rapido-shop')} className="rounded-lg border border-neon-red/35 bg-neon-red/10 px-3 py-2.5 text-neon-red hover:bg-neon-red/15">
                                    {copy.rapidoShop}
                                </button>
                                {!isPremiumUser && (
                                    <button onClick={() => goTo('premium-upgrade')} className="rounded-lg border border-yellow-500/35 bg-yellow-500/8 px-3 py-2.5 text-yellow-300 hover:bg-yellow-500/15">
                                        {copy.premiumShort}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}
