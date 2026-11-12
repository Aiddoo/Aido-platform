import { NUDGE_REPLY_LABEL_KEYS } from '@src/features/social/nudge/constants/nudge-interaction-labels';
import { NudgeInteractionPolicy } from '@src/features/social/nudge/domains/nudge-interaction.model';
import type { NudgeInteraction } from '@src/features/social/nudge/domains/nudge-interaction.model';
import { isNudgeUnavailableError } from '@src/features/social/nudge/domains/todo-nudge.error';
import { refreshNudges } from '@src/features/social/nudge/queries/todo-nudge-cache';
import { useGetNudgeInteractionsInfiniteQueryOptions } from '@src/features/social/nudge/queries/todo-nudge.queries';
import { selectPageItems } from '@src/shared/domains/cursor-page.model';
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
import { useQueryClient, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { type Href, router } from 'expo-router';
import { Separator } from 'heroui-native';
import { match } from 'ts-pattern';

import { toDateSectionedListItems } from '../utils/notification-section.view-model';
import { NotificationList } from './notification-list';
import { NotificationListRow } from './notification-list-row';

export function SentNudgeList() {
  const { currentLocalDateKey, currentTimeZone } = useLocalDate();
  const {
    data: listItems,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useSuspenseInfiniteQuery({
    ...useGetNudgeInteractionsInfiniteQueryOptions({ direction: 'sent' }),
    // 날짜가 바뀌면 다시 받지 않고 구역만 다시 나눈다
    select: (infinitePages) =>
      toDateSectionedListItems(
        selectPageItems(infinitePages),
        currentLocalDateKey,
        currentTimeZone,
      ),
  });
  const queryClient = useQueryClient();
  const [isRefreshing, handleRefresh] = useRefresh(() => refreshNudges(queryClient));
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
  // 목록 API의 NUDGE_1105·1111은 꺼짐 뜻뿐이다. 1105도 받아 1.15.2 서버가 먼저 나가지 않았거나 되돌려져도 꺼진 상태로 보인다.
  // 1105 수용은 서버 롤백 바닥이 1.15.2가 된 뒤 1.16.0에서 지운다(compatibility.md)
  const isListDisabled = isNudgeUnavailableError(error);

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
