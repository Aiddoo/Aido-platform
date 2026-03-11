import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
import { H3, H4, HStack, Spacing, Text, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useResolveClassNames } from 'uniwind';

import type { AchievementSummary } from '../../models/achievement.model';
import type {
  BadgeType,
  WeeklyAchievementViewModel,
} from '../view-models/weekly-achievement.view-model';
import { BadgeIcon } from './BadgeIcon';

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
  const badgeName = BADGE_NAME[latest.badgeType];

  return (
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
  );
}

/** 상장 느낌의 이중 SVG 라운드 테두리 */
function CertificateBorder({ children }: { children: React.ReactNode }) {
  const { color: strokeColor } = useResolveClassNames('text-main');
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }, []);

  const { width: w, height: h } = size;

  return (
    <View className="relative" onLayout={onLayout}>
      {/* SVG 이중 테두리 */}
      {w > 0 && h > 0 && (
        <View className="absolute inset-0">
          <Svg width={w} height={h}>
            <Rect
              x={2}
              y={2}
              width={w - 4}
              height={h - 4}
              rx={2}
              ry={2}
              stroke={strokeColor as string}
              strokeWidth={1.5}
              fill="none"
              strokeOpacity={0.6}
            />
            <Rect
              x={7}
              y={7}
              width={w - 14}
              height={h - 14}
              rx={1}
              ry={1}
              stroke={strokeColor as string}
              strokeWidth={0.5}
              fill="none"
              strokeOpacity={0.35}
            />
          </Svg>
        </View>
      )}
      <View className="m-2">{children}</View>
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
