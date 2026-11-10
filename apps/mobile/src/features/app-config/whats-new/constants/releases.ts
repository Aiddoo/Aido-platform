import { type ReleaseEntry, releaseEntryListSchema } from '../schemas/release-entry.schema';
import { RELEASE_ID } from './whats-new.constants';

// 버전과 날짜는 패치 노트(aido.kr/ko/patch-notes)에서 그 기능이 나온 출시를 따른다
export const RELEASE_1_15_0 = {
  id: RELEASE_ID.v1_15_0,
  version: '1.15.0',
  releasedOn: '2026-11-10',
  // 운영 FEATURE_DISCOVERY_CAMPAIGN_ID가 이 값이면 자동으로 연다. 1.15.0 앱의 본 기록 키에도 들어 있어 바꾸지 않는다
  campaignId: 'feature-discovery-2026-12',
  titleKey: 'v1_15_0.release.title',
  descriptionKey: 'v1_15_0.release.description',
  requiresInvite: false,
  cta: {
    href: { pathname: '/todo/new', params: { startVoice: '1' } },
    feature: 'voice_quick',
  },
} satisfies ReleaseEntry;

/** 친구 초대는 1.13.0에 나왔고 소개는 1.14 앱에 처음 넣었다. id는 route·지표 값이라 그대로 둔다 */
export const RELEASE_1_14_0 = {
  id: RELEASE_ID.v1_14_0,
  version: '1.13.0',
  releasedOn: '2026-10-27',
  titleKey: 'v1_14_0.release.title',
  descriptionKey: 'v1_14_0.release.description',
  requiresInvite: true,
  cta: { href: '/friends/invite', feature: 'friend_invite' },
} satisfies ReleaseEntry;

/** 최신 출시가 앞이다 */
export const RELEASES = releaseEntryListSchema.parse([RELEASE_1_15_0, RELEASE_1_14_0]);
