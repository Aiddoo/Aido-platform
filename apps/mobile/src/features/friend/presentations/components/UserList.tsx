import { FlashList } from '@shopify/flash-list';
import { Flex, VStack } from '@src/shared/ui';
import { times } from 'es-toolkit/compat';
import type { ReactElement, ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { useResolveClassNames } from 'uniwind';
import { UserListRow } from './UserListRow';

interface UserListRefresh {
  isRefreshing: boolean;
  onRefresh: () => void;
}

interface UserListProps<T> {
  data: T[];
  renderItem: (item: T) => ReactElement;
  keyExtractor: (item: T) => string;
  /** 결과가 없을 때 표시 (중앙 정렬됨) */
  emptyContent: ReactNode;
  header?: ReactElement;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onEndReached: () => void;
  /** pull-to-refresh (선택) */
  refresh?: UserListRefresh;
}

/**
 * 사용자 리스트 공용 스캐폴드.
 * FlashList 기반의 빈 상태/무한스크롤 푸터/pull-to-refresh 보일러플레이트를 흡수한다.
 * 행은 `UserList.Item`(= UserListRow), 로딩은 `UserList.Loading`을 사용한다.
 * 메모리 안전을 위해 FlashList를 사용하며, 색상은 테마 변수로 다크/라이트에 대응한다.
 */
export function UserList<T>({
  data,
  renderItem,
  keyExtractor,
  emptyContent,
  header,
  hasNextPage,
  isFetchingNextPage,
  onEndReached,
  refresh,
}: UserListProps<T>) {
  const { color: refreshTint } = useResolveClassNames('text-main');

  return (
    <FlashList
      ListHeaderComponent={header}
      data={data}
      renderItem={({ item }) => renderItem(item)}
      keyExtractor={keyExtractor}
      ListEmptyComponent={
        <Flex flex={1} justify="center" align="center">
          {emptyContent}
        </Flex>
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <Flex py={16} align="center">
            <ActivityIndicator color={refreshTint} />
          </Flex>
        ) : null
      }
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) {
          onEndReached();
        }
      }}
      onEndReachedThreshold={0.5}
      refreshControl={
        refresh != null ? (
          <RefreshControl
            refreshing={refresh.isRefreshing}
            onRefresh={refresh.onRefresh}
            tintColor={refreshTint}
            colors={refreshTint != null ? [refreshTint] : undefined}
          />
        ) : undefined
      }
      contentContainerStyle={{ paddingHorizontal: 16, flexGrow: 1 }}
    />
  );
}

UserList.Item = UserListRow;

interface UserListLoadingProps {
  header?: ReactNode;
  rows?: number;
  hasAction?: boolean;
}

UserList.Loading = function Loading({ header, rows = 3, hasAction = true }: UserListLoadingProps) {
  return (
    <ScrollView className="flex-1 px-4">
      {header}
      <VStack>
        {times(rows, (index) => (
          <UserListRow.Loading key={index} hasAction={hasAction} />
        ))}
      </VStack>
    </ScrollView>
  );
};
