import { FlashList } from '@shopify/flash-list';
import { AchievementSummaryCard } from '@src/features/achievement/components/achievement-summary-card';
import { BadgeIcon } from '@src/features/achievement/components/badge-icon';
import { CertificateBorder } from '@src/features/achievement/components/certificate-border';
import { ACHIEVEMENT_QUERY_KEYS } from '@src/features/achievement/constants/achievement-query-keys';
import { useGetWeeklyAchievementsInfiniteQueryOptions } from '@src/features/achievement/queries/get-weekly-achievements-infinite-query-options';
import type { WeeklyAchievementViewModel } from '@src/features/achievement/utils/view-models/weekly-achievement.view-model';
import { useTrack } from '@src/shared/analytics';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useToday } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
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
import { router } from 'expo-router';
import { Suspense, useMemo } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, View } from 'react-native';

function AchievementsScreen() {
  const today = useToday();
  const year = today.getFullYear();
  const push = useSingleTap(router.push);

  const { t } = useTranslation('achievement');
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } =
    useSuspenseInfiniteQuery(useGetWeeklyAchievementsInfiniteQueryOptions({ year }));

  const [refreshing, onRefresh] = useRefresh(() =>
    queryClient.invalidateQueries({ queryKey: ACHIEVEMENT_QUERY_KEYS.weeklyList({ year }) }),
  );

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
        if (hasNextPage && !isFetching) {
          return fetchNextPage({ cancelRefetch: false });
        }
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
                {t('list.sectionTitle')}
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
              push('/feed');
            }}
          />
          <Spacing size={24} />

          <View className="px-1">
            <Text size="b2" shade={8} weight="bold">
              {t('list.sectionTitle')}
            </Text>
          </View>

          <Spacing size={32} />

          <Result
            title={t('list.emptyRecordTitle')}
            description={t('list.emptyRecordDescription')}
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
  const { t } = useTranslation('achievement');
  return (
    <View>
      <View className="bg-white rounded-sm overflow-hidden p-3">
        <CertificateBorder>
          <View className="px-5 pt-7 pb-5">
            <VStack align="center" gap={4}>
              <Text size="e1" tone="brand" className="tracking-widest">
                WEEKLY BADGE
              </Text>
              <H3 className="tracking-wider">{t('card.title')}</H3>
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
              {t('list.emptyTitle')}
            </Text>

            <Spacing size={20} />

            <View className="border-b border-dashed border-gray-3" />

            <Spacing size={14} />

            <Button size="medium" variant="weak" display="block" onPress={onPress}>
              {t('list.startNow')}
            </Button>
          </View>
        </CertificateBorder>
      </View>
    </View>
  );
}

function WeeklyBadgeListItem({ achievement }: { achievement: WeeklyAchievementViewModel }) {
  const push = useSingleTap(router.push);

  const { t } = useTranslation('achievement');
  const { trackEvent } = useTrack();

  const handlePress = () => {
    trackEvent('badge_item_tapped', {
      badge_type: achievement.badgeType,
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
    <Pressable onPress={handlePress}>
      <ListRow
        left={<BadgeIcon type={achievement.badgeType} size="small" />}
        contents={
          <ListRow.Texts
            type="2RowTypeA"
            top={achievement.weekLabel}
            topProps={{ weight: 'semibold', shade: 8 }}
            bottom={t('list.completedRatio', {
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
    </Pressable>
  );
}

export default function AchievementsRoute() {
  const today = useToday();

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <QueryErrorBoundary resetKeys={[today.getFullYear()]}>
        <Suspense
          fallback={
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator />
            </View>
          }
        >
          <AchievementsScreen />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
