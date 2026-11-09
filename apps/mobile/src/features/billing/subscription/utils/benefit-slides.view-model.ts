import type { BenefitSlide } from '../constants/subscription.constants';
import type { EntitlementFeature } from '../domains/entitlement.model';

/** 막혀서 들어온 기능의 혜택부터 보여 준다. 혜택 장에 없는 기능이면 첫 장이다 */
export function getInitialBenefitIndex(
  slides: readonly Pick<BenefitSlide, 'feature'>[],
  feature: EntitlementFeature | undefined,
): number {
  const index = feature == null ? -1 : slides.findIndex((slide) => slide.feature === feature);
  return Math.max(index, 0);
}

/** 막힌 기능이 혜택 장에 있으면 그 장이 설명하므로 따로 기능 카드를 두지 않는다 */
export function hasBenefitSlide(
  slides: readonly Pick<BenefitSlide, 'feature'>[],
  feature: EntitlementFeature,
): boolean {
  return slides.some((slide) => slide.feature === feature);
}
