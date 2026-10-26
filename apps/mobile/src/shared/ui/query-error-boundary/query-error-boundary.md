# QueryErrorBoundary

Suspense 쿼리가 던진 오류를 잡아 `QueryErrorFallback`(다시 시도 + 문의하기)으로 보여주는 경계입니다.
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

| Prop        | 타입                                            | 기본값               | 설명                                         |
| ----------- | ----------------------------------------------- | -------------------- | -------------------------------------------- |
| `children`  | `ReactNode`                                     | -                    | 경계 안쪽                                    |
| `fallback`  | `(props: QueryErrorFallbackProps) => ReactNode` | `QueryErrorFallback` | 직접 그릴 fallback. 컴포넌트 안에서 렌더된다 |
| `resetKeys` | `unknown[]`                                     | -                    | 바뀌면 이전 오류 상태를 자동으로 해제        |

`QueryErrorFallbackProps`의 `error`는 `unknown`이므로 `shared/errors`의 판별 함수로 좁힙니다.

## 기능 fallback의 다시 시도 + 문의하기

기능별 `X.Error`는 자기 레이아웃(`Result` 제목 등)을 그대로 두고 버튼 자리에 `QueryErrorActions`를 둡니다.
다시 시도(주 버튼)와 문의하기(보조 텍스트 버튼)가 함께 나오고, 문의하기는 오류 신고 분류(`BUG_REPORT`)를 고른
문의 화면(`BUG_REPORT_INQUIRY_HREF`)을 엽니다.

```tsx
X.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('common');
  return <Result title={t('errorBoundary.title')} button={<QueryErrorActions onRetry={reset} />} />;
};
```

route 시트 안에서는 시트를 먼저 닫고 그 자리를 문의 화면으로 바꿉니다(`INQUIRY_SHEET_EXIT`, 문의에서 돌아오면
시트 아래 화면). fallback이 `sheet`를 받을 수 있게 경계에서 넘깁니다.

```tsx
<QueryErrorBoundary
  fallback={(fallbackProps) => (
    <X.Error {...fallbackProps} onInquiry={() => sheet.close(INQUIRY_SHEET_EXIT)} />
  )}
>
```

`ConfirmDialog` 같은 다이얼로그는 버튼 배치를 그대로 두고 설명 자리에 `QueryErrorActions.Inquiry`를 둡니다.
누르면 `onOpenChange(false)`로 닫은 뒤 `openBugReportInquiry()`로 이동합니다.

## 예상한 상태(404)

기본 fallback은 예상하지 못한 오류용입니다. 대상이 없는 상태(404)는 다시 시도해도 같으므로, 그런 화면은
`classifyBoundaryError(error) === 'expected-state'`일 때 "없음" 안내와 갈 곳(목록 등)을 직접 그리고 나머지는
`QueryErrorFallback`에 넘깁니다.

```tsx
<QueryErrorBoundary
  resetKeys={[id]}
  fallback={({ error, reset }) =>
    classifyBoundaryError(error) === 'expected-state' ? (
      <ActivityReport.Unavailable onBackToList={() => router.dismissTo('/reports')} />
    ) : (
      <QueryErrorFallback reset={reset} />
    )
  }
>
```

## 오류 보고

`classifyBoundaryError` 결과에 따라 보고 강도를 나눕니다. 인증 전환 401은 warning 메시지, 예상된 404와
기능이 꺼진 코드(`INVITE_2105`)는 breadcrumb, 그 밖은 `captureException`입니다.

## 파일 구조

```
query-error-boundary/
├── query-error-boundary.tsx       # 컴포넌트
├── query-error-fallback.tsx       # 기본 fallback(다시 시도 + 문의하기)
├── query-error-actions.tsx        # 다시 시도 + 문의하기 버튼, 문의 href·시트 exit
├── query-error-actions.test.tsx   # 버튼·시트 exit 테스트
├── query-error-boundary.test.tsx  # 테스트
├── query-error-boundary.md        # 이 문서
└── index.ts                       # 배럴
```
