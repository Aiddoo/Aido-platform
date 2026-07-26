# Feature Guide UI and Hashtag Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1.8.0 기능 가이드 미리보기를 실제 Aido 화면과 맞추고 사용자 식별자 명칭을 해시태그로 통일한다.

**Architecture:** 서버와 공유 Zod 계약은 유지하고 모바일 표시 계층만 바꾼다. 해시태그 표시는 순수 formatter로 중앙화하며, 기능 미리보기는 데이터 조회가 없는 독립 컴포넌트로 분리해 실제 화면의 공용 UI 토큰과 구조를 축약 재현한다.

**Tech Stack:** Expo SDK 57, React Native 0.86, React 19.2, TypeScript 5.9, HeroUI Native, shared/ui, i18next, Jest

## Global Constraints

- API의 `userTag` 값과 요청·응답 Zod 스키마는 변경하지 않는다.
- 해시태그 원본은 8자리 영문 대문자·숫자이며 클립보드와 API에는 `#` 없이 사용한다.
- 표시할 때만 `#`을 붙이고 중복 접두어를 만들지 않는다.
- 기능 가이드에서 새로운 쿼리, mutation, 캐시 키를 만들지 않는다.
- 기존 캠페인 상태, 분석 이벤트, CTA 라우팅은 유지한다.
- 클라이언트 신규 테스트는 formatter 같은 비즈니스 규칙과 기존 테스트 갱신으로 제한한다.

---

### Task 1: 해시태그 표시 규칙 중앙화

**Files:**
- Create: `apps/mobile/src/features/user/utils/user-hashtag.ts`
- Create: `apps/mobile/src/features/user/utils/user-hashtag.test.ts`
- Modify: `apps/mobile/src/features/friend/presentations/components/FriendSearchList.tsx`
- Modify: `apps/mobile/src/features/user/presentations/components/ProfileCard.tsx`
- Modify: `apps/mobile/src/shared/i18n/locales/ko/friend.json`
- Modify: `apps/mobile/src/shared/i18n/locales/en/friend.json`
- Modify: `apps/mobile/src/shared/i18n/locales/ko/user.json`
- Modify: `apps/mobile/src/shared/i18n/locales/en/user.json`
- Modify: `apps/mobile/src/shared/i18n/locales/ko/validation.json`
- Modify: `apps/mobile/src/shared/i18n/locales/en/validation.json`

**Interfaces:**
- Produces: `formatUserHashtag(userTag: string): string`
- Consumes: API가 반환하는 접두어 없는 `userTag`

- [ ] **Step 1: formatter 실패 테스트 작성**

```ts
import { formatUserHashtag } from './user-hashtag';

describe('formatUserHashtag', () => {
  it('원본 사용자 태그에 해시 기호를 한 번만 붙인다', () => {
    expect(formatUserHashtag('MATT2025')).toBe('#MATT2025');
    expect(formatUserHashtag('#MATT2025')).toBe('#MATT2025');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @aido/mobile test -- --runInBand apps/mobile/src/features/user/utils/user-hashtag.test.ts`

Expected: `Cannot find module './user-hashtag'`

- [ ] **Step 3: 최소 formatter 구현**

