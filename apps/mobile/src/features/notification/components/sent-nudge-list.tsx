import { ErrorCode } from '@aido/api/errors';
import { FlashList } from '@shopify/flash-list';
import {
  NudgeInteractionPolicy,
  type NudgeInteraction,
} from '@src/features/nudge/domains/nudge-interaction.model';
import { useGetNudgeInteractionsInfiniteQueryOptions } from '@src/features/nudge/queries/get-nudge-interactions-infinite-query-options';
import { getNudgeReplyLabelKey } from '@src/features/nudge/utils/nudge-reply-label';
import { isApiError } from '@src/shared/errors';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import {
  Box,
  Button,
  NotiIcon,
  Result,
  VStack,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Separator, Spinner } from 'heroui-native';
import { RefreshControl } from 'react-native';
import { match } from 'ts-pattern';
import { useResolveClassNames } from 'uniwind';

import { toDateSectionedListItems } from '../utils/view-models/notification-list.view-model';
import { NotificationListRow } from './notification-list-row';

export function SentNudgeList() {
  const { t } = useTranslation('common');
  const query = useSuspenseInfiniteQuery(
    useGetNudgeInteractionsInfiniteQueryOptions({ direction: 'sent' }),
  );
  const { currentLocalDateKey, currentTimeZone } = useLocalDate();
  const listItems = toDateSectionedListItems(query.data, currentLocalDateKey, currentTimeZone);
  const [isRefreshing, handleRefresh] = useRefresh(query.refetch);
  const { color: refreshTint } = useResolveClassNames('text-main');

  return (
    <FlashList
      data={listItems}
      renderItem={({ item }) =>
        match(item)
          .with({ type: 'header' }, ({ section }) => (
            <NotificationListRow.SectionHeader section={section} />
          ))
          .with({ type: 'item' }, ({ entry }) => <SentNudgeList.Item nudge={entry} />)
          .exhaustive()
      }
      getItemType={(item) => item.type}
      keyExtractor={(item) =>
        match(item)
          .with({ type: 'header' }, ({ section }) => `header-${section}`)
          .with({ type: 'item' }, ({ entry }) => String(entry.id))
          .exhaustive()
      }
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={refreshTint}
          colors={refreshTint == null ? undefined : [refreshTint]}
        />
      }
      ListEmptyComponent={<SentNudgeList.Empty />}
      ListFooterComponent={match({
        isFetchNextPageError: query.isFetchNextPageError,
        isFetchingNextPage: query.isFetchingNextPage,
      })
        .with({ isFetchNextPageError: true }, () => (
          <Box p={16}>
            <Button variant="weak" onPress={() => query.fetchNextPage()}>
              {t('actions.retry')}
            </Button>
          </Box>
        ))
        .with({ isFetchingNextPage: true }, () => (
          <Box py={24}>
            <Spinner size="lg" />
          </Box>
        ))
        .with({ isFetchNextPageError: false, isFetchingNextPage: false }, () => null)
        .exhaustive()}
      ItemSeparatorComponent={() => <Separator className="mx-4" />}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError) {
          return query.fetchNextPage({ cancelRefetch: false });
        }
      }}
      onEndReachedThreshold={0.5}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
    />
  );
}

SentNudgeList.Loading = NotificationListRow.Loading;

SentNudgeList.Error = function ErrorState({ error, reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['notification', 'common']);
  const isDisabled = isApiError(error) && error.hasCode(ErrorCode.NUDGE_1105);
  return (
    <VStack flex={1} p={24}>
      <Result
        title={t(
          isDisabled ? 'notification:sentNudges.disabled' : 'notification:sentNudges.loadError',
        )}
        button={<Result.Button onPress={reset}>{t('common:actions.retry')}</Result.Button>}
      />
    </VStack>
  );
};

SentNudgeList.Empty = function Empty() {
  const { t } = useTranslation('notification');
  return (
    <VStack flex={1} p={24}>
      <Result icon={<NotiIcon width={72} height={72} />} title={t('sentNudges.empty')} />
    </VStack>
  );
};

SentNudgeList.Item = function Item({ nudge }: { nudge: NudgeInteraction }) {
  const { t } = useTranslation('todo');
  const openDetail = useSingleTap(() =>
    router.navigate({ pathname: '/nudges/[nudgeId]', params: { nudgeId: nudge.id } }),
  );
  const status = match(NudgeInteractionPolicy.getStatus(nudge))
    .with('UNAVAILABLE', () => t('interaction.unavailable'))
    .with('THANKED', () => t('interaction.thanked'))
    .with('COMPLETED', () => t('interaction.completed'))
    .with('REPLIED', () =>
      nudge.replyKind == null
        ? ''
        : t('interaction.replyStatus', { reply: t(getNudgeReplyLabelKey(nudge.replyKind)) }),
    )
    .with('WAITING', () => t('interaction.waiting'))
    .exhaustive();

  return (
    <NotificationListRow
      label={nudge.receiverName}
      title={nudge.todoTitle ?? t('interaction.unavailableTodo')}
      body={status}
      createdAt={nudge.createdAt}
      onPress={openDetail}
    />
  );
};
