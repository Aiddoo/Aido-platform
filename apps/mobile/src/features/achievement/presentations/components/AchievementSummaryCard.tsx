import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
import { useTrack } from '@src/shared/analytics';
import { useShareView } from '@src/shared/hooks/useShareView';
import { t as tGlobal, useTranslation } from '@src/shared/i18n';
import { H3, H4, HStack, ShareIcon, Spacing, Text, VStack } from '@src/shared/ui';
import { fontScaledSize } from '@src/shared/utils/scale';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback } from 'heroui-native';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';

import type { AchievementSummary } from '../../models/achievement.model';
import type {
  BadgeType,
  WeeklyAchievementViewModel,
} from '../view-models/weekly-achievement.view-model';
import { BadgeIcon } from './BadgeIcon';
import { CertificateBorder } from './CertificateBorder';

const BADGE_NAME_KEYS = {
  perfect: 'achievement:badgeNames.perfect',
  almost: 'achievement:badgeNames.almost',
  completed: 'achievement:badgeNames.completed',
} as const satisfies Record<BadgeType, string>;

interface AchievementSummaryCardProps {
  latest: WeeklyAchievementViewModel;
  summary: AchievementSummary;
}

export function AchievementSummaryCard({ latest, summary }: AchievementSummaryCardProps) {
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const { t } = useTranslation('achievement');
  const { trackEvent } = useTrack();
  const viewShotRef = useRef<ViewShotRef>(null);
  const { shareCapture, isSharing } = useShareView(viewShotRef);
  const badgeName = tGlobal(BADGE_NAME_KEYS[latest.badgeType]);

  const handleShare = async () => {
    trackEvent('badge_share_attempted', {
      badge_type: latest.badgeType,
      year: latest.year,
      week: latest.week,
    });
    await shareCapture();
  };

  useEffect(() => {
    trackEvent('badge_summary_viewed', {
      badge_type: latest.badgeType,
      completion_rate: latest.completionRate,
      week_label: latest.weekLabel,
    });
  }, [trackEvent, latest.badgeType, latest.completionRate, latest.weekLabel]);

  return (
    <View>
      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
        <View className="bg-white rounded-sm overflow-hidden p-3">
          <CertificateBorder>
            <View className="px-5 pt-7 pb-5">
              <VStack align="center" gap={4}>
                <Text size="e1" tone="brand" className="tracking-widest">
                  WEEKLY BADGE
                </Text>
                <H3 className="tracking-wider">{t('card.title')}</H3>
                <Text size="b4" shade={6} weight="medium">
                  {badgeName}
                </Text>
              </VStack>

              <Spacing size={12} />

              <Text tone="brand" align="center">
                {'── ✦ ──'}
              </Text>

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

              {/* 점선 구분선 */}
              <View className="border-b border-dashed border-gray-3" />

              <Spacing size={14} />

              <HStack align="center" gap={12}>
                <BadgeIcon type={latest.badgeType} size="large" />

                <StatItem
                  label={t('card.statPerfect')}
                  value={t('card.perfectCount', { count: summary.perfectWeeks })}
                />
                <StatItem
                  label={t('card.statStreak')}
                  value={t('card.streakWeeks', { count: summary.currentStreak })}
                />
                <StatItem label={t('card.statAverage')} value={`${summary.averageRate}%`} />
              </HStack>
            </View>
          </CertificateBorder>
        </View>
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

interface StatItemProps {
  label: string;
  value: string;
}

function StatItem({ label, value }: StatItemProps) {
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
