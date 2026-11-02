import { PREMIUM_FEATURES, type PremiumEntitlements as PremiumEntitlementsDto } from '@aido/api';
import { mapValues } from 'es-toolkit';

import type { PremiumEntitlements } from '../domains/premium-entitlement.model';

/** 서버 /me entitlements. 기본은 무료 사용자의 카탈로그 한도다 */
export const createPremiumEntitlementsDto = (
  overrides?: Partial<PremiumEntitlementsDto>,
): PremiumEntitlementsDto => ({
  ...mapValues(PREMIUM_FEATURES, (definition) => ({
    allowed: definition.kind !== 'flag',
    limit: definition.kind === 'flag' ? null : definition.free,
  })),
  ...overrides,
});

export const createPremiumEntitlements = (
  overrides?: Partial<PremiumEntitlements>,
): PremiumEntitlements => ({
  ...mapValues(PREMIUM_FEATURES, (definition) => ({
    allowed: definition.kind !== 'flag',
    limit: definition.kind === 'flag' ? null : definition.free,
  })),
  ...overrides,
});
