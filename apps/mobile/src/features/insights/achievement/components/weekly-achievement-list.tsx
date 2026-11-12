import { useTrack } from '@src/shared/analytics';
import { getIsoWeekYear } from '@src/shared/date/date-key';
import { formatDateKeyRange, formatIsoWeekLabel } from '@src/shared/date/format/date-labels';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
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
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Result,
  Spacing,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { formatPercent } from '@src/shared/utils/number-format';
import { useQueryClient, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { Link, router } from 'expo-router';
import { Skeleton } from 'heroui-native';
import type { ComponentProps, ReactElement } from 'react';

import { AchievementPolicy } from '../domains/achievement.model';
import type { BadgeType, WeeklyAchievement } from '../domains/achievement.model';
import { refreshWeeklyAchievements } from '../queries/achievement-cache';
import { useGetWeeklyAchievementsInfiniteQueryOptions } from '../queries/achievement.queries';
import { BadgeIcon } from './badge-icon';

const LOADING_ROW_COUNT = 5;
const LIST_BOTTOM_SPACE = 32;

interface WeeklyAchievementListProps {
  /** 목록 위 요약. 읽는 동안·실패에도 같은 자리에 그려 목록 실패가 요약을 지우지 않는다 */
  header: ReactElement;
}

export function WeeklyAchievementList({ header }: WeeklyAchievementListProps) {
  const year = getIsoWeekYear(useTodayKey());
  const queryClient = useQueryClient();
  const {
    data: weeklyAchievements,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useSuspenseInfiniteQuery(useGetWeeklyAchievementsInfiniteQueryOptions({ year }));
  const [isRefreshing, handleRefresh] = useRefresh(() =>
    refreshWeeklyAchievements(queryClient, { year }),
  );

  return (
    <InfiniteList
      data={weeklyAchievements.items}
      keyExtractor={(item) => String(item.id)}
      // 화면이 아래 safe area를 빼지 않아 iOS가 탭 막대·홈 인디케이터만큼 끝을 띄우고 행은 유리 밑으로 스크롤된다
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="px-4"
      // 빈 안내만 칸을 채운다. 행이 있을 때도 채우면 짧은 목록이 iOS 자동 inset만큼 끌려 올라간 채 머문다
      contentContainerStyle={{
        flexGrow: weeklyAchievements.items.length === 0 ? 1 : 0,
        justifyContent: weeklyAchievements.items.length === 0 ? 'center' : 'flex-start',
        paddingBottom: LIST_BOTTOM_SPACE,
      }}
      ListHeaderComponent={header}
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
  const { t } = useTranslation('achievement');
  // Link가 navigate로 열어 같은 인증서는 한 번만 쌓인다. 메뉴의 열기도 같은 동사여야 겹쳐 쌓이지 않는다
  const navigate = useSingleTap(router.navigate);
  const { trackEvent } = useTrack();
  const badgeType = AchievementPolicy.getBadgeType(achievement);
  const href = {
    pathname: '/achievements/[year]/[week]',
    params: { year: String(achievement.year), week: String(achievement.week) },
  } as const;

  const trackTap = () =>
    trackEvent('badge_item_tapped', {
      badge_type: badgeType,
      completion_rate: achievement.completionRate,
      year: achievement.year,
      week: achievement.week,
    });

  return (
    <Link href={href} asChild onPress={trackTap}>
      <Link.Trigger>
        <WeeklyAchievementList.Row achievement={achievement} badgeType={badgeType} />
      </Link.Trigger>
      <Link.Preview />
      <Link.Menu>
        <Link.MenuAction
          icon="rosette"
          onPress={() => {
            trackTap();
            navigate(href);
          }}
        >
          {t('list.openCertificate')}
        </Link.MenuAction>
      </Link.Menu>
    </Link>
  );
};

interface WeeklyAchievementRowProps extends Omit<ComponentProps<typeof ListRow>, 'contents'> {
  achievement: WeeklyAchievement;
  badgeType: BadgeType;
}

/** Link가 넘기는 누름 props를 그대로 받아 행 전체가 눌린다 */
WeeklyAchievementList.Row = function Row({
  achievement,
  badgeType,
  ...rowProps
}: WeeklyAchievementRowProps) {
  const { t } = useTranslation('achievement');
  const fontScaledSize = useFontScaledSize();
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();

  return (
    <ListRow
      {...rowProps}
      left={<BadgeIcon type={badgeType} size="small" />}
      contents={
        <ListRow.Texts
          type="2RowTypeA"
          top={formatIsoWeekLabel(achievement.dateRange.startDate, todayKey, dateFormatContext)}
          topProps={{ weight: 'semibold', shade: 8 }}
          bottom={t('list.periodWithCompletedRatio', {
            period: formatDateKeyRange(
              achievement.dateRange.startDate,
              achievement.dateRange.endDate,
              todayKey,
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
            {formatPercent(achievement.completionRate, dateFormatContext.locale)}
          </Text>
          <ArrowRightIcon
            width={fontScaledSize(16)}
            height={fontScaledSize(16)}
            colorClassName="text-gray-6"
          />
        </HStack>
      }
      verticalPadding="medium"
    />
  );
};

WeeklyAchievementList.Loading = function Loading({ header }: WeeklyAchievementListProps) {
  return (
    <VStack className="px-4">
      {header}
      {range(LOADING_ROW_COUNT).map((index) => (
        <ListRow
          key={index}
          left={<Skeleton className="size-10 rounded-full" />}
          contents={<ListRow.Texts.Loading type="2RowTypeA" />}
          right={<TextSkeleton size="b3" className="w-12" />}
          verticalPadding="medium"
        />
      ))}
    </VStack>
  );
};

WeeklyAchievementList.Error = function ErrorFallback({
  reset,
  header,
}: QueryErrorFallbackProps & WeeklyAchievementListProps) {
  return (
    <VStack flex={1} className="px-4">
      {header}
      <VStack flex={1} p={24} justify="center">
        <QueryErrorFallback reset={reset} />
      </VStack>
    </VStack>
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
