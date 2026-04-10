export const MENTOR_TOKEN_LIMITS = {
  PREMIUM_PER_CHAT: 12000,
  FREE_PER_CHAT: 6000,
} as const;

export const MENTOR_FREE_MONTHLY_CHAT_LIMIT = 1;

export function getCurrentMonthKey(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

export function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