```ts
export function formatUserHashtag(userTag: string): string {
  return userTag.startsWith('#') ? userTag : `#${userTag}`;
}
```

- [ ] **Step 4: 실제 표시와 문구 연결**

친구 검색 결과와 프로필 카드에는 `formatUserHashtag`를 사용하되
`ProfileCard.handleCopyUserTag`는 기존처럼 `user.userTag` 원본을 복사한다.
한국어는 `해시태그`, 영어는 `hashtag`로 바꾸며 형식 오류 문구는 8자리
영문 대문자·숫자 규칙을 유지한다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm --filter @aido/mobile test -- --runInBand apps/mobile/src/features/user/utils/user-hashtag.test.ts`

Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add apps/mobile/src/features/user apps/mobile/src/features/friend/presentations/components/FriendSearchList.tsx apps/mobile/src/shared/i18n/locales
git commit -m "fix(mobile): 사용자 식별자 해시태그 표기 통일"
```

### Task 2: 실제 화면형 기능 미리보기

**Files:**
- Create: `apps/mobile/src/features/feature-discovery/presentations/components/FeatureDiscoveryPreview.tsx`
- Modify: `apps/mobile/src/features/feature-discovery/presentations/components/FeatureDiscoverySheet.tsx`
- Modify: `apps/mobile/src/features/feature-discovery/presentations/components/FeatureDiscoverySheet.test.tsx`
- Modify: `apps/mobile/src/shared/i18n/locales/ko/featureDiscovery.json`
- Modify: `apps/mobile/src/shared/i18n/locales/en/featureDiscovery.json`

**Interfaces:**
- Consumes: `FeatureDiscoveryCardId`, `formatUserHashtag`
- Produces: `FeatureDiscoveryPreview({ cardId }: { cardId: FeatureDiscoveryCardId })`

- [ ] **Step 1: 기존 테스트를 새 사용자 문구로 변경해 실패 확인**

```ts
expect(screen.getByText('이름이나 해시태그로 친구를 찾아요')).toBeTruthy();
expect(screen.getByText('#MATT2025')).toBeTruthy();
expect(screen.queryByText('AI 추천')).toBeNull();
```

Run: `pnpm --filter @aido/mobile test -- --runInBand apps/mobile/src/features/feature-discovery/presentations/components/FeatureDiscoverySheet.test.tsx`

Expected: 기존 `Aido ID`, `AI 추천` 문구 때문에 FAIL

- [ ] **Step 2: 미리보기 컴포넌트 분리**

`FeatureDiscoveryPreview.tsx`에서 네 카드의 정적 미리보기를 구현한다.
컴포넌트는 hook으로 번역만 읽고 서비스, 쿼리, mutation, router를 import하지 않는다.

- [ ] **Step 3: 실제 화면 구조 반영**

친구 검색은 검색 입력과 사용자 결과 행, 드래그 정렬은 색상 점과 오른쪽
`MenuIcon`, 할 일 생성은 입력창과 날짜·시간·반복·카테고리 칩 및 전송 아이콘,
메모 AI는 메모와 로봇 액션 및 변환 결과 행으로 구성한다. 글자 크기 확대 시
`shrink`, `wrap`과 기존 카드 스크롤을 유지한다.

- [ ] **Step 4: 기능 문구 정확화**

친구 검색은 `이름 또는 해시태그`, 할 일 생성은 실제 제공하는 날짜·시간·반복·
공개 범위·카테고리 설정을 안내한다. 메모 AI와 중복되는 `AI 추천` 생성 방식은
제거한다.

- [ ] **Step 5: 기존 기능 가이드 테스트 통과 확인**

Run: `pnpm --filter @aido/mobile test -- --runInBand apps/mobile/src/features/feature-discovery/presentations/components/FeatureDiscoverySheet.test.tsx`

Expected: PASS, 네 CTA callback 검증 유지

- [ ] **Step 6: 커밋**

```bash
git add apps/mobile/src/features/feature-discovery apps/mobile/src/shared/i18n/locales/*/featureDiscovery.json
git commit -m "feat(mobile): 실제 화면형 기능 가이드 미리보기 개선"
```

### Task 3: 호환성 및 실기기 검증

**Files:**
- Verify: `apps/mobile/app.config.ts`
- Verify: `apps/mobile/package.json`
- Verify: `packages/validators/src/domains/follow/follow.request.ts`
- Verify: `apps/api/prisma/schema.prisma`

**Interfaces:**
- Consumes: Task 1과 Task 2의 완성된 모바일 변경
- Produces: 1.7.0 서버 계약 무변경 및 1.8.0 UI 검증 결과

- [ ] **Step 1: 계약 차이 확인**

Run: `git diff develop -- packages/validators apps/api/prisma apps/api/src`

Expected: 출력 없음

- [ ] **Step 2: 모바일 관련 테스트 실행**

Run: `pnpm --filter @aido/mobile test -- --runInBand apps/mobile/src/features/user/utils/user-hashtag.test.ts apps/mobile/src/features/feature-discovery/presentations/components/FeatureDiscoverySheet.test.tsx apps/mobile/src/features/feature-discovery/models/feature-discovery.model.test.ts apps/mobile/src/features/feature-discovery/presentations/navigation/feature-discovery.navigation.test.ts`

Expected: PASS

- [ ] **Step 3: 저장소 필수 검증 실행**

Run: `pnpm typecheck && pnpm lint`

Expected: 두 명령 모두 exit 0

- [ ] **Step 4: iOS Simulator 육안 검증**

개발 서버에서 홈의 `새 기능을 다시 살펴보세요`를 열어 네 미리보기를 확인한다.
친구 찾기 CTA로 이동해 가이드의 검색 입력·결과 행 시각 언어가 실제 화면과
일치하는지 확인한다.

- [ ] **Step 5: 최종 커밋**

```bash
git add -A
git commit -m "test(mobile): 기능 가이드 해시태그 호환성 검증 보강"
```

