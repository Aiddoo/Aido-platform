import type { ViewCaptureHandle } from '@src/core/ports/view-capture-gateway';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useTrack, useTrackView } from '@src/shared/analytics';
import { formatDateKeyRange, formatIsoWeekLabel } from '@src/shared/date/format/date-labels';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today-key';
import { useTranslation } from '@src/shared/i18n';
import { CapturableView } from '@src/shared/infra/view-capture/capturable-view';
import {
  Box,
  Button,
  DashedDivider,
  H4,
  HStack,
  Image,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  ShareIcon,
  Spacing,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { formatPercent } from '@src/shared/utils/number-format';
import {
  usePrefetchQuery,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { useRouter, useIsFocused } from 'expo-router';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { useRef } from 'react';

import type { WeeklyAchievementPage } from '../domains/weekly-achievement-page.model';
import {
  type BadgeType,
  type WeeklyAchievement,
  WeeklyAchievementPolicy,
} from '../domains/weekly-achievement.model';
import { useAchievementYear } from '../hooks/use-achievement-params';
import { useShareViewCapture } from '../hooks/use-share-view-capture';
import {
  useGetAchievementYearsQueryOptions,
  useGetWeeklyAchievementsInfiniteQueryOptions,
} from '../queries/achievement.queries';
import { getBadgeNameKey } from '../utils/badge-label.view-model';
import { BadgeIcon } from './badge-icon';
import { Certificate } from './certificate';

const CERTIFICATE_LINE_COUNT = 4;
const LOADING_STAT_COUNT = 3;

export function AchievementSummary() {
  usePrefetchQuery(useGetMeQueryOptions());
  const { data: achievementYears } = useSuspenseQuery(useGetAchievementYearsQueryOptions());
  // 보이는 해는 기록 있는 연도를 받아야 정해진다
  const [year] = useAchievementYear(achievementYears);
  const { data: weeklyAchievements } = useSuspenseInfiniteQuery(
    useGetWeeklyAchievementsInfiniteQueryOptions({ year }),
  );
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const isFocused = useIsFocused();
  const latest = weeklyAchievements.items[0];
  const latestBadgeType = latest == null ? null : WeeklyAchievementPolicy.getBadgeType(latest);
  const latestWeekKey = latest == null ? null : (`${latest.year}-W${latest.week}` as const);

  // 탭 Stack에 남은 화면은 뒤 탭에서도 다시 조회한다. 보이는 동안 주마다 한 번 센다
  useTrackView(
    'badge_summary_viewed',
    isFocused && latest != null && latestBadgeType != null && latestWeekKey != null
      ? {
          key: latestWeekKey,
          params: {
            badge_type: latestBadgeType,
            completion_rate: latest.completionRate,
            week_label: latestWeekKey,
          },
        }
      : null,
  );

  if (latest == null || latestBadgeType == null || weeklyAchievements.summary == null) {
    return <AchievementSummary.Empty />;
  }

  return (
    <AchievementSummary.Contents
      latest={latest}
      badgeType={latestBadgeType}
      summary={weeklyAchievements.summary}
      userName={user.name}
    />
  );
}

interface AchievementSummaryContentsProps {
  latest: WeeklyAchievement;
  badgeType: BadgeType;
  summary: WeeklyAchievementPage['summary'];
  userName: string;
}

/** 기록이 있는 해의 최근 주 상장과 공유. 빈 상태를 지나 받은 값만 그린다 */
AchievementSummary.Contents = function Contents({
  latest,
  badgeType,
  summary,
  userName,
}: AchievementSummaryContentsProps) {
  const fontScaledSize = useFontScaledSize();
  const { t } = useTranslation('achievement');
  const { trackEvent } = useTrack();
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  const viewShotRef = useRef<ViewCaptureHandle>(null);
  const { shareCapture, isSharing } = useShareViewCapture({
    viewShotRef,
    onShare: () =>
      trackEvent('badge_share_attempted', {
        badge_type: badgeType,
        year: latest.year,
        week: latest.week,
      }),
  });

  return (
    <Box>
      <CapturableView ref={viewShotRef}>
        <Certificate
          subtitle={
            <Text size="b4" shade={6} weight="medium">
              {t(getBadgeNameKey(badgeType))}
            </Text>
          }
        >
          <Spacing size={12} />

          <Certificate.Ornament />

          <Spacing size={16} />

          <VStack align="center" gap={4}>
            <Text size="e1" shade={5}>
              {t('card.nameLabel')}
            </Text>
            <Box className="border-b border-gray-3 px-8 pb-1">
              <H4
                weight="bold"
                align="center"
                lineBreakStrategyIOS="hangul-word"
                textBreakStrategy="highQuality"
              >
                {userName}
              </H4>
            </Box>
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
            {t('card.certificate', {
              weekLabel: t('card.weekWithPeriod', {
                weekLabel: formatIsoWeekLabel(
                  latest.dateRange.startDate,
                  todayKey,
                  dateFormatContext,
                ),
                period: formatDateKeyRange(
                  latest.dateRange.startDate,
                  latest.dateRange.endDate,
                  todayKey,
                  dateFormatContext,
                ),
              }),
              total: latest.totalTodos,
              completed: latest.completedTodos,
              rate: formatPercent(latest.completionRate, dateFormatContext.locale),
            })}
          </Text>

          <Spacing size={20} />

          <DashedDivider />

          <Spacing size={14} />

          <HStack align="center" gap={12}>
            <BadgeIcon type={badgeType} size="large" />
            <Stat
              label={t('card.statPerfect')}
              value={t('card.perfectCount', { count: summary.perfectWeeks })}
            />
            <Stat
              label={t('card.statStreak')}
              value={t('card.streakWeeks', { count: summary.currentStreak })}
            />
            <Stat
              label={t('card.statAverage')}
              value={formatPercent(summary.averageRate, dateFormatContext.locale)}
            />
          </HStack>
        </Certificate>
      </CapturableView>

      <Spacing size={8} />

      <PressableFeedback
        onPress={shareCapture}
        isDisabled={isSharing}
        className="flex-row items-center gap-1.5 self-end py-1"
      >
        <Text size="b3" shade={6} weight="medium">
          {t('card.share')}
        </Text>
        <ShareIcon
          width={fontScaledSize(16)}
          height={fontScaledSize(16)}
          colorClassName="text-gray-6"
        />
      </PressableFeedback>
    </Box>
  );
};

AchievementSummary.Empty = function Empty() {
  const { t } = useTranslation('achievement');
  const { trackEvent } = useTrack();
  const router = useRouter();
  // 피드를 한 번 여는 누름은 지표도 한 번만 남긴다
  const handleStartPress = useSingleTap(() => {
    trackEvent('badge_empty_cta_tapped');
    router.push('/feed');
  });

  return (
    <Certificate>
      <Spacing size={12} />

      <Certificate.Ornament />

      <Spacing size={16} />

      <VStack align="center">
        <Image
          source={require('@assets/images/badge_empty.webp')}
          style={{ width: 80, height: 80 }}
          contentFit="contain"
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

      <DashedDivider />

      <Spacing size={14} />

      <Button size="medium" variant="weak" display="block" onPress={handleStartPress}>
        {t('list.startNow')}
      </Button>
    </Certificate>
  );
};

AchievementSummary.Loading = function Loading() {
  return (
    <Box>
      <Certificate subtitle={<TextSkeleton size="b4" className="w-20" />}>
        <Spacing size={12} />

        <Certificate.Ornament />

        <Spacing size={16} />

        <VStack align="center" gap={4}>
          <TextSkeleton size="e1" className="w-10" />
          <Box className="border-b border-transparent px-8 pb-1">
            <TextSkeleton size="t3" className="w-32" />
          </Box>
        </VStack>

        <Spacing size={16} />

        <VStack align="center">
          {range(CERTIFICATE_LINE_COUNT).map((index) => (
            <TextSkeleton key={index} size="b3" className="w-full" />
          ))}
        </VStack>

        <Spacing size={20} />

        <DashedDivider />

        <Spacing size={14} />

        <HStack align="center" gap={12}>
          <Skeleton className="size-20 rounded-full dark:bg-gray-2" />
          {range(LOADING_STAT_COUNT).map((index) => (
            <VStack key={index} align="center" gap={1} className="flex-1">
              <TextSkeleton size="e1" className="w-10" />
              <TextSkeleton size="b2" className="w-12" />
            </VStack>
          ))}
        </HStack>
      </Certificate>

      <Spacing size={8} />

      <Box className="self-end py-1">
        <TextSkeleton size="b3" className="w-16" />
      </Box>
    </Box>
  );
};

AchievementSummary.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  return (
    <Certificate>
      <Spacing size={16} />
      <QueryErrorFallback reset={reset} />
    </Certificate>
  );
};

interface StatProps {
  label: string;
  value: string;
}

function Stat({ label, value }: StatProps) {
  return (
    <VStack align="center" gap={1} className="flex-1">
      <Text size="e1" shade={5}>
        {label}
      </Text>
      <Text size="b2" shade={9} weight="bold">
        {value}
      </Text>
    </VStack>
  );
}
