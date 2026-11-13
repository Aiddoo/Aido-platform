import type { ViewCaptureHandle } from '@src/core/ports/view-capture-gateway';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useTrack, useTrackView } from '@src/shared/analytics';
import { getIsoWeekYear } from '@src/shared/date/date-key';
import { formatDateKeyRange, formatIsoWeekLabel } from '@src/shared/date/format/date-labels';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today';
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
import { router, useIsFocused } from 'expo-router';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { useRef } from 'react';

import { ACHIEVEMENT_BADGE_NAME_KEYS } from '../constants/achievement-labels';
import { AchievementPolicy } from '../domains/achievement.model';
import { useShareViewCapture } from '../hooks/use-share-view-capture';
import { useGetWeeklyAchievementsInfiniteQueryOptions } from '../queries/achievement.queries';
import { BadgeIcon } from './badge-icon';
import { Certificate } from './certificate';

const CERTIFICATE_LINE_COUNT = 4;
const LOADING_STAT_COUNT = 3;

export function AchievementSummary() {
  const todayKey = useTodayKey();
  usePrefetchQuery(useGetMeQueryOptions());
  const { data: weeklyAchievements } = useSuspenseInfiniteQuery(
    useGetWeeklyAchievementsInfiniteQueryOptions({ year: getIsoWeekYear(todayKey) }),
  );
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const isFocused = useIsFocused();
  const fontScaledSize = useFontScaledSize();
  const { t } = useTranslation('achievement');
  const { trackEvent } = useTrack();
  const dateFormatContext = useDateFormatContext();
  const viewShotRef = useRef<ViewCaptureHandle>(null);
  const { shareCapture, isSharing } = useShareViewCapture(viewShotRef);
  const latest = weeklyAchievements.items[0];
  const latestBadgeType = latest == null ? null : AchievementPolicy.getBadgeType(latest);
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

  const { summary } = weeklyAchievements;

  const handleShare = async () => {
    trackEvent('badge_share_attempted', {
      badge_type: latestBadgeType,
      year: latest.year,
      week: latest.week,
    });
    await shareCapture();
  };

  return (
    <Box>
      <CapturableView ref={viewShotRef}>
        <Certificate
          subtitle={
            <Certificate.Subtitle>
              {t(ACHIEVEMENT_BADGE_NAME_KEYS[latestBadgeType])}
            </Certificate.Subtitle>
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
                {user.name}
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
            <BadgeIcon type={latestBadgeType} size="large" />
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
        onPress={handleShare}
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
}

AchievementSummary.Empty = function Empty() {
  const { t } = useTranslation('achievement');
  const { trackEvent } = useTrack();
  const push = useSingleTap(router.push);

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

      <Button
        size="medium"
        variant="weak"
        display="block"
        onPress={() => {
          trackEvent('badge_empty_cta_tapped');
          push('/feed');
        }}
      >
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
