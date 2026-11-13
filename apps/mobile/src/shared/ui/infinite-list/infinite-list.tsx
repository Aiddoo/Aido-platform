import { FlashList, type FlashListProps, type FlashListRef } from '@shopify/flash-list';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import type { FetchNextPageOptions } from '@tanstack/react-query';
import { PressableFeedback, Spinner } from 'heroui-native';
import type { Ref } from 'react';

import { HStack } from '../h-stack/h-stack';
import { RefreshIcon } from '../icon/icons';
import { Text } from '../text/text';
import { TintedRefreshControl } from '../tinted-refresh-control/tinted-refresh-control';
import { useFetchNextPage } from './use-fetch-next-page';

const RETRY_ICON_SIZE = 16;

const END_REACHED_THRESHOLD = 0.5;

export interface InfiniteListProps<T> extends Omit<
  FlashListProps<T>,
  'onEndReached' | 'onEndReachedThreshold' | 'refreshControl' | 'ListFooterComponent'
> {
  ref?: Ref<FlashListRef<T>>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  fetchNextPage: (options?: FetchNextPageOptions) => Promise<unknown>;
}

export function InfiniteList<T>({
  ref,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  fetchNextPage,
  refreshing,
  onRefresh,
  progressViewOffset,
  ...props
}: InfiniteListProps<T>) {
  const { fetchOnEndReached, retry } = useFetchNextPage({
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  });

  return (
    <FlashList
      {...props}
      ref={ref}
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
          <TintedRefreshControl
            refreshing={refreshing ?? false}
            onRefresh={onRefresh}
            progressViewOffset={progressViewOffset}
          />
        )
      }
    />
  );
}

export function InfiniteListFooter({
  isFetchingNextPage,
  isFetchNextPageError,
  onRetry,
}: {
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation('common');
  const fontScaledSize = useFontScaledSize();
  const retryIconSize = fontScaledSize(RETRY_ICON_SIZE);

  if (isFetchingNextPage) {
    return (
      <HStack py={16} align="center">
        <Spinner size="sm" />
      </HStack>
    );
  }

  if (isFetchNextPageError) {
    return (
      <HStack py={8} align="center">
        <PressableFeedback
          accessibilityRole="button"
          accessibilityLabel={t('infiniteList.loadMoreFailedLabel')}
          onPress={onRetry}
          className="min-h-11 justify-center px-4"
        >
          <HStack align="center" gap={6}>
            <RefreshIcon
              width={retryIconSize}
              height={retryIconSize}
              colorClassName="text-gray-6"
            />
            <Text size="b4" shade={6}>
              {t('infiniteList.loadMoreFailed')}
            </Text>
          </HStack>
        </PressableFeedback>
      </HStack>
    );
  }

  return null;
}
