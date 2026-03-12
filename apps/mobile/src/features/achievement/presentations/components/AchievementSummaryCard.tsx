import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
import { useTrack } from '@src/shared/analytics';
import { useShareView } from '@src/shared/hooks/useShareView';
import { H3, H4, HStack, ShareIcon, Spacing, Text, VStack } from '@src/shared/ui';
import { fontScaledSize } from '@src/shared/utils/scale';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback } from 'heroui-native';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import ViewShot from 'react-native-view-shot';

import type { AchievementSummary } from '../../models/achievement.model';
import type {
  BadgeType,
  WeeklyAchievementViewModel,
} from '../view-models/weekly-achievement.view-model';
import { BadgeIcon } from './BadgeIcon';
import { CertificateBorder } from './CertificateBorder';

const BADGE_NAME: Record<BadgeType, string> = {
  perfect: '빈틈없는 한 주',
  almost: '아깝다 한 끗',
  completed: '꾸준한 한 걸음',
};

interface AchievementSummaryCardProps {
  latest: WeeklyAchievementViewModel;
  summary: AchievementSummary;
}

export function AchievementSummaryCard({ latest, summary }: AchievementSummaryCardProps) {
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const { trackEvent } = useTrack();
  const viewShotRef = useRef<ViewShot>(null);
  const { shareCapture, isSharing } = useShareView(viewShotRef);
  const badgeName = BADGE_NAME[latest.badgeType];

  const handleShare = async () => {
    await shareCapture();
    trackEvent('badge_share_attempted', {
      badge_type: latest.badgeType,
      year: latest.year,
      week: latest.week,
    });
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
                <H3 className="tracking-wider">주간 달성 배지</H3>
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
                  성명
                </Text>
                <View className="border-b border-gray-3 pb-1 px-8">
                  <H4
                    weight="bold"
                    align="center"
                    lineBreakStrategyIOS="hangul-word"
                    textBreakStrategy="highQuality"
                    maxFontSizeMultiplier={1.3}
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
                {`위 사람은 ${latest.weekLabel}에\n${latest.totalTodos}개의 할 일 중 ${latest.completedTodos}개를 완료하여\n완료율 ${latest.completionRate}%를 달성하였기에\n이 배지를 수여합니다.`}
              </Text>

              <Spacing size={20} />

              {/* 점선 구분선 */}
              <View className="border-b border-dashed border-gray-3" />

              <Spacing size={14} />

              <HStack align="center" gap={12}>
                <BadgeIcon type={latest.badgeType} size="large" />

                <StatItem label="완벽" value={`${summary.perfectWeeks}회`} />
                <StatItem label="연속" value={`${summary.currentStreak}주`} />
                <StatItem label="평균" value={`${summary.averageRate}%`} />
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
          공유하기
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
      <Text size="e1" shade={5} maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
      <Text size="b2" shade={9} weight="bold" maxFontSizeMultiplier={1.4}>
        {value}
      </Text>
    </VStack>
  );
}
