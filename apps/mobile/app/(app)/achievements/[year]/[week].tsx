import { BadgeIcon } from '@src/features/achievement/presentations/components/BadgeIcon';
import { CertificateBorder } from '@src/features/achievement/presentations/components/CertificateBorder';
import { useGetWeeklyAchievementQueryOptions } from '@src/features/achievement/presentations/queries/use-get-weekly-achievement-query-options';
import {
  type BadgeType,
  getBadgeType,
} from '@src/features/achievement/presentations/view-models/weekly-achievement.view-model';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
import {
  H3,
  H4,
  QueryErrorBoundary,
  Spacing,
  StyledSafeAreaView,
  Text,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

const BADGE_NAME: Record<BadgeType, string> = {
  perfect: '빈틈없는 한 주',
  almost: '아깝다 한 끗',
  completed: '꾸준한 한 걸음',
};

const AchievementDetailScreen = () => {
  const { year, week } = useLocalSearchParams<{ year: string; week: string }>();

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
          <AchievementDetailContent year={Number(year)} week={Number(week)} />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
};

export default AchievementDetailScreen;

interface AchievementDetailContentProps {
  year: number;
  week: number;
}

function AchievementDetailContent({ year, week }: AchievementDetailContentProps) {
  const { data: achievement } = useSuspenseQuery(useGetWeeklyAchievementQueryOptions(year, week));
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());

  const badgeType = getBadgeType(achievement.completionRate);
  const badgeName = BADGE_NAME[badgeType];

  return (
    <ScrollView
      contentContainerClassName="px-4 py-6"
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
    >
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

            <Spacing size={16} />

            <VStack align="center" gap={8}>
              <BadgeIcon type={badgeType} size="large" />
            </VStack>

            <Spacing size={16} />

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
              {`위 사람은 ${achievement.weekLabel}에\n${achievement.totalTodos}개의 할 일 중 ${achievement.completedTodos}개를 완료하여\n완료율 ${achievement.completionRate}%를 달성하였기에\n이 배지를 수여합니다.`}
            </Text>

            <Spacing size={20} />

            <View className="border-b border-dashed border-gray-3" />

            <Spacing size={14} />

            <VStack align="center" gap={2}>
              <Text size="e1" shade={5}>
                {achievement.dateRange.startDate} ~ {achievement.dateRange.endDate}
              </Text>
            </VStack>
          </View>
        </CertificateBorder>
      </View>
    </ScrollView>
  );
}
