import { dateKeySchema } from '@src/shared/date/date-key';

import { type ReleaseEntry, releaseEntryListSchema } from '../schemas/release-entry.schema';
import { RELEASE_ID } from './whats-new.constants';

// 버전과 날짜는 패치 노트(aido.kr/ko/patch-notes)에서 그 기능이 나온 출시를 따른다
export const RELEASE_1_17_0 = {
  id: RELEASE_ID.v1_17_0,
  version: '1.17.0',
  releasedOn: dateKeySchema.parse('2026-11-24'),
  // 운영 FEATURE_DISCOVERY_CAMPAIGN_ID가 이 값이면 자동으로 연다. 본 기록 키에 들어가 출시 뒤에는 바꾸지 않는다
  campaignId: 'feature-discovery-1.17.0',
  titleKey: 'v1_17_0.release.title',
  descriptionKey: 'v1_17_0.release.description',
  cta: { href: '/todo-import', feature: 'calendar_import' },
} satisfies ReleaseEntry;

export const RELEASE_1_16_0 = {
  id: RELEASE_ID.v1_16_0,
  version: '1.16.0',
  releasedOn: dateKeySchema.parse('2026-11-17'),
  titleKey: 'v1_16_0.release.title',
  descriptionKey: 'v1_16_0.release.description',
  // 무료면 제안 화면이 결제 안내로 이어진다
  cta: { href: '/suggestions', feature: 'ai_suggestion' },
} satisfies ReleaseEntry;

export const RELEASE_1_15_0 = {
  id: RELEASE_ID.v1_15_0,
  version: '1.15.0',
  releasedOn: dateKeySchema.parse('2026-11-10'),
  titleKey: 'v1_15_0.release.title',
  descriptionKey: 'v1_15_0.release.description',
  // 어느 탭에서 와도 오늘 피드 위에 시트를 열어 만든 할 일이 시트 뒤에 보인다. `/todo/new?startVoice=1` 링크는 그대로 둔다
  cta: {
    href: { pathname: '/feed', params: { action: 'add-voice-todo' } },
    feature: 'voice_quick',
  },
} satisfies ReleaseEntry;

/** 최신 출시가 앞이다 */
export const RELEASES = releaseEntryListSchema.parse([
  RELEASE_1_17_0,
  RELEASE_1_16_0,
  RELEASE_1_15_0,
]);
