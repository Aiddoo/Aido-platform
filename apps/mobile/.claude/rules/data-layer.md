---
paths:
  - 'src/features/**/{apis,services,repositories,stores,queries,schemas}/**'
  - 'src/shared/storage/**'
---

# 데이터 층

규칙의 원본은 [데이터](../../docs/architecture/data.md)(Api·service·repository·store, 저장 값, 쿼리·`select`·mutation), [폼](../../docs/architecture/forms.md), [모델](../../docs/architecture/model.md#mapper)(mapper·파싱·null)이다. 키에는 서버 인자만 넣고 클라이언트 필터·정렬·범위는 `queries/`의 이름 있는 `select{X}`로 나눈다. 아래는 lint가 막는 것이다.

- `queryClient`는 `queries/{feature}-cache.ts`만 만지고, cache helper는 이벤트·로그·Api를 import하지 않는다(`aido/query-client-location`, depcruise `cache-helper-purity`).
- 쿼리 키는 `queries/*-query-keys.ts`에만 쓴다(`aido/query-key-location`).
- mutation 옵션마다 `meta.errorFeedback`를 둔다(`aido/mutation-error-feedback`, [오류](../../docs/error-handling.md#mutation-오류-피드백)).
- 저장 키 문자열은 `schemas/*-storage.schema.ts`·repository 밖에 쓰지 않는다(`aido/storage-key-location`).
- 추적은 api·service·repository·store·mapper·cache helper에서 하지 않는다(`aido/track-location`).
- `apis/`와 `repositories/`는 서로·`services/`를 import하지 않는다(depcruise `api-folder-dependency`·`repository-folder-dependency`). mapper는 시계를 읽지 않는다(`aido/no-clock-read`).
- 폼은 `FormProvider`·`useFormContext`를 쓰지 않는다(`aido/form-shape`).

전체 lint 목록은 [가드레일](../../docs/architecture/guardrails.md#규칙)이다.
