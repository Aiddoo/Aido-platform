import { FlashList } from '@shopify/flash-list';
import { AchievementSummaryCard } from '@src/features/achievement/presentations/components/AchievementSummaryCard';
import { BadgeIcon } from '@src/features/achievement/presentations/components/BadgeIcon';
import { ACHIEVEMENT_QUERY_KEYS } from '@src/features/achievement/presentations/constants/achievement-query-keys.constant';
import { useGetWeeklyAchievementsQueryOptions } from '@src/features/achievement/presentations/queries/use-get-weekly-achievements-query-options';
import type { WeeklyAchievementViewModel } from '@src/features/achievement/presentations/view-models/weekly-achievement.view-model';
import { useTrack } from '@src/shared/analytics';
import {
  ArrowRightIcon,
  Flex,
  HStack,
  ListRow,
  QueryErrorBoundary,
  Result,
  Spacing,
  StyledSafeAreaView,
  Text,
} from '@src/shared/ui';
import { useQueryClient, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Suspense, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, View } from 'react-native';

const CURRENT_YEAR = new Date().getFullYear();

const AchievementsScreen = () => {
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <QueryErrorBoundary>
        <Suspense
          fallback={
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator />
            </View>
          }
        >
          <AchievementsContent year={CURRENT_YEAR} />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
};

export default AchievementsScreen;

interface AchievementsContentProps {
  year: number;
}

function AchievementsContent({ year }: AchievementsContentProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const queryOptions = useGetWeeklyAchievementsQueryOptions(year);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSuspenseInfiniteQuery(queryOptions);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ACHIEVEMENT_QUERY_KEYS.weeklyList(year) });
    setRefreshing(false);
  }, [queryClient, year]);

  const allItems = useMemo(() => data.pages.flatMap((page) => page.items), [data.pages]);

  const summary = data.pages[0]?.summary;
  const latest = allItems[0];

  return (
    <FlashList
      data={allItems}
      keyExtractor={(item) => String(item.id)}
      contentContainerClassName="px-4"
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={
        allItems.length > 0 ? (
          <>
            <Spacing size={16} />
            {latest && summary && <AchievementSummaryCard latest={latest} summary={summary} />}
            <Spacing size={24} />
            <View className="px-1 pb-2">
              <Text size="b2" shade={8} weight="bold">
                기록
              </Text>
            </View>
          </>
        ) : null
      }
      renderItem={({ item }) => <WeeklyBadgeListItem achievement={item} />}
      ListEmptyComponent={
        <Flex flex={1} justify="center" align="center">
          <Result
            title="아직 획득한 배지가 없어요"
            description={'할 일을 완료하고\n첫 배지를 모아보세요'}
            button={
              <Result.Button
                onPress={() => {
                  trackEvent('badge_empty_cta_tapped');
                  router.push('/feed');
                }}
              >
                지금 시작하기
              </Result.Button>
            }
          />
        </Flex>
      }
      ListFooterComponent={
        <>
          {isFetchingNextPage && (
            <View className="py-4 items-center">
              <ActivityIndicator />
            </View>
          )}
          <Spacing size={32} />
        </>
      }
    />
  );
}

function WeeklyBadgeListItem({ achievement }: { achievement: WeeklyAchievementViewModel }) {
  const router = useRouter();
  const { trackEvent } = useTrack();

  const handlePress = () => {
    trackEvent('badge_item_tapped', {
      badge_type: achievement.badgeType,
      completion_rate: achievement.completionRate,
      year: achievement.year,
      week: achievement.week,
    });
    router.push({
      pathname: '/achievements/[year]/[week]',
      params: { year: String(achievement.year), week: String(achievement.week) },
    });
  };

  return (
    <Pressable onPress={handlePress}>
      <ListRow
        left={<BadgeIcon type={achievement.badgeType} size="small" />}
        contents={
          <ListRow.Texts
            type="2RowTypeA"
            top={achievement.weekLabel}
            topProps={{ weight: 'semibold', shade: 8 }}
            bottom={`${achievement.completedTodos}/${achievement.totalTodos} 완료`}
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
    </Pressable>
  );
}
