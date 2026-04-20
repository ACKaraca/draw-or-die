export type StepType = 'hero' | 'upload' | 'analyzing' | 'premium-analyzing' | 'result' | 'premium' | 'gallery' | 'multi-analyzing' | 'multi-result' | 'ai-mentor' | 'history' | 'profile' | 'premium-upgrade' | 'rapido-shop' | 'account-details' | 'archbuilder';
export type GalleryType = 'HALL_OF_FAME' | 'WALL_OF_DEATH' | 'COMMUNITY';
export type GalleryPlacementType = GalleryType | 'NONE';
export type AnalysisLengthOption = 'SHORT' | 'MEDIUM' | 'LONG' | 'WORD_TARGET';
export type JuryPersonaId =
    | 'constructive'
    | 'structural'
    | 'conceptual'
    | 'grumpy'
    | 'contextualist'
    | 'sustainability';

export interface GalleryItem {
    id: string;
    img: string;
    title: string;
    jury: string;
    type: GalleryType;
    status?: 'approved' | 'pending' | 'archived';
    isOwner?: boolean;
    analysisKind: string;
    aspectRatio?: number;
}

export interface FormData {
    topic: string;
    site: string;
    concept: string;
    defense: string;
    category: string;
    harshness: number;
    analysisLength: AnalysisLengthOption;
    singlePersonaId: JuryPersonaId;
    multiPersonaIds: JuryPersonaId[];
}

export interface AnalysisHistoryItem {
    id: string;
    createdAt: string;
    title: string;
    critique: string;
    score: number | null;
    galleryType: GalleryPlacementType;
    previewUrl: string;
    sourceUrl: string | null;
    sourceMime: string | null;
    analysisKind: string;
    aspectRatio?: number;
    isDeleted: boolean;
    deletedAt: string | null;
    purgeAfter: string | null;
}

export interface Flaw {
    x: number;
    y: number;
    width: number;
    height: number;
    reason: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    page?: number;
    pageLabel?: string;
    drawingGuide?: string;
}

export interface PremiumPage {
    page: number;
    pageLabel: string;
    previewUrl: string;
    mimeType: string;
    sourceName?: string;
}

export interface PremiumData {
    flaws: Flaw[];
    reference: string;
    practicalSolutions: string[];
    pages?: PremiumPage[];
    drawingInstructions?: string[];
    summary?: string;
    imageEditPlanEnabled?: boolean;
}

export interface PersonaCritique {
    id: string;
    name: string;
    critique: string;
    score: number;
}

export interface MultiPersonaData {
    personas: PersonaCritique[];
    projectTitle?: string;
    structural?: { critique: string; score: number };
    conceptual?: { critique: string; score: number };
    grumpy?: { critique: string; score: number };
}

export interface DefenseMessage {
    role: 'user' | 'jury';
    text: string;
}

export interface Badge {
    id: string;
    name: string;
    description: string;
    icon: string;
    earned: boolean;
}

export interface Charette {
    id: string;
    title: string;
    description: string;
    deadline: string;
    reward: number; // Rapido kalem
    participants: number;
}

export interface LeaderboardUser {
    id: string;
    name: string;
    university: string;
    score: number;
    badges: Badge[];
}

// Stripe-related profile fields (stored in Supabase profiles table)
export interface StripeProfileFields {
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    edu_verified?: boolean;
    edu_email?: string | null;
}
