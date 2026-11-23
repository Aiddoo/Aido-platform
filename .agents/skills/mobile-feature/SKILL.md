---
name: mobile-feature
description: 모바일 앱(apps/mobile)에 새 기능·화면·엔티티를 추가할 때 폴더 골격과 순서를 따른다. 모델, 스키마, api·mapper, DI, 쿼리, 컴포넌트, 화면, 이벤트, 테스트 순서로 만든다.
---

# 모바일 새 기능 추가 순서

경로는 `apps/mobile` 기준이다. 각 단계의 상세 규칙은 링크한 문서와 `apps/mobile/.claude/rules/*.md`에 있다. 쓰는 폴더만 만든다.

## 1. 둘 곳과 골격

둘 곳은 [구조 §기능 경계](../../../apps/mobile/docs/architecture/structure.md#기능-경계)의 순서로 정하고, 폴더는 [§기능 폴더 골격](../../../apps/mobile/docs/architecture/structure.md#기능-폴더-골격)에서 쓰는 것만 만든다.

## 2. 순서

1. **모델** `domains/{entity}.model.ts`: Zod 모델, 이름 있는 순수 함수, `{Entity}Policy`. 업무 규칙만 둔다. 계약 import, i18n 키, 시계 읽기를 넣지 않는다. 기능 오류 코드·칸 매핑은 `domains/{feature}.error.ts`다.
2. **모델 테스트** `{entity}.model.test.ts`: 경계값을 `it.each`와 fixture로 쓴다.
3. **스키마** `schemas/`: 폼 스키마는 `@aido/api` 요청 스키마에서 `pick`·`omit`·`extend`로 유도한다. route params는 `{name}-params.schema.ts`, 기기 저장 값은 `-storage.schema.ts`의 `defineStoredValue`다.
4. **api와 mapper** `apis/{entity}.api.ts`: `{Entity}Api`가 HttpClient로 호출하고 `parseApiResponse` 뒤 mapper를 부른다. 바깥 값 변환은 `{entity}.mapper.ts` 한 곳이다. 비자명한 mapper는 계약으로 검증한 fixture로 테스트한다.
5. **DI 등록**: `src/bootstrap/providers/create-app-container.ts`에 `{Entity}Api`를 만들고 `src/bootstrap/providers/di-context.tsx`에 `use{Entity}Api`를 더한다. 새 기기 능력이면 포트와 `src/testing/ports/{port}.stub.ts`도 만든다.
6. **쿼리** `queries/`: 키는 `{feature}-query-keys.ts`, 옵션 훅은 `useGet{X}QueryOptions`·`use{Verb}{X}MutationOptions`다. 캐시 쓰기·무효화·`meta.errorFeedback`·cache helper는 [데이터 §무효화·Mutation 옵션](../../../apps/mobile/docs/architecture/data.md#무효화)을 따른다.
7. **컴포넌트** `components/`: 모양은 [UI](../../../apps/mobile/docs/architecture/ui.md#기준-컴포넌트)를 따른다.
8. **화면** `app/.../{route}.tsx`: 스크린 모양은 [UI §스크린](../../../apps/mobile/docs/architecture/ui.md#스크린), params 검증·이동·여러 탭에서 여는 화면은 [상태와 라우팅](../../../apps/mobile/docs/architecture/state-and-routing.md#params-튜플)이다.
9. **이벤트·로그 키**: `constants/{entity}.events.ts`(분석), `{entity}-log-events.ts`(로그). 추적은 mutation 옵션이나 UI에서만 한다.
10. **테스트**: 모델·Policy, 비자명한 mapper, cache 갱신·롤백, 핵심 흐름만 쓴다. 화면 테스트는 `__tests__/{route}-screen.test.tsx`에 둔다.
11. **검증**: `pnpm check`와 해당 기능 테스트(`pnpm --filter @aido/mobile test -- {feature}`)를 돌린다. 누름 동작은 기기에서도 확인한다.

## 유료 기능

게이트(`useEntitlementGate`)와 기능 키·표 추가 순서는 [디자인 §한도·프리미엄·AI 안내](../../../apps/mobile/docs/design.md#한도프리미엄ai-안내)다.

자세히: [구조](../../../apps/mobile/docs/architecture/structure.md) · [데이터](../../../apps/mobile/docs/architecture/data.md) · [UI](../../../apps/mobile/docs/architecture/ui.md)
