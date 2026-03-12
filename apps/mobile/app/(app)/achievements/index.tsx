import { FlashList } from '@shopify/flash-list';
import { AchievementSummaryCard } from '@src/features/achievement/presentations/components/AchievementSummaryCard';
import { BadgeIcon } from '@src/features/achievement/presentations/components/BadgeIcon';
import { CertificateBorder } from '@src/features/achievement/presentations/components/CertificateBorder';
import { ACHIEVEMENT_QUERY_KEYS } from '@src/features/achievement/presentations/constants/achievement-query-keys.constant';
import { useGetWeeklyAchievementsQueryOptions } from '@src/features/achievement/presentations/queries/use-get-weekly-achievements-query-options';
import type { WeeklyAchievementViewModel } from '@src/features/achievement/presentations/view-models/weekly-achievement.view-model';
import { useTrack } from '@src/shared/analytics';
import {
  ArrowRightIcon,
  Button,
  H3,
  HStack,
  ListRow,
  QueryErrorBoundary,
  Result,
  Spacing,
  StyledSafeAreaView,
  Text,
  VStack,
} from '@src/shared/ui';
import { useQueryClient, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Suspense, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, View } from 'react-native';

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
        <View className="flex-1 justify-center">
          <EmptyAchievementCard
            onPress={() => {
              trackEvent('badge_empty_cta_tapped');
              router.push('/feed');
            }}
          />
        </View>
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

function EmptyAchievementCard({ onPress }: { onPress: () => void }) {
  return (
    <View>
      <View className="bg-white rounded-sm overflow-hidden p-3">
        <CertificateBorder>
          <View className="px-5 pt-7 pb-5">
            <VStack align="center" gap={4}>
              <Text size="e1" tone="brand" className="tracking-widest">
                WEEKLY BADGE
              </Text>
              <H3 className="tracking-wider">주간 달성 배지</H3>
            </VStack>

            <Spacing size={12} />

            <Text tone="brand" align="center">
              {'── ✦ ──'}
            </Text>

            <Spacing size={16} />

            <VStack align="center">
              <Image
                source={require('@assets/images/badge_empty.webp')}
                style={{ width: 80, height: 80 }}
                resizeMode="contain"
              />
            </VStack>

            <Spacing size={16} />

            <Text
              size="b3"
              shade={7}
              align="center"
              weight="medium"
              lineBreakStrategyIOS="hangul-word"
              textBreakStrategy="highQuality"
            >
              {'이번 주 할 일을 완료하면\n첫 번째 배지가 여기에 나타나요'}
            </Text>

            <Spacing size={20} />

            <View className="border-b border-dashed border-gray-3" />

            <Spacing size={14} />

            <Button size="medium" variant="weak" display="block" onPress={onPress}>
              지금 시작하기
            </Button>
          </View>
        </CertificateBorder>
      </View>

      <Spacing size={24} />

      <View className="px-1">
        <Text size="b2" shade={8} weight="bold">
          기록
        </Text>
      </View>

      <Spacing size={32} />

      <Result
        title="배지를 모으면 기록이 쌓여요"
        description="매주 완료한 할 일이 여기에 기록돼요"
      />
    </View>
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
