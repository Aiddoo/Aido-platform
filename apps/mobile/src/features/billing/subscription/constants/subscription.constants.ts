import benefitAiParsingImage from '@assets/images/subscription/benefit-ai-parsing.webp';
import benefitAiReportImage from '@assets/images/subscription/benefit-ai-report.webp';
import benefitAiRoutineImage from '@assets/images/subscription/benefit-ai-routine.webp';
import benefitAiVoiceNoteImage from '@assets/images/subscription/benefit-ai-voice-note.webp';
import type { FeatureMediaProps } from '@src/shared/ui';

import type { EntitlementFeature } from '../domains/entitlement.model';

export const APP_STORE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';
export const PLAY_STORE_SUBSCRIPTIONS_URL = 'https://play.google.com/store/account/subscriptions';
/** 웹훅이 서버에 도착·처리될 때까지 대기하는 시간 (ms) */
export const WEBHOOK_SYNC_DELAY_MS = 3_000;

export type BenefitSlideTone = 'brand' | 'dark';

export interface BenefitSlide {
  feature: EntitlementFeature;
  /** 글자 없는 그림. 칩·제목·한도는 앱이 글자로 그린다 */
  image: FeatureMediaProps['source'];
  tone: BenefitSlideTone;
}

/** 페이월 맨 위 AI 혜택. 배열 순서가 "혜택 N" 칩 번호다 */
export const BENEFIT_SLIDES = [
  { feature: 'AI_PARSE', image: benefitAiParsingImage, tone: 'brand' },
  { feature: 'AI_REPORT', image: benefitAiReportImage, tone: 'dark' },
  { feature: 'AI_SUGGESTION', image: benefitAiRoutineImage, tone: 'brand' },
  { feature: 'VOICE_NOTE', image: benefitAiVoiceNoteImage, tone: 'dark' },
] as const satisfies readonly BenefitSlide[];

/** 결제 SDK 로그인·로그아웃이 멈춰도 다음 요청(로그아웃·다른 계정 로그인)을 막지 않게 끊는다. 토큰 발급과 같은 15초다 */
export const PURCHASES_SDK_CALL_TIMEOUT_MS = 15_000;
