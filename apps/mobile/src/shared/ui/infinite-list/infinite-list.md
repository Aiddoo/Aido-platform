# InfiniteList

서버 커서 목록(TanStack `useSuspenseInfiniteQuery`)을 위한 FlashList 확장이다. 하단 로딩, 다음 페이지 실패 시 재시도,
`onEndReached` 중복 호출 방지, 당겨서 새로고침을 한 곳에서 맡는다. 짧은 목록과 정해진 항목은 FlashList를 쓰지 않는다.

## 사용법

```tsx
import { InfiniteList } from '@src/shared/ui';

// 옵션의 select: selectPageItems(shared/domains/cursor-page.model)가 쪽을 항목 목록으로 편다
const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError, refetch } =
  useSuspenseInfiniteQuery(options);
const [refreshing, onRefresh] = useRefresh(refetch);

<InfiniteList
  data={data}
  keyExtractor={({ id }) => id}
  renderItem={({ item }) => <Row item={item} />}
  ListEmptyComponent={Empty}
  hasNextPage={hasNextPage}
  isFetchingNextPage={isFetchingNextPage}
  isFetchNextPageError={isFetchNextPageError}
  fetchNextPage={fetchNextPage}
  refreshing={refreshing}
  onRefresh={onRefresh}
/>;
```

## Props

| Prop                                                  | 타입                                          | 설명                                                                       |
| ----------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------- |
| hasNextPage, isFetchingNextPage, isFetchNextPageError | `boolean`                                     | TanStack 원본 값을 그대로 넘긴다                                           |
| fetchNextPage                                         | `(options?: FetchNextPageOptions) => Promise` | TanStack 원본                                                              |
| ref                                                   | `Ref<FlashListRef<T>>`                        | 스크롤 이동처럼 FlashList 명령이 필요할 때 넘긴다                          |
| refreshing, onRefresh                                 | FlashList 원본                                | `onRefresh`가 있을 때만 당겨서 새로고침                                    |
| ...props                                              | `FlashListProps`                              | `onEndReached`, `refreshControl`, `ListFooterComponent`는 이 부품이 맡는다 |

## 동작

- 끝에 닿으면 `cancelRefetch: false`로 다음 페이지를 한 번만 부른다. 응답이 오기 전 연속 호출은 ref로 막는다.
- 하단: 받는 중이면 `Spinner`, 실패하면 그 자리에서 "다시 시도". 실패 뒤에는 자동 재호출하지 않는다.
- 요청 거부는 삼킨다(오류는 Query 상태로 보인다).

## 행을 만들 때

FlashList는 행 컴포넌트를 재활용하므로 행 안 `useState`·`useMutation` 상태가 다른 항목으로 넘어갈 수 있다.
항목 id를 `key`로 준 자식에 상태를 두거나 상태를 없앤다. 이미지는 `expo-image`의 `recyclingKey`를 쓴다.

## 파일 구조

```
infinite-list/
├── infinite-list.tsx
├── use-fetch-next-page.ts
├── use-fetch-next-page.test.ts
├── infinite-list-footer.test.tsx
├── infinite-list.md
└── index.ts
```
