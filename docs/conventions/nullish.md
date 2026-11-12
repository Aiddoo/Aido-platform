# null·undefined와 비교 연산

서버·모바일·`@aido/api` 공통 기준이다. 대상은 `apps/api/src`·`apps/mobile/src`·`apps/mobile/app`·`packages/*/src`다. 공개 계약은 하위 호환을 먼저 지킨다.

## 1. 비교는 `===`, "없음"만 `== null`

값 비교는 항상 `===`/`!==`를 쓴다. 유일한 예외는 "값이 없음"(null 또는 undefined) 판단이며 `== null`/`!= null`로 쓴다.

```ts
// ✅
if (status === "DONE") { … }
if (todo == null) { return <TodoDetail.Empty />; }
const hasMemo = memo.content != null;

// ❌
if (count == 0) { … }             // 형 변환 비교
if (todo === null || todo === undefined) { … } // `== null` 한 번이면 된다
if (todo == undefined) { … }      // lint 예외는 `null` 리터럴만 허용한다
```

Oxlint `eslint/eqeqeq: ["error", "always", { "null": "ignore" }]`가 root `.oxlintrc.json`에서 강제한다.

## 2. `=== null` / `=== undefined`는 뜻이 다를 때만

둘을 구분해야 할 때만 엄격하게 비교하고, 비교가 있는 줄 바로 위에 `// oxlint-disable-next-line aido/no-strict-nullish -- <이유>`를 남긴다. 지시문이 없는 `=== null`·`!== null`·`=== undefined`·`!== undefined`는 Oxlint `aido/no-strict-nullish`가 위 경로에서 거부한다. 지시문은 다음 줄 하나에만 걸리므로 비교가 여러 줄에 있으면 줄마다 남기고, 비교가 없는 지시문은 Oxlint가 실패시킨다(`reportUnusedDisableDirectives`). 테스트 디렉터리(`apps/api/test`)와 스크립트는 검사하지 않는다.

- PATCH 입력: 생략(`undefined`) = 바꾸지 않음, `null` = 비우기
- `Map.get`·배열 조회의 미존재(`undefined`)와 저장된 `null` 구분
- 외부 API가 둘 중 하나만 요구할 때(예: TanStack Query `getNextPageParam`은 `undefined`로 끝을 알린다)

```ts
// ✅ PATCH: 세 상태를 구분한다
// oxlint-disable-next-line aido/no-strict-nullish -- 생략은 유지, null은 비우기다
if (input.memo === undefined) {
  // 미제공: 기존 값 유지
  // oxlint-disable-next-line aido/no-strict-nullish -- 생략은 유지, null은 비우기다
} else if (input.memo === null) {
  todo.clearMemo();
} else {
  todo.changeMemo(input.memo);
}

// ❌ 비우기 요청(null)이 기존 값으로 덮인다
const memo = input.memo ?? existing.memo;

// ❌ 타입이 `Memo | null`뿐이라 구분할 의미가 없다
if (memo === null) { … } // → memo == null
```

## 3. 기본값은 `??`, 선택 접근은 `?.`

`||`는 `0`·`""`·`false`도 지우므로 기본값에 쓰지 않는다. 불리언 의미(둘 중 하나라도 참)일 때만 `||`를 쓴다.

```ts
// ✅
const limit = query.limit ?? 20;
const name = user.profile?.nickname ?? fallbackName;
const isBusy = isSaving || isDeleting;

// ❌ limit=0, nickname=""이 기본값으로 바뀐다
const limit = query.limit || 20;
```

필수 값에 `??` 기본값을 덧붙여 잘못된 입력을 감추지 않는다. `null`과 `undefined` 사이를 오가는 `?? undefined`/`?? null`은 받는 API나 계약이 그 형태를 요구할 때만 쓴다. ORM 쓰기처럼 `undefined`가 "바꾸지 않음"인 경계가 그런 경우다.

## 4. 계약 (`@aido/api` Zod)

| 위치                  | 형태                                 | Zod                                   |
| --------------------- | ------------------------------------ | ------------------------------------- |
| 응답의 "값 없음"      | 키를 유지하고 `null`                 | `.nullable()`                         |
| 요청의 선택 입력      | 생략 = `undefined`                   | `.optional()`                         |
| PATCH의 비우기        | 생략 = 유지, `null` = 비우기         | `.nullable().optional()`              |
| 새로 추가한 응답 필드 | REST는 추가만 하므로 optional로 더함 | `.optional()` + 필요 시 `.nullable()` |
| 구버전 호환 파싱 경계 | 구 앱이 `null`·생략을 섞어 보냄      | `.nullish()`                          |

