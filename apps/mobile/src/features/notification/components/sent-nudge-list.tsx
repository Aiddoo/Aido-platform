import { NUDGE_REPLY_LABEL_KEYS } from '@src/features/social/nudge/constants/nudge-interaction-labels';
import { NudgeInteractionPolicy } from '@src/features/social/nudge/domains/nudge-interaction.model';
import type { NudgeInteraction } from '@src/features/social/nudge/domains/nudge-interaction.model';
import { isSentNudgeListDisabledError } from '@src/features/social/nudge/domains/todo-nudge.error';
import { useGetNudgeInteractionsInfiniteQueryOptions } from '@src/features/social/nudge/queries/todo-nudge.queries';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import {
  InfiniteList,
  NotificationIllustration,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Result,
  VStack,
} from '@src/shared/ui';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { type Href, router } from 'expo-router';
import { Separator } from 'heroui-native';
import { match } from 'ts-pattern';

import { toDateSectionedListItems } from '../utils/date-section';
import { NotificationList } from './notification-list';
import { NotificationListRow } from './notification-list-row';

export function SentNudgeList() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError, refetch } =
    useSuspenseInfiniteQuery(useGetNudgeInteractionsInfiniteQueryOptions({ direction: 'sent' }));
  const { currentLocalDateKey, currentTimeZone } = useLocalDate();
  const listItems = toDateSectionedListItems(data, currentLocalDateKey, currentTimeZone);
  const [isRefreshing, handleRefresh] = useRefresh(refetch);
  // 알림 행과 같이 좁은 화면에서만 길게 눌러 미리본다
  const hasPreview = useWindowSizeClass() === 'compact';

  return (
    <InfiniteList
      data={listItems}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      isFetchNextPageError={isFetchNextPageError}
      fetchNextPage={fetchNextPage}
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      renderItem={({ item }) =>
        match(item)
          .with({ type: 'header' }, ({ section }) => (
            <NotificationList.SectionHeader section={section} />
          ))
          .with({ type: 'item' }, ({ entry }) => (
            <SentNudgeList.Item nudge={entry} hasPreview={hasPreview} />
          ))
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

SentNudgeList.Item = function Item({
  nudge,
  hasPreview,
}: {
  nudge: NudgeInteraction;
  hasPreview: boolean;
}) {
  const { t } = useTranslation('todo');
  const detailHref: Href = { pathname: '/nudges/[nudgeId]', params: { nudgeId: nudge.id } };
  const openDetail = useSingleTap(() => router.navigate(detailHref));
  const status = match(NudgeInteractionPolicy.getNudgeInteractionStatus(nudge))
    .with('UNAVAILABLE', () => t('interaction.unavailable'))
    .with('THANKED', () => t('interaction.thanked'))
    .with('COMPLETED', () => t('interaction.completed'))
    .with('REPLIED', () =>
      nudge.replyKind == null
        ? ''
        : t('interaction.replyStatus', { reply: t(NUDGE_REPLY_LABEL_KEYS[nudge.replyKind]) }),
    )
    .with('WAITING', () => t('interaction.waiting'))
    .exhaustive();

  return (
    <NotificationListRow.Link href={hasPreview ? detailHref : null}>
      <NotificationListRow
        label={nudge.receiverName}
        title={nudge.todoTitle ?? t('interaction.unavailableTodo')}
        body={status}
        createdAt={nudge.createdAt}
        onPress={openDetail}
      />
    </NotificationListRow.Link>
  );
};

SentNudgeList.Loading = NotificationList.Loading;

SentNudgeList.Error = function ErrorFallback({ error, reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['notification', 'common']);
  const isListDisabled = isSentNudgeListDisabledError(error);

  return (
    <VStack flex={1} p={24}>
      <QueryErrorFallback
        title={t(
          isListDisabled ? 'notification:sentNudges.disabled' : 'notification:sentNudges.loadError',
        )}
        reset={reset}
      />
    </VStack>
  );
};

SentNudgeList.Empty = function Empty() {
  const { t } = useTranslation('notification');

  return (
    <VStack flex={1} p={24}>
      <Result icon={<NotificationIllustration />} title={t('sentNudges.empty')} />
    </VStack>
  );
};
