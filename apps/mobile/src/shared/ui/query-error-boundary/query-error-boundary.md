# QueryErrorBoundary

Suspense 쿼리가 던진 오류를 잡아 `Result` 화면(다시 시도 버튼)으로 보여주는 경계입니다.
TanStack Query의 `QueryErrorResetBoundary`와 `react-error-boundary`를 묶어, 재시도 시 쿼리 오류도 함께 초기화합니다.

## 사용법

```tsx
import { QueryErrorBoundary } from '@src/shared/ui';

<QueryErrorBoundary>
  <Suspense fallback={<Screen.Loading />}>
    <Screen />
  </Suspense>
</QueryErrorBoundary>;
```

## Props

| Prop        | 타입                                            | 기본값   | 설명                                         |
| ----------- | ----------------------------------------------- | -------- | -------------------------------------------- |
| `children`  | `ReactNode`                                     | -        | 경계 안쪽                                    |
| `fallback`  | `(props: QueryErrorFallbackProps) => ReactNode` | `Result` | 직접 그릴 fallback. 컴포넌트 안에서 렌더된다 |
| `resetKeys` | `unknown[]`                                     | -        | 바뀌면 이전 오류 상태를 자동으로 해제        |

`QueryErrorFallbackProps`의 `error`는 `unknown`이므로 `shared/errors`의 판별 함수로 좁힙니다.

## 오류 보고

`classifyBoundaryError` 결과에 따라 보고 강도를 나눕니다. 인증 전환 401은 warning 메시지, 예상된 404와
기능이 꺼진 코드(`INVITE_2105`)는 breadcrumb, 그 밖은 `captureException`입니다.

## 파일 구조

```
query-error-boundary/
├── query-error-boundary.tsx       # 컴포넌트
├── query-error-boundary.test.tsx  # 테스트
├── query-error-boundary.md        # 이 문서
└── index.ts                       # 배럴
```
