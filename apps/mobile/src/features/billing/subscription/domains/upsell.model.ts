import { sortBy } from 'es-toolkit';

import { type EntitlementFeature } from './entitlement.model';

/** 막힌 순간의 안내 모양. sheet는 화면을 막고, toast는 하던 일을 막지 않는다 */
export type UpsellPresentation = 'sheet' | 'toast';

/** 같은 기능은 하루 한 번만 시트로 막는다. 대안 동작이 있는 안내는 토스트로는 대안을 고를 수 없어 늘 시트다 */
function getPromptSurface(
  dismissedOn: string | null,
  todayKey: string,
  { hasAlternativeAction }: { hasAlternativeAction: boolean },
): UpsellPresentation {
  if (hasAlternativeAction) {
    return 'sheet';
  }
  return dismissedOn === todayKey ? 'toast' : 'sheet';
}

/** 막힌 기능을 맨 앞으로 올리고 나머지는 원래 순서를 지킨다 */
function sortBenefits<TBenefit extends { feature: EntitlementFeature }>(
  benefits: readonly TBenefit[],
  feature: EntitlementFeature | undefined,
): TBenefit[] {
  return sortBy(benefits, [(benefit) => (benefit.feature === feature ? 0 : 1)]);
}

export const UpsellPolicy = {
  getPromptSurface,
  sortBenefits,
} as const;