```ts
// ✅ 응답: 키는 항상 있고 값이 없으면 null
endDate: z.iso.date().nullable(),
// ✅ PATCH: 생략과 비우기를 구분
memo: z.string().max(500).nullable().optional(),
// ✅ 새 응답 필드: 추가만 하는 계약이라 optional로 더한다. 앱 mapper가 null로 바꾼다
premiumSource: premiumSourceSchema.nullable().optional(),

// ❌ 기존 응답의 nullable 필드를 optional로 바꾸면 구 앱 파싱이 깨진다
endDate: z.iso.date().optional(),
```

- 기존 필드의 required/optional/nullable 형태는 바꾸지 않는다(하위 호환). 상세: [REST 계약](../../apps/api/docs/http-contracts.md)
- 새 응답 필드를 읽는 클라는 `== null`로 "없음"을 처리한다.
- `.nullish()`와 `.nullable().optional()`은 같은 타입이다. 새 계약에서는 의도가 드러나는 위 표의 형태를 쓰고, `.nullish()`는 구버전 입력을 관대하게 받는 경계에서만 쓴다. 기존 `.nullish()`를 표기 때문에 바꾸지 않는다.

## 5. 도메인·DB (서버)

- DB nullable 컬럼은 도메인에서 `null`이다. 도메인 모델 안에서 같은 "없음"을 `null`과 `undefined`로 섞지 않는다.
- 변환은 mapper·Adapter(경계)에서만 한다. 예: ORM 쓰기의 `undefined` = 변경 생략, `null` = 지우기는 Repository 구현이 해석한다([Drizzle](../../apps/api/docs/persistence.md)).
- Port의 조회 실패·cache miss는 각 Port가 정한 `null`/`undefined` 계약을 따른다.

```ts
// ✅ Repository: 없으면 null
findById(id: number): Promise<Todo | null>;
// ✅ mapper가 DTO 경계를 맡는다
endDate: todo.endDate == null ? null : formatDateOnly(todo.endDate),
```

## 6. 클라이언트 (모바일)

- 서버 DTO의 `null`은 클라이언트 모델에서도 그대로 `null`이다. mapper에서 `undefined`로 바꾸지 않는다(출처를 잃는 `?? undefined`도 쓰지 않는다).
- 선택 props·함수 인자는 `?:`(`undefined`)다. props에 `| null`을 기본 "없음"으로 쓰지 않는다.
- 판단은 `== null`로 하고 조기 반환한다.

| 곳                                  | "없음"                                             | 표기                                 |
| ----------------------------------- | -------------------------------------------------- | ------------------------------------ |
| 응답 DTO, 모델, Policy, `find*`     | `null`                                             | `.nullable()`, `T \| null`           |
| 계약이 `.optional()`로 더한 응답 칸 | mapper가 `null`로 바꾼다                           | DTO 경계에서만 `.optional()`         |
| 요청의 선택 입력                    | 생략(`undefined`)                                  | `.optional()`                        |
| PATCH                               | 생략 = 그대로, `null` = 지우기                     | `.nullable().optional()` + 이유 주석 |
| props·함수 옵션                     | `?:`(`undefined`). `\| null`은 쓰지 않는다         |                                      |
| 값이 없을 수 있는 필수 입력         | `null`                                             | `T \| null`(`?:`와 겹쳐 쓰지 않는다) |
| TanStack `data`를 받는 Policy 인자  | `undefined`(조회 전)                               | `T \| undefined`                     |
| TanStack·RN 콜백, `getCached*`      | `undefined`(라이브러리 계약)                       |                                      |
| 포트                                | 포트마다 하나로 정하고 문서화한다(`null` 권장)     |                                      |
| 세 갈래 결과                        | 판별 유니온. `null` 대 `undefined`로 가르지 않는다 | `{ status: 'cancelled' } \| …`       |

```tsx
// ✅
type TodoCardProps = { todo: Todo; onPress?: () => void };
if (todo.scheduledTime == null) {
  return <TodoCard.AllDay />;
}

// ❌ 서버 null을 undefined로 바꿔 출처를 지운다
scheduledTime: dto.scheduledTime ?? undefined,
```
