import type { ViewCaptureHandle } from '@src/core/ports/view-capture-gateway';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useTrack } from '@src/shared/analytics';
import { formatDateKeyRange, formatIsoWeekLabel } from '@src/shared/date/format/date-labels';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { CapturableView } from '@src/shared/infra/view-capture/capturable-view';
import {
  Box,
  DashedDivider,
  H4,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  ShareIcon,
  Spacing,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { formatPercent } from '@src/shared/utils/number-format';
import { useSuspenseQueries } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { useRef } from 'react';

import { ACHIEVEMENT_BADGE_NAME_KEYS } from '../constants/achievement-labels';
import { AchievementPolicy } from '../domains/achievement.model';
import { useShareViewCapture } from '../hooks/use-share-view-capture';
import { useGetWeeklyAchievementQueryOptions } from '../queries/achievement.queries';
import { achievementParamsSchema } from '../schemas/achievement-params.schema';
import { BadgeIcon } from './badge-icon';
import { Certificate } from './certificate';

const CERTIFICATE_LINE_COUNT = 4;

export function WeeklyAchievementCertificate() {
  const fontScaledSize = useFontScaledSize();
  const [{ year, week }] = useRouteParams(achievementParamsSchema);
  const [{ data: achievement }, { data: user }] = useSuspenseQueries({
    queries: [useGetWeeklyAchievementQueryOptions({ year, week }), useGetMeQueryOptions()],
  });
  const { t } = useTranslation('achievement');
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();

  const { trackEvent } = useTrack();
  const viewShotRef = useRef<ViewCaptureHandle>(null);
  const { shareCapture, isSharing } = useShareViewCapture(viewShotRef);

  const badgeType = AchievementPolicy.getBadgeType(achievement);
  const badgeName = t(ACHIEVEMENT_BADGE_NAME_KEYS[badgeType]);

  const handleShare = async () => {
    trackEvent('badge_share_attempted', { badge_type: badgeType, year, week });
    await shareCapture();
  };

  return (
    <>
      <CapturableView ref={viewShotRef}>
        <Certificate subtitle={<Certificate.Subtitle>{badgeName}</Certificate.Subtitle>}>
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
              weekLabel: formatIsoWeekLabel(
                achievement.dateRange.startDate,
                todayKey,
                dateFormatContext,
              ),
              total: achievement.totalTodos,
              completed: achievement.completedTodos,
              rate: formatPercent(achievement.completionRate, dateFormatContext.locale),
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
                todayKey,
                dateFormatContext,
              )}
            </Text>
          </VStack>
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
    </>
  );
}

WeeklyAchievementCertificate.Loading = function Loading() {
  return (
    <>
      <Certificate subtitle={<TextSkeleton size="b4" className="w-20" />}>
        <Spacing size={16} />

        <VStack align="center">
          <Skeleton className="size-20 rounded-full dark:bg-gray-2" />
        </VStack>

        <Spacing size={16} />

        <Certificate.Ornament />

        <Spacing size={16} />

        <VStack align="center" gap={4}>
          <TextSkeleton size="e1" className="w-10" />
          <Box className="border-b border-transparent pb-1 px-8">
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

        <VStack align="center">
          <TextSkeleton size="e1" className="w-40" />
        </VStack>
      </Certificate>

      <Spacing size={8} />

      <Box className="self-end py-1">
        <TextSkeleton size="b3" className="w-16" />
      </Box>
    </>
  );
};

WeeklyAchievementCertificate.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  return (
    <Certificate>
      <Spacing size={16} />
      <QueryErrorFallback reset={reset} />
    </Certificate>
  );
};
