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

| Prop         | 타입                                            | 기본값               | 설명                                                                     |
| ------------ | ----------------------------------------------- | -------------------- | ------------------------------------------------------------------------ |
| `children`   | `ReactNode`                                     | -                    | 경계 안쪽                                                                |
| `fallback`   | `(props: QueryErrorFallbackProps) => ReactNode` | `QueryErrorFallback` | 직접 그릴 fallback. 컴포넌트 안에서 렌더된다                             |
| `resetKeys`  | `unknown[]`                                     | -                    | 바뀌면 이전 오류 상태를 자동으로 해제                                    |
| `resetScope` | `'own' \| 'parent'`                             | `'own'`              | 다시 시도가 풀 조회 오류의 범위. 바깥 경계의 조회를 함께 그리면 `parent` |

## 안쪽 경계가 바깥 경계의 조회를 함께 그릴 때

경계마다 TanStack `QueryErrorResetBoundary`를 하나씩 둬, 다시 시도는 그 경계 안의 조회 오류만 풉니다. 안쪽 경계 아래에서
바깥 경계의 조회를 함께 읽으면(할 일 상세 칸의 댓글 목록 머리가 본문을 그리는 경우) 바깥 경계의 다시 시도 뒤에도 그 조회는
풀리지 않은 안쪽 범위에서 다시 읽혀 다시 받지 않고(`retryOnMount: false`) 남은 오류를 그대로 던집니다. 그런 안쪽 경계는
`resetScope="parent"`로 바깥 범위를 함께 씁니다. 안쪽 fallback이 바깥 조회를 다시 그리면 그 오류는 다시 던져져 바깥 경계
한 곳이 받습니다.

```tsx
<QueryErrorBoundary resetKeys={[todoId]}>
  <Suspense fallback={<TodoCommentPane.Loading />}>
    <QueryErrorBoundary
      resetKeys={[todoId, sort, comment]}
      resetScope="parent"
      fallback={TodoCommentThreadList.Error}
    >
      <TodoCommentThreadList />
    </QueryErrorBoundary>
    <TodoCommentComposerBar />
  </Suspense>
</QueryErrorBoundary>
```

`QueryErrorFallbackProps`의 `error`는 `unknown`이므로 `shared/errors`의 판별 함수로 좁힙니다.

## 기능 fallback의 다시 시도 + 문의하기

기능별 `X.Error`는 자기 레이아웃(`Result` 제목 등)을 그대로 두고 버튼 자리에 `QueryErrorActions`를 둡니다.
다시 시도(주 버튼)와 문의하기(보조 텍스트 버튼)가 함께 나오고, 문의하기는 오류 신고 분류(`BUG_REPORT`)를 고른
문의 화면을 엽니다. 본문 첫 줄에는 경계가 받은 오류의 진단 값(진단 코드·오류 코드·요청 ID, `query-error-actions.tsx`의 `toErrorInquiryDraft`)이
미리 들어가 서버 로그·Sentry를 바로 찾습니다. 경계 밖에서는 진단 코드만 담습니다. 사용자·기기 식별자와 오류 문구는 넣지 않습니다. 다시 시도 버튼만 쓸 때는 `QueryErrorActions.Retry`이고, 누르면
`error_fallback_retry_tapped { screen_name }`을 남깁니다.

```tsx
X.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('common');
  return <Result title={t('errorBoundary.title')} button={<QueryErrorActions onRetry={reset} />} />;
};
```

카드·스트립 안의 한 줄 안내는 `QueryErrorFallback.Inline`입니다. 메시지와 다시 시도 버튼을 한 줄에 놓고, `hasInquiry`를 켜면 문의하기가 버튼 아래에 붙습니다. 줄의 여백·배경·높이는 `className`·`style`로, 글자 크기는 `messageProps`로 정합니다.

```tsx
<QueryErrorFallback.Inline message={t('friend:list.loadFailed')} reset={reset} hasInquiry />
```

route 시트 안에서는 시트를 먼저 닫고 문의 화면을 엽니다. `onInquiry`는 초안이 담긴 문의 `href`를 받으므로
`sheet.close({ type: 'dismiss-to', href })`로 넘깁니다. 문의는 탭 화면이라 시트와 그 아래 탭 위 화면을 닫고 탭 묶음 하나 안, 시트 아래 보던 탭에서 엽니다(`dismissToTab`). `RouteBottomSheet`가 이 경계를 갖고 있어 시트는 경계를 다시 두지 않습니다. 경계가 시트 밖에 있는
폼 시트만 fallback이 `sheet`를 받을 수 있게 경계에서 넘깁니다.

```tsx
<QueryErrorBoundary
  fallback={(fallbackProps) => (
    <X.Error {...fallbackProps} onInquiry={(href) => sheet.close({ type: 'dismiss-to', href })} />
  )}
>
```

`ConfirmDialog` 같은 다이얼로그는 버튼 배치를 그대로 두고 설명 자리에 `QueryErrorActions.Inquiry`를 둡니다.
`onPress`를 넘기지 않으면 바로 문의 화면으로 이동하고, 먼저 닫아야 하는 곳은 받은 `href`로 닫은 뒤 이동하는 `onPress`를 넘깁니다.

## 예상한 상태(404·403)

기본 fallback은 예상하지 못한 오류용입니다. 대상이 없거나 볼 수 없는 상태(404·403)는 다시 시도해도 같으므로, 그런 화면은
feature의 판별 함수(`ErrorCode`로 판별)가 참일 때 "없음" 안내와 갈 곳(목록 등)을 직접 그리고 나머지는
`QueryErrorFallback`에 넘깁니다.

```tsx
<QueryErrorBoundary resetKeys={[id]} fallback={ActivityReport.Error}>
```

`ActivityReport.Error`는 `isReportUnavailableError(error)`(`domains/report.error.ts`)일 때 "없음" 안내와 목록으로 가는 버튼을, 아니면 `QueryErrorFallback`을 그립니다. 판별은 화면이 아니라 feature의 `domains/{feature}.error.ts`에 둡니다.

## 오류 보고

`shared/errors`의 `classifyError(error).kind`에 따라 보고 강도를 나눕니다.

| kind           | 대상                                                                | 보고                                                         |
| -------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| `auth-expired` | 401 `ApiError`                                                      | warning 메시지 `query_boundary_auth_contained`               |
| `expected`     | 그 밖의 4xx(404 없음, 403 볼 수 없음·기능 꺼짐 등), `BusinessError` | `http` breadcrumb `query_boundary_expected_state`(코드·상태) |
| `connectivity` | `NetworkError`·`TimeoutError`                                       | `network` breadcrumb                                         |
| `unexpected`   | 5xx·`ParseError`·렌더 오류 등                                       | `reportUnexpectedError`(요청 태그 포함) 이슈                 |

## 오프라인

경계는 `onlineManager` 연결 상태를 `resetKeys`에 더합니다. 오프라인이 되면 오류 화면을 풀어 멈춘 쿼리의 로딩(또는
캐시)을 보이고, 다시 연결되면 한 번 더 풀어 새로 불러옵니다. 오프라인 안내는 루트의 `OfflineBanner` 한 곳에서만 합니다.
온라인인데 5xx·타임아웃이면 지금처럼 블록마다 다시 시도 + 문의하기를 보입니다.
