import { DAY_MS } from '@src/shared/constants/time.constants';

/** 1.15.0 캠페인. 서버 설정의 campaignId가 이 값일 때 소개한다 */
export const WHATS_NEW_CAMPAIGN_ID = 'feature-discovery-2026-12';
/** 1.14.x 캠페인. 서버가 아직 이 id를 가리켜도 친구 초대를 소개한다 */
export const PREVIOUS_WHATS_NEW_CAMPAIGN_ID = 'feature-discovery-2026-11';
/** 1.9.0에 시작한 이전 캠페인. 그때 가입한 사용자의 시작 체크리스트가 이 id로 이어진다 */
export const LEGACY_WHATS_NEW_CAMPAIGN_ID = 'feature-discovery-2026-08';

/** 처음 본 뒤 피드 카드로 다시 열 수 있는 기간 */
export const WHATS_NEW_REENTRY_WINDOW_MS = 14 * DAY_MS;
