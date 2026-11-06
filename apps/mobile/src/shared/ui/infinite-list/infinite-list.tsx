import { FlashList, type FlashListProps } from '@shopify/flash-list';
import { useTranslation } from '@src/shared/i18n';
import type { FetchNextPageOptions } from '@tanstack/react-query';
import { PressableFeedback, Spinner } from 'heroui-native';
import { RefreshControl } from 'react-native';
import { useResolveClassNames } from 'uniwind';

import { Flex } from '../flex';
import { HStack } from '../h-stack';
import { RefreshIcon } from '../icon';
import { Text } from '../text';
import { useFetchNextPage } from './use-fetch-next-page';

const END_REACHED_THRESHOLD = 0.5;

export interface InfiniteListProps<T> extends Omit<
  FlashListProps<T>,
  'onEndReached' | 'refreshControl' | 'ListFooterComponent'
> {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  fetchNextPage: (options?: FetchNextPageOptions) => Promise<unknown>;
}

export function InfiniteList<T>({
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  fetchNextPage,
  refreshing,
  onRefresh,
  ...props
}: InfiniteListProps<T>) {
  const { color: tint } = useResolveClassNames('text-main');
  const { fetchOnEndReached, retry } = useFetchNextPage({
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  });

  return (
    <FlashList
      {...props}
      ListFooterComponent={
        <InfiniteListFooter
          isFetchingNextPage={isFetchingNextPage}
          isFetchNextPageError={isFetchNextPageError}
          onRetry={retry}
        />
      }
      onEndReached={fetchOnEndReached}
      onEndReachedThreshold={END_REACHED_THRESHOLD}
      refreshControl={
        onRefresh == null ? undefined : (
          <RefreshControl
            refreshing={refreshing ?? false}
            onRefresh={onRefresh}
            tintColor={tint}
            colors={tint == null ? undefined : [tint]}
          />
        )
      }
    />
  );
}

function InfiniteListFooter({
  isFetchingNextPage,
  isFetchNextPageError,
  onRetry,
}: {
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation('common');

  if (isFetchNextPageError) {
    return (
      <Flex py={8} align="center">
        <PressableFeedback
          accessibilityRole="button"
          accessibilityLabel={t('infiniteList.loadMoreFailedLabel')}
          onPress={onRetry}
          className="min-h-11 justify-center px-4"
        >
          <HStack align="center" gap={6}>
            <RefreshIcon width={16} height={16} colorClassName="text-gray-6" />
            <Text size="b4" shade={6}>
              {t('infiniteList.loadMoreFailed')}
            </Text>
          </HStack>
        </PressableFeedback>
      </Flex>
    );
  }

  if (isFetchingNextPage) {
    return (
      <Flex py={16} align="center">
        <Spinner size="sm" />
      </Flex>
    );
  }

  return null;
}
