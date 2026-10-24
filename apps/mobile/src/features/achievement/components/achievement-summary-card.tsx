import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useTrack } from '@src/shared/analytics';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useShareView } from '@src/shared/hooks/use-share-view';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useToday } from '@src/shared/hooks/use-today';
import { t as tGlobal, useTranslation } from '@src/shared/i18n';
import {
  Button,
  DashedDivider,
  H4,
  HStack,
  Result,
  ShareIcon,
  Spacing,
  Text,
  VStack,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { useSuspenseInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { router } from 'expo-router';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { useEffect, useRef } from 'react';
import { Image, View } from 'react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';

import { ACHIEVEMENT_BADGE_NAME_KEYS } from '../constants/achievement-badge-labels';
import { AchievementPolicy } from '../domains/achievement.model';
import { useGetWeeklyAchievementsInfiniteQueryOptions } from '../queries/get-weekly-achievements-infinite-query-options';
import { BadgeIcon } from './badge-icon';
import { Certificate } from './certificate';

const CERTIFICATE_LINE_COUNT = 4;

export function AchievementSummaryCard() {
  const today = useToday();
  const { data } = useSuspenseInfiniteQuery(
    useGetWeeklyAchievementsInfiniteQueryOptions({ year: today.getFullYear() }),
  );
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const fontScaledSize = useFontScaledSize();
  const { t } = useTranslation('achievement');
  const { trackEvent } = useTrack();
  const viewShotRef = useRef<ViewShotRef>(null);
  const { shareCapture, isSharing } = useShareView(viewShotRef);
  const latest = data.items[0];
  const latestBadgeType = latest == null ? null : AchievementPolicy.badgeType(latest);
  const latestCompletionRate = latest?.completionRate;
  const latestWeekLabel = latest?.weekLabel;

  useEffect(() => {
    if (
      latestBadgeType == null ||
      latestCompletionRate === undefined ||
      latestWeekLabel === undefined
    ) {
      return;
    }
    trackEvent('badge_summary_viewed', {
      badge_type: latestBadgeType,
      completion_rate: latestCompletionRate,
      week_label: latestWeekLabel,
    });
  }, [trackEvent, latestBadgeType, latestCompletionRate, latestWeekLabel]);

  if (latest == null || latestBadgeType == null || data.summary == null) {
    return <AchievementSummaryCard.Empty />;
  }

  const { summary } = data;

  const handleShare = async () => {
    trackEvent('badge_share_attempted', {
      badge_type: latestBadgeType,
      year: latest.year,
      week: latest.week,
    });
    await shareCapture();
  };

  return (
    <View>
      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
        <Certificate subtitle={tGlobal(ACHIEVEMENT_BADGE_NAME_KEYS[latestBadgeType])}>
          <Spacing size={12} />

          <Certificate.Ornament />

          <Spacing size={16} />

          <VStack align="center" gap={4}>
            <Text size="e1" shade={5}>
              {t('card.nameLabel')}
            </Text>
            <View className="border-b border-gray-3 pb-1 px-8">
              <H4
                weight="bold"
                align="center"
                lineBreakStrategyIOS="hangul-word"
                textBreakStrategy="highQuality"
              >
                {user.name}
              </H4>
            </View>
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
              weekLabel: latest.weekLabel,
              total: latest.totalTodos,
              completed: latest.completedTodos,
              rate: latest.completionRate,
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
            <Stat label={t('card.statAverage')} value={`${summary.averageRate}%`} />
          </HStack>
        </Certificate>
      </ViewShot>

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
    </View>
  );
}

AchievementSummaryCard.Empty = function Empty() {
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

AchievementSummaryCard.Loading = function Loading() {
  const fontScaledSize = useFontScaledSize();

  return (
    <Certificate>
      <Spacing size={12} />

      <Certificate.Ornament />

      <Spacing size={16} />

      <VStack align="center" gap={4}>
        <Skeleton className="w-10 rounded" style={{ height: fontScaledSize(17) }} />
        <Skeleton className="w-32 rounded" style={{ height: fontScaledSize(28) }} />
      </VStack>

      <Spacing size={16} />

      <VStack align="center">
        {times(CERTIFICATE_LINE_COUNT, (index) => (
          <Skeleton key={index} className="w-full rounded" style={{ height: fontScaledSize(20) }} />
        ))}
      </VStack>

      <Spacing size={20} />

      <DashedDivider />

      <Spacing size={14} />

      <HStack align="center" gap={12}>
        <Skeleton className="size-20 rounded-full" />
        <Skeleton className="flex-1 rounded" style={{ height: fontScaledSize(40) }} />
      </HStack>
    </Certificate>
  );
};

AchievementSummaryCard.Error = function ErrorState({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('common');

  return (
    <Certificate>
      <Spacing size={16} />
      <Result
        title={t('errorBoundary.title')}
        button={<Result.Button onPress={reset}>{t('actions.retry')}</Result.Button>}
      />
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
