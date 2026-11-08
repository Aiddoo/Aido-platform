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

/** 막힌 기능은 페이월 맨 위 카드가 이미 설명하므로 아래 혜택 목록에서 한 번 더 보이지 않게 뺀다 */
function excludeBlockedBenefit<TBenefit extends { feature: EntitlementFeature }>(
  benefits: readonly TBenefit[],
  blockedFeature: EntitlementFeature | undefined,
): TBenefit[] {
  return benefits.filter((benefit) => benefit.feature !== blockedFeature);
}

export const UpsellPolicy = {
  getPromptSurface,
  excludeBlockedBenefit,
} as const;
