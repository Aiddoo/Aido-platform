---
paths:
  - 'src/features/**/{apis,services,repositories,stores,queries,schemas}/**'
  - 'src/shared/storage/**'
---

# 데이터 층

**역할**

- `{Entity}Api`(`apis/{entity}.api.ts`): HttpClient만 쓰고 `Result<T, ApiError>`를 돌려준다. `parseApiResponse` 뒤 mapper를 부른다. 저장소·OS 포트·다른 api·추적·Sentry를 쓰지 않는다. 화살표 필드와 `#`, GET은 `signal`을 받는다.
- mapper는 `apis/`에만 두고 엔티티당 하나다. `to{Model}`, `to{X}Request`, `to{X}FormValues`, `parse{X}(unknown): X | null`. 포트·시계·로그를 쓰지 않는다.
- service는 포트·api·저장소를 엮는 진짜 조율이 있을 때만 만든다. 저장소만 통과시키는 메서드는 없앤다. `HttpClient`를 직접 쓰지 않는다.
- repository는 저장 값 정의로 안 되는 것(SecureStore 비동기, 파일, 접두사 열거·이주, 헤드리스 위젯)만 둔다.
- store는 메모리 상태 기계(`getSnapshot`·`subscribe`)이고 포트·영속을 갖지 않는다.

**저장 값**

- 저장 값 하나는 `defineStoredValue({ key, area?, schema, fallback, migrate? })` 정의 하나이고 파일 하나다(`schemas/{name}-storage.schema.ts`의 `{name}StoredValue`). `key`는 문자열이거나 범위(계정 id, `{ accountId, locale }`)를 받는 함수, `area`는 `device`(기본)·`account`(로그아웃 때 비우는 암호화 저장소)다. 원문이 JSON이면 `storedJsonSchema(schema)`로 감싼다.
- 화면은 `useStoredValue(def, scope?)` 튜플, 핸들러·effect는 `useStoredValueStorage(def)` + `readStoredValue`·`writeStoredValue`, Service는 받은 저장 포트로 같은 함수를 쓴다. 깨진 값은 `fallback`, `null`을 쓰면 지운다.
- 키는 `aido_{feature}_{name}_v{n}`이고 계정 범위면 `:{accountId}`를 붙인다. 키 문자열을 정의 밖에 쓰지 않는다.

**쿼리와 mutation**

- 쿼리 키·mutation 키는 `queries/{feature}-query-keys.ts`·`-mutation-keys.ts`에 둔다. `constants/`는 일반 상수만 둔다.
- 키 잎은 `queryOptions<T>`로 타입을 붙이고 인자는 객체 하나다. 잎이 루트와 같으면 안 된다.
- `queryClient`는 `queries/{feature}-cache.ts`만 만진다. 컴포넌트·훅은 helper(`invalidate*`·`set*InCache`·`refresh{Feature}`)를 부른다.
- `onSuccess`는 서버 응답을 캐시에 쓰고 무효화는 `onSettled`에 둔다. 같은 키를 set한 뒤 다시 invalidate하지 않는다.
- 다른 기능의 `all`을 무효화하지 않는다. 다른 기능 효과는 `meta.refreshOn*`나 그 기능이 내보낸 helper로 한다.
- 오류 안내는 mutation 옵션마다 둔 `meta.errorFeedback` 하나다(`{ feature, fallbackKey, isHandledByFeature? }` 또는 `false`). 기능 `onError`는 롤백과 `isHandledByFeature`로 뺀 오류(코드별 안내·이동·한도 시트)만 다루고, 칸 오류는 호출부가 `form.setError`로 보인다. 마지막 변경 판정은 `isLastMutation` 하나다.
- 추적은 mutation 옵션(서버가 확정한 결과)이나 UI에서만 한다. api·repository·mapper에서 하지 않는다.

**파싱·null**

- 서버 응답은 strict, 푸시 data·딥링크는 `parse{X}` → `null`, 저장값은 `fallback`이다.
- "없음"은 DTO·모델·`find*`에서 `null`, 요청의 선택 입력은 `undefined`다.
- 폼 스키마는 `schemas/{name}-form.schema.ts`에 계약의 요청 스키마에서 `pick`·`omit`·`extend`로 유도한다.

자세히: [데이터](../../docs/architecture/data.md) · [오류](../../docs/error-handling.md) · [관측](../../docs/observability.md)
