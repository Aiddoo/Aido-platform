import type { FlashListProps } from '@shopify/flash-list';
import { useTrack } from '@src/shared/analytics';
import { formatDateKeyRange } from '@src/shared/date/date-format';
import { getYearOfDateKey } from '@src/shared/date/date-key';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  Box,
  HStack,
  InfiniteList,
  ListRow,
  QueryErrorActions,
  type QueryErrorFallbackProps,
  Result,
  Spacing,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { useQueryClient, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { router } from 'expo-router';
import { PressableFeedback, Skeleton } from 'heroui-native';

import { AchievementPolicy } from '../domains/achievement.model';
import { invalidateWeeklyAchievements } from '../queries/achievement-cache';
import { useGetWeeklyAchievementsInfiniteQueryOptions } from '../queries/achievement.queries';
import type { WeeklyAchievement } from '../schemas/achievement.schema';
import { BadgeIcon } from './badge-icon';

const LOADING_ROW_COUNT = 5;
const LIST_BOTTOM_SPACE = 32;

type WeeklyAchievementListProps = Pick<FlashListProps<WeeklyAchievement>, 'ListHeaderComponent'>;

export function WeeklyAchievementList({ ListHeaderComponent }: WeeklyAchievementListProps) {
  const year = getYearOfDateKey(useTodayKey());
  const queryClient = useQueryClient();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } =
    useSuspenseInfiniteQuery(useGetWeeklyAchievementsInfiniteQueryOptions({ year }));
  const [isRefreshing, handleRefresh] = useRefresh(() =>
    invalidateWeeklyAchievements(queryClient, { year }),
  );

  return (
    <InfiniteList
      data={data.items}
      keyExtractor={(item) => String(item.id)}
      contentContainerClassName="px-4"
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: data.items.length === 0 ? 'center' : 'flex-start',
        paddingBottom: LIST_BOTTOM_SPACE,
      }}
      ListHeaderComponent={ListHeaderComponent}
      renderItem={({ item }) => <WeeklyAchievementList.Item achievement={item} />}
      ListEmptyComponent={<WeeklyAchievementList.Empty />}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      isFetchNextPageError={isFetchNextPageError}
      fetchNextPage={fetchNextPage}
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
    />
  );
}

WeeklyAchievementList.Item = function Item({ achievement }: { achievement: WeeklyAchievement }) {
  const push = useSingleTap(router.push);
  const { t } = useTranslation('achievement');
  const { trackEvent } = useTrack();
  const dateFormatContext = useDateFormatContext();
  const badgeType = AchievementPolicy.getBadgeType(achievement);

  const handlePress = () => {
    trackEvent('badge_item_tapped', {
      badge_type: badgeType,
      completion_rate: achievement.completionRate,
      year: achievement.year,
      week: achievement.week,
    });
    push({
      pathname: '/achievements/[year]/[week]',
      params: { year: String(achievement.year), week: String(achievement.week) },
    });
  };

  return (
    <PressableFeedback onPress={handlePress}>
      <ListRow
        left={<BadgeIcon type={badgeType} size="small" />}
        contents={
          <ListRow.Texts
            type="twoLine"
            top={achievement.weekLabel}
            topProps={{ weight: 'semibold', shade: 8 }}
            bottom={t('list.periodWithCompletedRatio', {
              period: formatDateKeyRange(
                achievement.dateRange.startDate,
                achievement.dateRange.endDate,
                dateFormatContext,
              ),
              completed: achievement.completedTodos,
              total: achievement.totalTodos,
            })}
          />
        }
        right={
          <HStack align="center" gap={4}>
            <Text size="b3" className="text-main" weight="semibold">
              {achievement.completionRate}%
            </Text>
            <ArrowRightIcon width={16} height={16} colorClassName="text-gray-6" />
          </HStack>
        }
        verticalPadding="medium"
      />
    </PressableFeedback>
  );
};

WeeklyAchievementList.Empty = function Empty() {
  const { t } = useTranslation('achievement');

  return (
    <Box className="flex-1 justify-center">
      <Spacing size={32} />
      <Result title={t('list.emptyRecordTitle')} description={t('list.emptyRecordDescription')} />
    </Box>
  );
};

WeeklyAchievementList.Loading = function Loading() {
  return (
    <VStack>
      {range(LOADING_ROW_COUNT).map((index) => (
        <ListRow
          key={index}
          left={<Skeleton className="size-10 rounded-full" />}
          contents={<ListRow.Texts.Loading type="twoLine" />}
          right={<TextSkeleton size="b3" className="w-12" />}
          verticalPadding="medium"
        />
      ))}
    </VStack>
  );
};

WeeklyAchievementList.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('common');

  return (
    <VStack flex={1} p={24} justify="center">
      <Result title={t('errorBoundary.title')} button={<QueryErrorActions onRetry={reset} />} />
    </VStack>
  );
};
