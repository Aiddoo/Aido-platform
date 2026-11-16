import type { FeatureAccessStatus } from '@src/features/billing/subscription/hooks/use-feature-access';
import { match } from 'ts-pattern';

/** full은 리포트 전부, teaser는 숫자 모양(달성률·막대·차트)만 보이고 AI 해석·카테고리 세부를 가린다 */
export type ReportVisibility = 'full' | 'teaser';

/** 등급마다 리포트를 얼마나 보일지는 여기서만 정한다. 서버가 권한을 확인하고 준 실제 리포트는 늘 full이다 */
export function getReportVisibility(
  accessStatus: Extract<FeatureAccessStatus, 'premium' | 'free'>,
): ReportVisibility {
  return match(accessStatus)
    .with('premium', () => 'full' as const)
    .with('free', () => 'teaser' as const)
    .exhaustive();
}
