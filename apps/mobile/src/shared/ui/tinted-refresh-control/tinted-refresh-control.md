# TintedRefreshControl

당겨서 새로고침 표시를 앱 주황(`text-main`)으로 칠한 React Native `RefreshControl`이다. 기본 회색·파랑 대신 테마 색을 쓰려고 둔다. `InfiniteList`가 안에서 쓰고, `FlashList`를 직접 그리는 목록은 이것을 `refreshControl`에 넣는다.

## 사용법

```tsx
// features/social/friend/components/friend-list.tsx
const [isRefreshing, handleRefresh] = useRefresh(() => refreshFriends(queryClient));

<FlashList
  refreshControl={<TintedRefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
/>;
```

## Props

원본 `RefreshControl` Props 그대로다. 더한 prop은 없다.

## 동작

- 색은 `useResolveClassNames('text-main')`로 읽어 iOS `tintColor`와 Android `colors`에 함께 준다. 테마가 바뀌면 따라 바뀐다.
- 넘긴 `tintColor`·`colors`가 있으면 그것이 이긴다(`...props`가 뒤에 펼쳐진다).
- 당긴 동안만 표시하는 것은 `useRefresh`가 맡는다([data §무효화](../../../../docs/architecture/data.md#무효화)).
