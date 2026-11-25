---
name: mobile-feature
description: 모바일 앱(apps/mobile)에 새 기능·화면·엔티티를 추가할 때 폴더 골격과 순서를 따른다. 모델, 스키마, api·mapper, DI, 쿼리, 컴포넌트, 화면, 이벤트, 테스트 순서로 만든다.
---

# 모바일 새 기능 추가 순서

경로는 `apps/mobile` 기준이다. 이 스킬은 순서만 말하고 규칙은 링크한 문서에 있다. 쓰는 폴더만 만든다.

## 1. 둘 곳과 골격

둘 곳은 [구조 §기능 경계](../../../apps/mobile/docs/architecture/structure.md#기능-경계)의 순서로 정하고, 폴더는 [§기능 폴더 골격](../../../apps/mobile/docs/architecture/structure.md#기능-폴더-골격)에서 쓰는 것만 만든다.

## 2. 있는 것부터 찾는다

컴포넌트·훅을 만들기 전에 [UI 카탈로그](../../../apps/mobile/docs/architecture/ui-catalog.md)와 [훅](../../../apps/mobile/docs/architecture/hooks.md)에 같은 일을 하는 공용 부품·훅이 있는지 본다. 있으면 그것을 쓴다.

## 3. 순서

1. **모델** `domains/{entity}.model.ts`: Zod 모델, 원시 인자 순수 함수, `{Entity}Policy`(메서드 + `this`, 첫 인자는 모델 전체). 업무 규칙만 둔다. 계약 import, i18n 키, 시계 읽기, 폴링 주기를 넣지 않는다([모델](../../../apps/mobile/docs/architecture/model.md#모델과-policy)). 기능 오류 코드·칸 매핑은 `domains/{feature}.error.ts`다.
2. **모델 테스트** `{entity}.model.test.ts`: 경계값을 `it.each`와 fixture로 쓰고 `describe(함수)`·`describe(Policy)` > `describe(메서드)`로 묶는다.
3. **스키마** `schemas/`: 폼 스키마는 `@aido/api` 요청 스키마에서 `pick`·`omit`·`extend`로 유도한다. route params는 `{name}-params.schema.ts`, 기기 저장 값은 `-storage.schema.ts`의 `defineStoredValue`다.
4. **api와 mapper** `apis/{entity}.api.ts`: `{Entity}Api`가 HttpClient로 호출하고 `parseApiResponse` 뒤 mapper를 부른다. 바깥 값 변환은 `{entity}.mapper.ts` 한 곳이다. 비자명한 mapper는 계약으로 검증한 fixture로 테스트한다.
5. **DI 등록**([DI·포트·수명](../../../apps/mobile/docs/architecture/structure.md#di포트수명)): `src/bootstrap/providers/create-app-container.ts`에 `{Entity}Api`를 만들고 `src/bootstrap/providers/di-context.tsx`에 `use{Entity}Api`를 더한다. 새 기기 능력이면 아래를 함께 더한다.
   - 포트 `src/core/ports/{port}.ts` → 어댑터 `src/shared/infra/{영역}/{공급자}-{port}.ts` → `src/bootstrap/providers/create-device-ports.ts`(프로세스 수명 조립은 `composition-root.ts`가 부른다) → `create-app-container.ts`의 `AppContainerPorts`.
   - 테스트 stub `src/testing/ports/{port}.stub.ts`의 `create{Port}Stub()`를 만들고 `src/testing/core.ts`에서 내보낸 뒤 `src/testing/di.ts`의 `createTestPorts` 기본값에 넣는다([테스트 도구](../../../apps/mobile/docs/testing-tools.md#srctesting)).
6. **쿼리** `queries/`: 키는 `{feature}-query-keys.ts`·`{feature}-mutation-keys.ts`, 옵션 훅은 `useGet{X}QueryOptions`·`use{Verb}{X}MutationOptions`, 클라이언트 거르기·정렬은 이름 있는 `select{X}`다([데이터 §흐름](../../../apps/mobile/docs/architecture/data.md#흐름-mapper--캐시--select--view-model)). 캐시 쓰기·무효화·`meta.errorFeedback`·cache helper는 [데이터 §무효화·Mutation 옵션](../../../apps/mobile/docs/architecture/data.md#무효화)을 따른다.
7. **컴포넌트** `components/`: 조회·mutation·오류 판별·시트 열기를 갖고 레이아웃은 모른다. 모양은 [UI §컴포넌트 계약](../../../apps/mobile/docs/architecture/ui.md#컴포넌트-계약)이다.
8. **화면** `app/.../{route}.tsx`: route 파일이 단계·경계·문구·`Spacing`·폼을 조립하고 그 화면만 쓰는 조각은 같은 파일의 지역 컴포넌트·훅이다. 모양은 [UI §스크린](../../../apps/mobile/docs/architecture/ui.md#스크린), 폼은 [폼](../../../apps/mobile/docs/architecture/forms.md), 단계 흐름은 [useStepper](../../../apps/mobile/docs/architecture/hooks.md#usestepper), params 검증·이동·여러 탭에서 여는 화면은 [상태와 라우팅](../../../apps/mobile/docs/architecture/state-and-routing.md#params-튜플)이다.
9. **문구**: 사용자에게 보이는 글은 `src/shared/i18n/locales/{ko,en}/{namespace}.json`에 함께 넣는다. 키·톤은 [날짜와 언어 §새 문자열](../../../apps/mobile/docs/dates-and-i18n.md#새-문자열)이다.
10. **이벤트·로그 키**: `constants/{entity}.events.ts`(분석), `constants/{feature}-log-events.ts`(로그). 추적 자리는 [관측](../../../apps/mobile/docs/observability.md)이다.
11. **테스트**: 무엇을 쓸지는 [모바일 테스트](../../../apps/mobile/docs/testing.md#도구와-범위)다. 있는 화면의 구조를 바꿀 때는 그 화면의 흐름 테스트를 먼저 붙인다. fixture는 `__tests__/{entity}.fixtures.ts`의 `defineFixture`, 화면은 `__tests__/{route}-screen.test.tsx`에서 `createTestDi({ ports })` + `renderScreen`이다([테스트 도구](../../../apps/mobile/docs/testing-tools.md#화면-테스트)).
12. **검증**: `pnpm check`와 해당 기능 테스트(`pnpm --filter @aido/mobile test -- {feature}`)를 돌린다. 누름 동작은 기기에서도 확인한다.

## 유료 기능

게이트(`useEntitlementGate`)와 기능 키·표 추가 순서는 [디자인 §한도·프리미엄·AI 안내](../../../apps/mobile/docs/design.md#한도프리미엄ai-안내)다.

자세히: [구조](../../../apps/mobile/docs/architecture/structure.md) · [데이터](../../../apps/mobile/docs/architecture/data.md) · [폼](../../../apps/mobile/docs/architecture/forms.md) · [UI](../../../apps/mobile/docs/architecture/ui.md)
