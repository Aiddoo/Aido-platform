import { FlashList } from '@shopify/flash-list';
import { getProfileIconSource } from '@src/features/user/presentations/utils/profile-icon.util';
import { Flex, VStack, HStack, ListRow } from '@src/shared/ui';
import { times } from 'es-toolkit/compat';
import { Avatar, Skeleton } from 'heroui-native';
import { type ReactElement, type ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { useResolveClassNames } from 'uniwind';

interface UserListRefresh {
  isRefreshing: boolean;
  onRefresh: () => void;
}

interface UserListProps<T> {
  data: T[];
  renderItem: (item: T) => ReactElement;
  keyExtractor: (item: T) => string;
  emptyContent: ReactNode;
  header?: ReactElement;
  footer?: ReactElement;
  hasNextPage: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  onEndReached: () => void;
  refresh?: UserListRefresh;
}

export function UserList<T>({
  data,
  renderItem,
  keyExtractor,
  emptyContent,
  header,
  footer,
  hasNextPage,
  isFetching,
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
        footer ??
        (isFetchingNextPage ? (
          <Flex py={16} align="center">
            <ActivityIndicator color={refreshTint} />
          </Flex>
        ) : null)
      }
      onEndReached={() => {
        if (hasNextPage && !isFetching) {
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
      contentContainerStyle={{ flexGrow: 1 }}
    />
  );
}

interface UserListLoadingProps {
  header?: ReactNode;
  rows?: number;
  hasAction?: boolean;
}

UserList.Loading = function Loading({ header, rows = 3, hasAction = true }: UserListLoadingProps) {
  return (
    <ScrollView className="flex-1">
      {header}
      <VStack>
        {times(rows, (index) => (
          <UserList.ItemLoading key={index} hasAction={hasAction} />
        ))}
      </VStack>
    </ScrollView>
  );
};

interface UserListItemProps {
  displayName: string;
  subtitle?: string;
  profileImage: string | null;
  action?: ReactNode;
}

UserList.Item = function Item({ displayName, subtitle, profileImage, action }: UserListItemProps) {
  return (
    <ListRow
      horizontalPadding="none"
      left={
        <Avatar alt={displayName} className="size-10">
          <Avatar.Image source={getProfileIconSource(profileImage)} />
        </Avatar>
      }
      contents={
        subtitle != null ? (
          <ListRow.Texts
            type="2RowTypeA"
            top={displayName}
            topProps={{ maxLines: 1 }}
            bottom={subtitle}
            bottomProps={{ maxLines: 1 }}
          />
        ) : (
          <ListRow.Texts type="1RowTypeA" top={displayName} topProps={{ maxLines: 1 }} />
        )
      }
      right={action}
    />
  );
};

interface UserListItemLoadingProps {
  hasAction?: boolean;
}

UserList.ItemLoading = function Loading({ hasAction = true }: UserListItemLoadingProps) {
  return (
    <HStack align="center" className="py-2" gap={12}>
      <Skeleton className="w-10 h-10 rounded-full" />
      <Skeleton className="flex-1 h-5" />
      {hasAction ? <Skeleton className="w-12 h-8 rounded" /> : null}
    </HStack>
  );
};
