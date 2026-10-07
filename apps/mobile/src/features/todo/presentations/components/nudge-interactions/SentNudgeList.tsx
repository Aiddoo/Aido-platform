import { ErrorCode } from '@aido/api/errors';
import { FlashList } from '@shopify/flash-list';
import { getProfileIconSource } from '@src/features/user/presentations/utils/profile-icon.util';
import { isApiError } from '@src/shared/errors';
import { useRefresh } from '@src/shared/hooks/useRefresh';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import {
  Avatar,
  Box,
  Button,
  HStack,
  ListRow,
  PawIcon,
  Result,
  Text,
  VStack,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { formatRelativeTime } from '@src/shared/utils/date';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { PressableFeedback, Separator, Skeleton, Spinner } from 'heroui-native';
import { RefreshControl, ScrollView } from 'react-native';
import { match } from 'ts-pattern';

import {
  NudgeInteractionPolicy,
  type NudgeInteraction,
} from '../../../models/nudge-interaction.model';
import { useGetNudgeInteractionsInfiniteQueryOptions } from '../../queries/get-nudge-interactions-infinite-query-options';
import { getNudgeReplyLabelKey } from '../../utils/nudge-reply-label';

export function SentNudgeList() {
  const { t } = useTranslation('common');
  const query = useSuspenseInfiniteQuery(useGetNudgeInteractionsInfiniteQueryOptions('sent'));
  const [isRefreshing, handleRefresh] = useRefresh(query.refetch);

  const refreshControl = <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />;

  if (query.data.length === 0) {
    return (
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={refreshControl}
      >
        <SentNudgeList.Empty />
      </ScrollView>
    );
  }

  return (
    <FlashList
      data={query.data}
      renderItem={({ item }) => <SentNudgeList.Item nudge={item} />}
      keyExtractor={(nudge) => String(nudge.id)}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
      refreshControl={refreshControl}
      ListFooterComponent={
        query.isFetchNextPageError ? (
          <Box p={16}>
            <Button variant="weak" onPress={() => void query.fetchNextPage()}>
              {t('actions.retry')}
            </Button>
          </Box>
        ) : query.isFetchingNextPage ? (
          <Box py={16}>
            <Spinner />
          </Box>
        ) : null
      }
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError) {
          void query.fetchNextPage({ cancelRefetch: false });
        }
      }}
      ItemSeparatorComponent={() => <Separator className="mx-4" />}
      onEndReachedThreshold={0.5}
    />
  );
}

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
      nudge.replyKind === null
        ? ''
        : t('interaction.replyStatus', {
            reply: t(getNudgeReplyLabelKey(nudge.replyKind)),
          }),
    )
    .with('WAITING', () => t('interaction.waiting'))
    .exhaustive();

  return (
    <PressableFeedback onPress={openDetail}>
      <ListRow
        horizontalPadding="medium"
        verticalPadding="large"
        left={
          <Avatar alt={nudge.receiverName} className="size-11">
            <Avatar.Image source={getProfileIconSource(nudge.receiverProfileImage)} />
          </Avatar>
        }
        contents={
          <VStack gap={6}>
            <HStack justify="between" align="center">
              <Text size="b4" shade={5} maxLines={1} className="shrink">
                {nudge.receiverName}
              </Text>
              <Text size="e1" shade={5}>
                {formatRelativeTime(nudge.createdAt)}
              </Text>
            </HStack>
            <Text size="b3" weight="semibold" maxLines={2}>
              {nudge.todoTitle ?? t('interaction.unavailableTodo')}
            </Text>
            {nudge.message && (
              <Text size="b4" shade={6} maxLines={2}>
                {nudge.message}
              </Text>
            )}
            <Text
              size="e1"
              tone={nudge.isAvailable ? 'brand' : 'neutral'}
              shade={nudge.isAvailable ? undefined : 5}
            >
              {nudge.isAvailable ? status : t('interaction.unavailable')}
            </Text>
          </VStack>
        }
      />
    </PressableFeedback>
  );
};

SentNudgeList.Empty = function Empty() {
  const { t } = useTranslation('todo');
  return (
    <VStack flex={1} px={24} py={40}>
      <Result
        icon={<PawIcon width={64} height={64} colorClassName="text-main" />}
        title={t('interaction.sentEmptyTitle')}
        description={t('interaction.emptyDescription')}
      />
    </VStack>
  );
};

SentNudgeList.Error = function ErrorState({ error, reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['todo', 'common']);
  const isDisabled = isApiError(error) && error.hasCode(ErrorCode.NUDGE_1105);
  return (
    <VStack flex={1} px={24} py={32}>
      <Result
        title={t(isDisabled ? 'todo:interaction.disabledTitle' : 'todo:interaction.loadError')}
        description={isDisabled ? t('todo:interaction.disabledDescription') : undefined}
        button={<Result.Button onPress={reset}>{t('common:actions.retry')}</Result.Button>}
      />
    </VStack>
  );
};

SentNudgeList.Loading = function Loading() {
  return (
    <VStack p={24} gap={24} flex={1}>
      {Array.from({ length: 4 }, (_, index) => (
        <HStack key={index} gap={12}>
          <Skeleton className="size-11 rounded-full" />
          <VStack flex={1} gap={8}>
            <Skeleton className="w-24 h-4 rounded" />
            <Skeleton className="w-full h-5 rounded" />
            <Skeleton className="w-1/2 h-3 rounded" />
          </VStack>
        </HStack>
      ))}
    </VStack>
  );
};
