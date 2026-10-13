import { pickLocalized, type SupportedLanguage } from '@/lib/i18n';

type LabelPair = readonly [tr: string, en: string];

// Keys mirror the event_type strings written to billing_events (stripe-webhook-processor, reward-policy, promo-codes).
const EVENT_LABELS = new Map<string, LabelPair>(Object.entries({
  premium_monthly: ['Premium Aylık Üyelik', 'Premium monthly'],
  premium_yearly: ['Premium Yıllık Üyelik', 'Premium yearly'],
  premium_renewal: ['Premium Üyelik Yenileme', 'Premium renewal'],
  premium_ended: ['Premium Üyelik Sona Erdi', 'Premium ended'],
  premium_refund: ['Premium İadesi', 'Premium refund'],
  rapido_pack: ['Rapido Satın Alımı', 'Rapido purchase'],
  rapido_pack_refund: ['Rapido İadesi', 'Rapido refund'],
  checkout_rejected: ['Ödeme Reddedildi', 'Payment rejected'],
  registration_bonus: ['Kayıt Bonusu', 'Registration bonus'],
  referral_reward_new_user: ['Davet Ödülü (Yeni Üye)', 'Referral reward (new member)'],
  referral_reward_referrer: ['Davet Ödülü', 'Referral reward'],
  peer_review_reward: ['Akran Değerlendirme Ödülü', 'Peer review reward'],
  edu_verification: ['Öğrenci Doğrulama Ödülü', 'Student verification reward'],
  promo_redemption_premium: ['Promosyon Kodu (Premium)', 'Promo code (Premium)'],
  promo_redemption_rapido: ['Promosyon Kodu (Rapido)', 'Promo code (Rapido)'],
} satisfies Record<string, LabelPair>));

const DISPUTE_SUBJECTS = new Map<string, LabelPair>(Object.entries({
  premium: ['Premium', 'Premium'],
  rapido_pack: ['Rapido', 'Rapido'],
} satisfies Record<string, LabelPair>));

const DISPUTE_STAGES = new Map<string, LabelPair>(Object.entries({
  opened: ['açıldı', 'opened'],
  won: ['kapandı, ödeme geçerli', 'closed, charge upheld'],
  lost: ['kapandı, iade edildi', 'closed, refunded'],
} satisfies Record<string, LabelPair>));

const DISPUTE_PATTERN = /^(premium|rapido_pack)_dispute_([a-z_]+)$/;

/** Readable tr/en label for a billing_events.event_type; unknown or empty types get a generic label, never the raw key. */
export function toBillingEventLabel(eventType: string, language: SupportedLanguage): string {
  const known = EVENT_LABELS.get(eventType);
  if (known) return pickLocalized(language, known[0], known[1]);

  const dispute = DISPUTE_PATTERN.exec(eventType);
  const subject = dispute ? DISPUTE_SUBJECTS.get(dispute[1] ?? '') : undefined;
  if (dispute && subject) {
    const stage = DISPUTE_STAGES.get(dispute[2] ?? '') ?? ['güncellendi', 'updated'];
    return pickLocalized(
      language,
      `${subject[0]} Ödeme İtirazı (${stage[0]})`,
      `${subject[1]} payment dispute (${stage[1]})`,
    );
  }

  return pickLocalized(language, 'Hesap Hareketi', 'Account activity');
}
