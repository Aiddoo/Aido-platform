import { FlashList, type FlashListProps } from '@shopify/flash-list';
import { UserAvatar } from '@src/features/user/components/user-avatar';
import { useTranslation } from '@src/shared/i18n';
import {
  Flex,
  ListRow,
  type ListRowProps,
  QueryErrorActions,
  type QueryErrorFallbackProps,
  Result,
} from '@src/shared/ui';
import type { FetchNextPageOptions } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { Skeleton } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { useResolveClassNames } from 'uniwind';

const contentContainerStyle = { flexGrow: 1 };

interface UserListProps<T> extends Omit<
  FlashListProps<T>,
  'onEndReached' | 'refreshControl' | 'contentContainerStyle'
> {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: (options?: FetchNextPageOptions) => Promise<unknown>;
}

export function UserList<T>({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  refreshing,
  onRefresh,
  ListFooterComponent,
  ...props
}: UserListProps<T>) {
  const { color: refreshTint } = useResolveClassNames('text-main');

  return (
    <FlashList
      {...props}
      ListFooterComponent={
        ListFooterComponent ??
        (isFetchingNextPage ? (
          <Flex py={16} align="center">
            <ActivityIndicator color={refreshTint} />
          </Flex>
        ) : null)
      }
      onEndReached={() => {
        if (hasNextPage) {
          return fetchNextPage({ cancelRefetch: false });
        }
      }}
      onEndReachedThreshold={0.5}
      refreshControl={
        onRefresh == null ? undefined : (
          <RefreshControl
            refreshing={refreshing ?? false}
            onRefresh={onRefresh}
            tintColor={refreshTint}
            colors={refreshTint == null ? undefined : [refreshTint]}
          />
        )
      }
      contentContainerStyle={contentContainerStyle}
    />
  );
}

interface UserListItemProps extends Omit<ListRowProps, 'left' | 'contents'> {
  displayName: string;
  subtitle?: string;
  profileImage: string | null;
}

UserList.Item = function Item({
  displayName,
  subtitle,
  profileImage,
  ...props
}: UserListItemProps) {
  return (
    <ListRow
      left={<UserAvatar alt={displayName} className="size-10" profileImage={profileImage} />}
      contents={
        subtitle == null ? (
          <ListRow.Texts type="1RowTypeA" top={displayName} topProps={{ maxLines: 1 }} />
        ) : (
          <ListRow.Texts
            type="2RowTypeA"
            top={displayName}
            topProps={{ maxLines: 1 }}
            bottom={subtitle}
            bottomProps={{ maxLines: 1 }}
          />
        )
      }
      {...props}
    />
  );
};

interface UserListLoadingProps {
  rows?: number;
  hasSubtitle?: boolean;
  right?: ReactNode;
  ListHeaderComponent?: ReactNode;
}

UserList.Loading = function Loading({
  rows = 3,
  hasSubtitle = false,
  right,
  ListHeaderComponent,
}: UserListLoadingProps) {
  return (
    <ScrollView className="flex-1" contentContainerStyle={contentContainerStyle}>
      {ListHeaderComponent}
      {times(rows, (index) => (
        <ListRow
          key={index}
          left={<Skeleton className="size-10 rounded-full" />}
          contents={<ListRow.Texts.Loading type={hasSubtitle ? '2RowTypeA' : '1RowTypeA'} />}
          right={right}
        />
      ))}
    </ScrollView>
  );
};

UserList.Error = function ErrorState({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation();
  return <Result title={t('errorBoundary.title')} button={<QueryErrorActions onRetry={reset} />} />;
};

UserList.Empty = function Empty(props: ComponentProps<typeof Result>) {
  return (
    <Flex flex={1} justify="center" align="center">
      <Result {...props} />
    </Flex>
  );
};
