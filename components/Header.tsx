import { useEffect, useMemo, useRef, useState } from 'react';
import { Crown, PenTool, TrendingUp, Sparkles, LogOut, LogIn, UserCircle2, Menu, X, Wallet, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { StepType } from '@/types';
import type { SupportedLanguage } from '@/lib/i18n';
import { TIER_DEFAULTS } from '@/lib/pricing';

interface HeaderProps {
    goHome: () => void;
    setCurrentGallery: (gallery: 'HALL_OF_FAME' | 'WALL_OF_DEATH' | 'COMMUNITY') => void;
    setStep: (step: StepType) => void;
    onAuthClick: () => void;
    preferredLanguage?: SupportedLanguage;
    onLanguageChange?: (language: SupportedLanguage) => void;
}

export function Header({
    goHome,
    setCurrentGallery,
    setStep,
    onAuthClick,
    preferredLanguage = 'tr',
    onLanguageChange,
}: HeaderProps) {
    const { user, profile, signOut } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement | null>(null);
    const language: SupportedLanguage = preferredLanguage === 'en' ? 'en' : 'tr';

    const copy = useMemo(() => {
        if (language === 'en') {
            return {
                displayFallbackName: 'Architect',
                navStudioDesk: 'Studio Desk',
                navCommunity: 'Community',
                navAiMentor: 'AI Mentor',
                navHallOfFame: 'Hall of Fame',
                navWallOfDeath: 'Wall of Death',
                profileMenuTitle: 'User menu',
                profile: 'Profile',
                history: 'Analysis History',
                rapidoShop: 'Rapido Shop',
                buyPremium: 'Buy Premium',
                premiumManagement: 'Premium Management',
                upgrade: 'Upgrade',
                premiumLabel: 'Premium',
                goPremium: 'Go Premium',
                buyRapido: 'Buy Rapido',
                score: 'Score',
                signOut: 'Sign Out',
                loginJoin: 'Log In / Join',
                openMobileMenu: 'Open mobile menu',
                premiumShort: 'Premium',
            };
        }

        return {
            displayFallbackName: 'Mimar',
            navStudioDesk: 'Studio Desk',
            navCommunity: 'Community',
            navAiMentor: 'AI Mentor',
            navHallOfFame: 'Hall of Fame',
            navWallOfDeath: 'Wall of Death',
            profileMenuTitle: 'Kullanici menusu',
            profile: 'Profil',
            history: 'Analiz Gecmisi',
            rapidoShop: 'Rapido Magaza',
            buyPremium: 'Premium Satin Al',
            premiumManagement: 'Premium Yonetimi',
            upgrade: 'Upgrade',
            premiumLabel: 'Premium',
            goPremium: 'Premiuma Gec',
            buyRapido: 'Rapido satin al',
            score: 'Puan',
            signOut: 'Cikis Yap',
            loginJoin: 'Log In / Join',
            openMobileMenu: 'Mobil menuyu ac',
            premiumShort: 'Premium',
        };
    }, [language]);

    const isPremiumUser = profile?.is_premium ?? false;
    const isAnonymous = user ? user.identities?.[0]?.provider === 'anonymous' : false;
    const rapidoPens = profile?.rapido_pens ?? (isAnonymous ? TIER_DEFAULTS.ANONYMOUS : TIER_DEFAULTS.REGISTERED);
    const progressionScore = profile?.progression_score ?? 0;
    const displayName = useMemo(() => {
        if (!user) return null;
        const directName = (user.name ?? '').trim();
        if (directName) return directName;
        const fromEmail = (user.email ?? '').split('@')[0]?.trim();
        if (fromEmail) return fromEmail;
        return copy.displayFallbackName;
    }, [copy.displayFallbackName, user]);

    const goTo = (step: StepType) => {
        setStep(step);
        setIsMobileMenuOpen(false);
        setIsProfileMenuOpen(false);
    };

    const goToGallery = (gallery: 'HALL_OF_FAME' | 'WALL_OF_DEATH' | 'COMMUNITY') => {
        setCurrentGallery(gallery);
        setStep('gallery');
        setIsMobileMenuOpen(false);
        setIsProfileMenuOpen(false);
    };

    useEffect(() => {
        if (!isProfileMenuOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (!profileMenuRef.current) return;
            if (!profileMenuRef.current.contains(event.target as Node)) {
                setIsProfileMenuOpen(false);
            }
        };

        window.addEventListener('pointerdown', handlePointerDown);
        return () => window.removeEventListener('pointerdown', handlePointerDown);
    }, [isProfileMenuOpen]);

    const changeLanguage = (nextLanguage: SupportedLanguage) => {
        onLanguageChange?.(nextLanguage);
    };

    return (
        <header className="fixed top-0 left-0 w-full z-50 bg-[#0A0F1A]/92 backdrop-blur-xl border-b border-white/10 shadow-lg">
            <div className="h-20 px-3 md:px-6 flex justify-between items-center gap-2">
                <div className="flex items-center gap-3 md:gap-8 min-w-0">
                    <button className="flex items-center gap-2 cursor-pointer group min-w-0" onClick={goHome}>
                        <div className="w-6 h-6 bg-neon-red rounded-sm transform rotate-45 group-hover:rotate-90 transition-transform duration-300"></div>
                        <h1 className="font-display font-bold text-lg sm:text-xl md:text-2xl tracking-widest text-white truncate">
                            DRAW<span className="text-neon-red">OR</span>DIE
                        </h1>
                    </button>

                    <nav className="hidden xl:flex items-center gap-5 font-mono text-xs uppercase tracking-widest text-slate-400">
                        <button onClick={goHome} className="hover:text-white transition-colors">{copy.navStudioDesk}</button>
                        <button onClick={() => goToGallery('COMMUNITY')} className="hover:text-white transition-colors text-cyan-300">{copy.navCommunity}</button>
                        <button onClick={() => goTo('ai-mentor')} className="hover:text-white transition-colors text-yellow-400 font-bold flex items-center gap-1"><Sparkles size={12} /> {copy.navAiMentor}</button>
                        <button onClick={() => goToGallery('HALL_OF_FAME')} className="hover:text-white transition-colors text-emerald-400">{copy.navHallOfFame}</button>
                        <button onClick={() => goToGallery('WALL_OF_DEATH')} className="hover:text-white transition-colors text-red-500">{copy.navWallOfDeath}</button>
                    </nav>
                </div>

                <div className="flex gap-2 items-center">
                    <div className="hidden sm:flex items-center rounded-full border border-white/15 bg-black/40 p-0.5">
                        <button
                            type="button"
                            onClick={() => changeLanguage('tr')}
                            className={`px-2 py-1 rounded-full text-[10px] font-mono ${language === 'tr' ? 'bg-white text-black' : 'text-slate-300 hover:text-white'}`}
                        >
                            TR
                        </button>
                        <button
                            type="button"
                            onClick={() => changeLanguage('en')}
                            className={`px-2 py-1 rounded-full text-[10px] font-mono ${language === 'en' ? 'bg-white text-black' : 'text-slate-300 hover:text-white'}`}
                        >
                            EN
                        </button>
                    </div>

                    {user ? (
                        <>
                            <div className="relative hidden md:block" ref={profileMenuRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                                    className="flex items-center gap-2 bg-black/50 border border-white/10 px-3 py-1.5 rounded-full backdrop-blur-md text-nowrap hover:border-indigo-400/40 transition-colors"
                                    title={copy.profileMenuTitle}
                                >
                                    <UserCircle2 size={14} className="text-indigo-300" />
                                    <span className="font-mono text-xs font-bold text-white max-w-[140px] truncate">{displayName}</span>
                                    <ChevronDown size={13} className="text-slate-400" />
                                </button>

                                {isProfileMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-[#0A0F1A]/98 shadow-2xl p-2 z-50">
                                        <button onClick={() => goTo('profile')} className="w-full text-left px-3 py-2 rounded-lg text-xs font-mono uppercase tracking-wider text-slate-100 hover:bg-white/10">{copy.profile}</button>
                                        <button onClick={() => goTo('history')} className="w-full text-left px-3 py-2 rounded-lg text-xs font-mono uppercase tracking-wider text-cyan-200 hover:bg-white/10">{copy.history}</button>
                                        <button onClick={() => goTo('rapido-shop')} className="w-full text-left px-3 py-2 rounded-lg text-xs font-mono uppercase tracking-wider text-neon-red hover:bg-white/10">{copy.rapidoShop}</button>
                                        <button onClick={() => goTo('premium-upgrade')} className="w-full text-left px-3 py-2 rounded-lg text-xs font-mono uppercase tracking-wider text-yellow-300 hover:bg-white/10">{copy.buyPremium}</button>
                                        <button onClick={() => goTo('account-details')} className="w-full text-left px-3 py-2 rounded-lg text-xs font-mono uppercase tracking-wider text-indigo-200 hover:bg-white/10">{copy.premiumManagement}</button>
                                    </div>
                                )}
                            </div>
                            <button
                                className={`flex items-center gap-1 md:gap-2 border px-2.5 md:px-3 py-1.5 rounded-full backdrop-blur-md cursor-pointer transition-colors ${isPremiumUser ? 'bg-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.3)] border-yellow-500/50 hover:bg-yellow-500/30' : 'bg-black/50 hover:bg-white/10 border-white/10'}`}
                                onClick={() => !isPremiumUser && goTo('premium-upgrade')}
                                title={isPremiumUser ? copy.premiumLabel : copy.goPremium}
                            >
                                <Crown size={14} className={isPremiumUser ? 'text-yellow-400' : 'text-slate-500'} />
                                {!isPremiumUser && <span className="font-mono text-[11px] md:text-xs font-bold text-white">{copy.upgrade}</span>}
                            </button>
                            <button
                                onClick={() => goTo('rapido-shop')}
                                className="flex items-center gap-1 md:gap-2 bg-black/50 border border-white/10 px-2.5 md:px-3 py-1.5 rounded-full backdrop-blur-md text-nowrap hover:border-neon-red/60"
                                title={copy.buyRapido}
                            >
                                <PenTool size={14} className="text-neon-red" />
                                <span className="font-mono text-[11px] md:text-xs font-bold text-white">{rapidoPens.toFixed(1)} Rapido</span>
                            </button>
                            <div className="hidden lg:flex items-center gap-1 md:gap-2 bg-black/50 border border-white/10 px-3 py-1.5 rounded-full backdrop-blur-md text-nowrap">
                                <TrendingUp size={14} className="text-emerald-500" />
                                <span className="font-mono text-xs font-bold text-white">{progressionScore} {copy.score}</span>
                            </div>
                            <button onClick={() => signOut()} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white" title={copy.signOut}>
                                <LogOut size={16} />
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={onAuthClick}
                            className="flex items-center gap-2 bg-white text-black hover:bg-gray-200 px-3 md:px-4 py-2 rounded-full font-bold text-xs md:text-sm transition-colors"
                        >
                            <LogIn size={16} /> {copy.loginJoin}
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                        className="xl:hidden p-2 rounded-lg border border-white/20 text-slate-200 hover:bg-white/10"
                        aria-label={copy.openMobileMenu}
                    >
                        {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                    </button>
                </div>
            </div>

            {isMobileMenuOpen && (
                <div className="xl:hidden border-t border-white/10 bg-[#0A0F1A]/98 px-3 pb-3 pt-2">
                    {user && (
                        <div className="mb-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs font-mono text-slate-200 flex items-center justify-between">
                            <span className="truncate">{displayName}</span>
                            <span className="inline-flex items-center gap-1 text-neon-red"><Wallet size={12} /> {rapidoPens.toFixed(1)}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono uppercase tracking-wider">
                        <button onClick={() => { goHome(); setIsMobileMenuOpen(false); }} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-slate-200 hover:bg-white/10">{copy.navStudioDesk}</button>
                        <button onClick={() => goToGallery('COMMUNITY')} className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-cyan-200 hover:bg-cyan-500/20">{copy.navCommunity}</button>
                        <button onClick={() => goTo('ai-mentor')} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-yellow-300 hover:bg-white/10">{copy.navAiMentor}</button>
                        <button onClick={() => goTo('profile')} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-slate-100 hover:bg-white/10">{copy.profile}</button>
                        <button onClick={() => goTo('history')} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-cyan-200 hover:bg-white/10">{copy.history}</button>
                        <button onClick={() => goTo('rapido-shop')} className="rounded-lg border border-neon-red/40 bg-neon-red/10 px-3 py-2 text-neon-red hover:bg-neon-red/20">{copy.rapidoShop}</button>
                        <button onClick={() => goTo('premium-upgrade')} className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-yellow-300 hover:bg-yellow-500/20">{copy.premiumShort}</button>
                        <button onClick={() => goTo('account-details')} className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-2 text-indigo-200 hover:bg-indigo-500/20">{copy.premiumManagement}</button>
                        <button onClick={() => goToGallery('HALL_OF_FAME')} className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-emerald-200 hover:bg-emerald-500/20">{copy.navHallOfFame}</button>
                        <button onClick={() => goToGallery('WALL_OF_DEATH')} className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-200 hover:bg-red-500/20">{copy.navWallOfDeath}</button>
                    </div>
                </div>
            )}
        </header>
    );
}
