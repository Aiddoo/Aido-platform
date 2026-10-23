import { BadgeIcon } from '@src/features/achievement/components/badge-icon';
import { Certificate } from '@src/features/achievement/components/certificate';
import {
  achievementScreenParamsSchema,
  useAchievementScreenParams,
} from '@src/features/achievement/hooks/use-achievement-screen-params';
import { useGetWeeklyAchievementQueryOptions } from '@src/features/achievement/queries/get-weekly-achievement-query-options';
import {
  type BadgeType,
  getBadgeType,
} from '@src/features/achievement/utils/view-models/weekly-achievement.view-model';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useTrack } from '@src/shared/analytics';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useShareView } from '@src/shared/hooks/use-share-view';
import { t as tGlobal, useTranslation } from '@src/shared/i18n';
import {
  H4,
  QueryErrorBoundary,
  ShareIcon,
  Spacing,
  StyledSafeAreaView,
  Text,
  VStack,
  DashedDivider,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { Suspense, useRef } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';

const BADGE_NAME_KEYS = {
  perfect: 'achievement:badgeNames.perfect',
  almost: 'achievement:badgeNames.almost',
  completed: 'achievement:badgeNames.completed',
} as const satisfies Record<BadgeType, string>;

function AchievementDetailScreen() {
  const fontScaledSize = useFontScaledSize();
  const { year, week } = useAchievementScreenParams();
  const { data: achievement } = useSuspenseQuery(
    useGetWeeklyAchievementQueryOptions({ year, week }),
  );
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const { t } = useTranslation('achievement');

  const { trackEvent } = useTrack();
  const viewShotRef = useRef<ViewShotRef>(null);
  const { shareCapture, isSharing } = useShareView(viewShotRef);

  const badgeType = getBadgeType(achievement.completionRate);
  const badgeName = tGlobal(BADGE_NAME_KEYS[badgeType]);

  const handleShare = async () => {
    trackEvent('badge_share_attempted', { badge_type: badgeType, year, week });
    await shareCapture();
  };

  return (
    <ScrollView
      contentContainerClassName="px-4"
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
    >
      <StyledSafeAreaView edges={['left', 'right']} className="grow justify-center">
        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
          <Certificate subtitle={badgeName}>
            <Spacing size={16} />

            <VStack align="center" gap={8}>
              <BadgeIcon type={badgeType} size="large" />
            </VStack>

            <Spacing size={16} />

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
                weekLabel: achievement.weekLabel,
                total: achievement.totalTodos,
                completed: achievement.completedTodos,
                rate: achievement.completionRate,
              })}
            </Text>

            <Spacing size={20} />

            <DashedDivider />

            <Spacing size={14} />

            <VStack align="center" gap={2}>
              <Text size="e1" shade={5}>
                {achievement.dateRange.startDate} ~ {achievement.dateRange.endDate}
              </Text>
            </VStack>
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
      </StyledSafeAreaView>
    </ScrollView>
  );
}

export default function AchievementDetailRoute() {
  const params = useLocalSearchParams();
  const parsed = achievementScreenParamsSchema.safeParse(params);
  if (!parsed.success) {
    return <Redirect href="/achievements" />;
  }

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <QueryErrorBoundary resetKeys={[parsed.data.year, parsed.data.week]}>
        <Suspense
          fallback={
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator />
            </View>
          }
        >
          <AchievementDetailScreen />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
