import { BadgeIcon } from '@src/features/achievement/presentations/components/BadgeIcon';
import { CertificateBorder } from '@src/features/achievement/presentations/components/CertificateBorder';
import { useGetWeeklyAchievementQueryOptions } from '@src/features/achievement/presentations/queries/use-get-weekly-achievement-query-options';
import {
  type BadgeType,
  getBadgeType,
} from '@src/features/achievement/presentations/view-models/weekly-achievement.view-model';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
import { useTrack } from '@src/shared/analytics';
import { useShareView } from '@src/shared/hooks/useShareView';
import {
  H3,
  H4,
  QueryErrorBoundary,
  ShareIcon,
  Spacing,
  StyledSafeAreaView,
  Text,
  VStack,
} from '@src/shared/ui';
import { fontScaledSize } from '@src/shared/utils/scale';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { Suspense, useRef } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import ViewShot from 'react-native-view-shot';

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

  const { trackEvent } = useTrack();
  const viewShotRef = useRef<ViewShot>(null);
  const { shareCapture, isSharing } = useShareView(viewShotRef);

  const badgeType = getBadgeType(achievement.completionRate);
  const badgeName = BADGE_NAME[badgeType];

  const handleShare = async () => {
    trackEvent('badge_share_attempted', { badge_type: badgeType, year, week });
    await shareCapture();
  };

  return (
    <ScrollView
      contentContainerClassName="px-4"
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
    >
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
    </ScrollView>
  );
}
