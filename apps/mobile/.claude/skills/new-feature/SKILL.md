---
name: new-feature
description: 새 기능·새 화면·새 엔티티를 추가할 때 폴더 골격과 순서를 따른다. 모델, 스키마, api·mapper, DI, 쿼리, 컴포넌트, 화면, 이벤트, 테스트 순서로 만든다.
---

# 새 기능 추가 순서

각 단계의 상세 규칙은 `.claude/rules/*.md`가 해당 파일을 열 때 자동으로 붙는다. 쓰는 폴더만 만든다.

## 1. 둘 곳과 골격

둘 곳은 [구조 §기능 경계](../../../docs/architecture/structure.md#기능-경계)의 순서로 정하고, 폴더는 [§기능 폴더 골격](../../../docs/architecture/structure.md#기능-폴더-골격)에서 쓰는 것만 만든다.

## 2. 순서

1. **모델** `domains/{entity}.model.ts`: Zod 모델, 이름 있는 순수 함수, `{Entity}Policy`. 업무 규칙만 둔다. 계약 import, i18n 키, 시계 읽기를 넣지 않는다. 기능 오류 코드·칸 매핑은 `domains/{feature}.error.ts`다.
2. **모델 테스트** `{entity}.model.test.ts`: 경계값을 `it.each`와 fixture로 쓴다.
3. **스키마** `schemas/`: 폼 스키마는 `@aido/api` 요청 스키마에서 `pick`·`omit`·`extend`로 유도한다. route params는 `{name}-params.schema.ts`, 기기 저장 값은 `-storage.schema.ts`의 `defineStoredValue`다.
4. **api와 mapper** `apis/{entity}.api.ts`: `{Entity}Api`가 HttpClient로 호출하고 `parseApiResponse` 뒤 mapper를 부른다. 바깥 값 변환은 `{entity}.mapper.ts` 한 곳이다. 비자명한 mapper는 계약으로 검증한 fixture로 테스트한다.
5. **DI 등록**: `src/bootstrap/providers/create-app-container.ts`에 `{Entity}Api`를 만들고 `src/bootstrap/providers/di-context.tsx`에 `use{Entity}Api`를 더한다. 새 기기 능력이면 포트와 `src/testing/ports/{port}.stub.ts`도 만든다.
6. **쿼리** `queries/`:
   - 키는 `{feature}-query-keys.ts`, 잎은 `queryOptions<T>`다.
   - `useGet{X}QueryOptions`(필요하면 `select`)와 `use{Verb}{X}MutationOptions`를 만든다.
   - mutation은 `onSuccess`에 캐시 쓰기, `onSettled`에 무효화, `meta.errorFeedback`을 둔다.
   - `queryClient`는 `{feature}-cache.ts`에서만 만진다.
7. **컴포넌트** `components/`: 자기 데이터를 스스로 조회한다. 부모 없이 의미 없는 조각은 `Parent.Part`, 반복 고정 UI는 지역 컴포넌트를 항목마다 한 줄씩 쓴다. 위치 이름과 바깥 여백을 쓰지 않는다.
8. **화면** `app/.../{route}.tsx`: route 파일만 둔다. 경계·`Suspense`·`<Spacing>`·`match(view).exhaustive()`를 화면에서 정한다. params는 `useRouteParamsOrRedirect`로 검증해 틀리면 되돌리고, 안쪽 화면은 같은 스키마의 튜플 훅으로 읽는다. 이동은 typed `router.push({ pathname, params })`다.
9. **이벤트·로그 키**: `constants/{entity}.events.ts`(분석), `{entity}-log-events.ts`(로그). 추적은 mutation 옵션이나 UI에서만 한다.
10. **테스트**: 모델·Policy, 비자명한 mapper, cache 갱신·롤백, 핵심 흐름만 쓴다. 화면 테스트는 `__tests__/{route}-screen.test.tsx`에 둔다.
11. **검증**: `pnpm check`와 해당 기능 테스트(`pnpm --filter @aido/mobile test -- {feature}`)를 돌린다. 누름 동작은 기기에서도 확인한다.

## 유료 기능 예시

```ts
// 핸들러: 막히면 업셀을 띄우고 멈춘다
const gate = useEntitlementGate('WEEKLY_PLAN', { surface: 'weekly_plan' });
const handlePress = () => {
  if (gate.promptIfBlocked()) {
    return;
  }
  createWeeklyPlan();
};

// 쿼리 옵션: 구독이 바뀌면 다시 읽는다
queryOptions({ queryKey: WEEKLY_PLAN_QUERY_KEYS.detail({ weekKey }), queryFn, meta: { refreshOnPremiumChange: true } });
```

- 기능 키와 한도는 `@aido/api/vocabulary`(`PREMIUM_FEATURE_KEYS`)에 먼저 더한다. `EntitlementPolicy`가 튜플에서 유도하고, 게이트 제목 키와 `surface`(`EntitlementGateSurface`)도 함께 더한다.
- 결제 SDK·paywall·다른 기능의 파일은 고치지 않는다.

자세히: [구조](../../../docs/architecture/structure.md) · [데이터](../../../docs/architecture/data.md) · [UI](../../../docs/architecture/ui.md)
