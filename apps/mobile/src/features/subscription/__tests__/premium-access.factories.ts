import type { PremiumAccess } from '../domains/premium-access.model';

export const createPremiumAccess = (overrides?: Partial<PremiumAccess>): PremiumAccess => ({
  source: 'GRANT',
  // 11월 1일 14:30 KST
  endsAt: new Date('2026-11-01T05:30:00Z'),
  willRenew: false,
  bankedDays: 0,
  ...overrides,
});
