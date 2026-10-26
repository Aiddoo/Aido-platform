import { BadgeIcon } from '@src/features/achievement/components/badge-icon';
import { Certificate } from '@src/features/achievement/components/certificate';
import { ACHIEVEMENT_BADGE_NAME_KEYS } from '@src/features/achievement/constants/achievement-badge-labels';
import { AchievementPolicy } from '@src/features/achievement/domains/achievement.model';
import {
  achievementScreenParamsSchema,
  useAchievementScreenParams,
} from '@src/features/achievement/hooks/use-achievement-screen-params';
import { useGetWeeklyAchievementQueryOptions } from '@src/features/achievement/queries/get-weekly-achievement-query-options';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useTrack } from '@src/shared/analytics';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useShareView } from '@src/shared/hooks/use-share-view';
import { t as tGlobal, useTranslation } from '@src/shared/i18n';
import {
  DashedDivider,
  H4,
  QueryErrorBoundary,
  Result,
  ShareIcon,
  Spacing,
  StyledSafeAreaView,
  Text,
  VStack,
  type QueryErrorFallbackProps,
  Box,
} from '@src/shared/ui';
import { formatDateKeyRange } from '@src/shared/utils/date-format';
import { useSuspenseQueries } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { Suspense, useRef } from 'react';
import { ScrollView } from 'react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';

const CERTIFICATE_LINE_COUNT = 4;

export default function AchievementDetailScreen() {
  const params = useLocalSearchParams();
  const parsed = achievementScreenParamsSchema.safeParse(params);
  if (!parsed.success) {
    return <Redirect href="/achievements" />;
  }

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <ScrollView
        contentContainerClassName="px-4"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
      >
        <StyledSafeAreaView edges={['left', 'right']} className="grow justify-center">
          <QueryErrorBoundary
            resetKeys={[parsed.data.year, parsed.data.week]}
            fallback={(props) => <WeeklyAchievementCertificate.Error {...props} />}
          >
            <Suspense fallback={<WeeklyAchievementCertificate.Loading />}>
              <WeeklyAchievementCertificate />
            </Suspense>
          </QueryErrorBoundary>
        </StyledSafeAreaView>
      </ScrollView>
    </StyledSafeAreaView>
  );
}

function WeeklyAchievementCertificate() {
  const fontScaledSize = useFontScaledSize();
  const { year, week } = useAchievementScreenParams();
  const [{ data: achievement }, { data: user }] = useSuspenseQueries({
    queries: [useGetWeeklyAchievementQueryOptions({ year, week }), useGetMeQueryOptions()],
  });
  const { t } = useTranslation('achievement');
  const dateFormatContext = useDateFormatContext();

  const { trackEvent } = useTrack();
  const viewShotRef = useRef<ViewShotRef>(null);
  const { shareCapture, isSharing } = useShareView(viewShotRef);

  const badgeType = AchievementPolicy.badgeType(achievement);
  const badgeName = tGlobal(ACHIEVEMENT_BADGE_NAME_KEYS[badgeType]);

  const handleShare = async () => {
    trackEvent('badge_share_attempted', { badge_type: badgeType, year, week });
    await shareCapture();
  };

  return (
    <>
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
            <Box className="border-b border-gray-3 pb-1 px-8">
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
              {formatDateKeyRange(
                achievement.dateRange.startDate,
                achievement.dateRange.endDate,
                dateFormatContext,
              )}
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
    </>
  );
}

WeeklyAchievementCertificate.Loading = function Loading() {
  const fontScaledSize = useFontScaledSize();

  return (
    <Certificate>
      <Spacing size={16} />

      <VStack align="center">
        <Skeleton className="size-20 rounded-full" />
      </VStack>

      <Spacing size={16} />

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

      <VStack align="center">
        <Skeleton className="w-40 rounded" style={{ height: fontScaledSize(17) }} />
      </VStack>
    </Certificate>
  );
};

WeeklyAchievementCertificate.Error = function ErrorState({ reset }: QueryErrorFallbackProps) {
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
