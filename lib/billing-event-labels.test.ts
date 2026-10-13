import { toBillingEventLabel } from '@/lib/billing-event-labels';

describe('toBillingEventLabel', () => {
  it.each([
    ['premium_monthly', 'Premium Aylık Üyelik', 'Premium monthly'],
    ['checkout_rejected', 'Ödeme Reddedildi', 'Payment rejected'],
    ['premium_refund', 'Premium İadesi', 'Premium refund'],
    ['rapido_pack_refund', 'Rapido İadesi', 'Rapido refund'],
    ['premium_ended', 'Premium Üyelik Sona Erdi', 'Premium ended'],
    ['registration_bonus', 'Kayıt Bonusu', 'Registration bonus'],
    ['referral_reward_referrer', 'Davet Ödülü', 'Referral reward'],
    ['premium_dispute_opened', 'Premium Ödeme İtirazı (açıldı)', 'Premium payment dispute (opened)'],
    ['rapido_pack_dispute_lost', 'Rapido Ödeme İtirazı (kapandı, iade edildi)', 'Rapido payment dispute (closed, refunded)'],
    ['premium_dispute_under_review', 'Premium Ödeme İtirazı (güncellendi)', 'Premium payment dispute (updated)'],
  ])('maps %s to tr/en labels', (eventType, tr, en) => {
    expect(toBillingEventLabel(eventType, 'tr')).toBe(tr);
    expect(toBillingEventLabel(eventType, 'en')).toBe(en);
  });

  it.each(['some_future_event', '', 'constructor', 'dispute_opened'])('falls back to a generic label for %p', (eventType) => {
    expect(toBillingEventLabel(eventType, 'tr')).toBe('Hesap Hareketi');
    expect(toBillingEventLabel(eventType, 'en')).toBe('Account activity');
  });
});
