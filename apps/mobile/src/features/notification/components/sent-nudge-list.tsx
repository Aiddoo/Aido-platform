import { ErrorCode } from '@aido/api/errors';
import { NudgeInteractionPolicy } from '@src/features/social/nudge/domains/nudge-interaction.model';
import { useGetNudgeInteractionsInfiniteQueryOptions } from '@src/features/social/nudge/queries/nudge.queries';
import type { NudgeInteraction } from '@src/features/social/nudge/schemas/nudge-interaction.schema';
import { getNudgeReplyLabelKey } from '@src/features/social/nudge/utils/nudge-reply-label';
import { isApiError } from '@src/shared/errors';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import {
  InfiniteList,
  NotiIcon,
  QueryErrorActions,
  Result,
  VStack,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Separator } from 'heroui-native';
import { match } from 'ts-pattern';

import { toDateSectionedListItems } from '../utils/date-section';
import { NotificationListRow } from './notification-list-row';

export function SentNudgeList() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError, refetch } =
    useSuspenseInfiniteQuery(useGetNudgeInteractionsInfiniteQueryOptions({ direction: 'sent' }));
  const { currentLocalDateKey, currentTimeZone } = useLocalDate();
  const listItems = toDateSectionedListItems(data, currentLocalDateKey, currentTimeZone);
  const [refreshing, onRefresh] = useRefresh(refetch);

  return (
    <InfiniteList
      data={listItems}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      isFetchNextPageError={isFetchNextPageError}
      fetchNextPage={fetchNextPage}
      refreshing={refreshing}
      onRefresh={onRefresh}
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
      ListEmptyComponent={<SentNudgeList.Empty />}
      ItemSeparatorComponent={() => <Separator className="mx-4" />}
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
        button={<QueryErrorActions onRetry={reset} />}
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
  const status = match(NudgeInteractionPolicy.getNudgeInteractionStatus(nudge))
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
