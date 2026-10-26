import { UserAvatar } from '@src/features/user/components/user-avatar';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { Box, Button, HeartFilledIcon, HStack, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatRelativeTimeLabel } from '@src/shared/utils/date';
import { notifySuccess } from '@src/shared/utils/haptics';
import { useQuery, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { Skeleton } from 'heroui-native';
import { type ReactNode, useEffect, useRef } from 'react';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { match } from 'ts-pattern';

import {
  NudgeInteractionPolicy,
  type NudgeThanksPreview,
} from '../../domains/nudge-interaction.model';
import { useGetNudgeInteractionAvailabilityQueryOptions } from '../../queries/get-nudge-interaction-availability-query-options';
import { useGetNudgeThanksPreviewInfiniteQueryOptions } from '../../queries/get-nudge-thanks-preview-infinite-query-options';

const VISIBLE_AVATAR_COUNT = 2;
const BUTTON_HIT_SLOP = 4;
const HEART_SPRING = { damping: 12, stiffness: 320 } as const;

interface ThanksSummaryRowProps {
  todoId: number;
  onThanksPress: () => void;
}

export function ThanksSummaryRow(props: ThanksSummaryRowProps) {
  const availability = useQuery(useGetNudgeInteractionAvailabilityQueryOptions());
  if (availability.data !== true) {
    return null;
  }

  return <ThanksSummaryRow.Contents {...props} />;
}

ThanksSummaryRow.Contents = function Contents({ todoId, onThanksPress }: ThanksSummaryRowProps) {
  const { t } = useTranslation('todo');
  const { data } = useSuspenseInfiniteQuery(
    useGetNudgeThanksPreviewInfiniteQueryOptions({ todoId }),
  );
  const preview = data.pages[0];
  const heartStyle = useThanksCelebration(preview?.thankedRecipientCount ?? 0);

  if (preview == null) {
    return null;
  }

  const { state, pendingRecipientCount } = NudgeInteractionPolicy.getThanksSummary(preview);
  const thanksButtonLabel = t('interaction.thanksQuickActionLabel', {
    count: pendingRecipientCount,
  });

  return match(state)
    .with('NONE', () => null)
    .with('PENDING', () => (
      <Card
        variant="pending"
        left={<RecipientAvatars recipients={preview.recipients} />}
        title={
          <CardTitle>
            {t('interaction.thanksPendingTitle', { count: pendingRecipientCount })}
          </CardTitle>
        }
        description={<CardDescription>{t('interaction.thanksPendingDescription')}</CardDescription>}
        action={
          <ThanksButton
            variant="fill"
            accessibilityLabel={thanksButtonLabel}
            onPress={onThanksPress}
          >
            <HStack align="center" gap={6}>
              <HeartFilledIcon
                width={16}
                height={16}
                colorClassName="text-white dark:text-gray-9"
              />
              <Text size="b4" weight="semibold" className="text-white dark:text-gray-9">
                {t('interaction.thanksQuickAction')}
              </Text>
            </HStack>
          </ThanksButton>
        }
      />
    ))
    .with('SENT', () => (
      <Card
        variant="sent"
        left={<SentHeart style={heartStyle} />}
        title={
          <CardTitle>
            {t('interaction.thanksSentTitle', { count: preview.thankedRecipientCount })}
          </CardTitle>
        }
        description={<LastThankedAt lastThankedAt={preview.lastThankedAt} />}
      />
    ))
    .with('SENT_WITH_PENDING', () => (
      <Card
        variant="sent"
        left={<SentHeart style={heartStyle} />}
        title={
          <CardTitle>
            {t('interaction.thanksSentTitle', { count: preview.thankedRecipientCount })}
          </CardTitle>
        }
        description={
          <CardDescription>
            {t('interaction.thanksNewPendingDescription', { count: pendingRecipientCount })}
          </CardDescription>
        }
        action={
          <ThanksButton
            variant="weak"
            accessibilityLabel={thanksButtonLabel}
            onPress={onThanksPress}
          >
            {t('interaction.thanksSendMore')}
          </ThanksButton>
        }
      />
    ))
    .exhaustive();
};

ThanksSummaryRow.Loading = function Loading() {
  return (
    <Card
      variant="pending"
      left={
        <HStack>
          {times(VISIBLE_AVATAR_COUNT, (index) => (
            <Box key={index} className={cn(index > 0 && '-ml-2')}>
              <Skeleton className="size-8 rounded-full border-2 border-background" />
            </Box>
          ))}
        </HStack>
      }
      title={<TextSkeleton size="b3" className="w-32" />}
      description={<TextSkeleton size="e1" className="w-40" />}
      action={<Skeleton className="h-10 w-20 rounded-xl" />}
    />
  );
};

function useThanksCelebration(thankedRecipientCount: number) {
  const isReducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const previousCount = useRef(thankedRecipientCount);

  useEffect(() => {
    if (thankedRecipientCount <= previousCount.current) {
      previousCount.current = thankedRecipientCount;
      return;
    }
    previousCount.current = thankedRecipientCount;
    notifySuccess();
    if (isReducedMotion) {
      return;
    }
    scale.value = withSequence(withSpring(1.2, HEART_SPRING), withSpring(1, HEART_SPRING));
  }, [thankedRecipientCount, isReducedMotion, scale]);

  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

interface CardProps {
  variant: 'pending' | 'sent';
  left: ReactNode;
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
}

function Card({ variant, left, title, description, action }: CardProps) {
  const { fontScale } = useFontScale();
  const isActionStacked = fontScale === 'xlarge';

  return (
    <HStack
      align="center"
      gap={12}
      wrap={isActionStacked ? 'wrap' : 'nowrap'}
      className={cn(
        'min-h-16 rounded-2xl py-3 pl-4 pr-3',
        variant === 'pending' ? 'bg-main/8 dark:bg-main/20' : 'bg-gray-2',
      )}
    >
      {left}
      <VStack flex={1} gap={2} className="min-w-0">
        {title}
        {description}
      </VStack>
      {action != null && <Box className={cn(isActionStacked && 'w-full')}>{action}</Box>}
    </HStack>
  );
}

function CardTitle({ children }: { children: string }) {
  return (
    <Text size="b3" weight="semibold" shade={9} maxLines={2}>
      {children}
    </Text>
  );
}

function CardDescription({ children }: { children: string }) {
  return (
    <Text size="e1" shade={7}>
      {children}
    </Text>
  );
}

function ThanksButton({
  variant,
  accessibilityLabel,
  onPress,
  children,
}: {
  variant: 'fill' | 'weak';
  accessibilityLabel: string;
  onPress: () => void;
  children: ReactNode;
}) {
  const { fontScale } = useFontScale();

  return (
    <Button
      size="medium"
      variant={variant}
      color="primary"
      display={fontScale === 'xlarge' ? 'full' : 'inline'}
      hitSlop={BUTTON_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
    >
      {children}
    </Button>
  );
}

function RecipientAvatars({ recipients }: { recipients: NudgeThanksPreview['recipients'] }) {
  return (
    <HStack accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {recipients.slice(0, VISIBLE_AVATAR_COUNT).map((recipient, index) => (
        <Box key={recipient.id} className={cn(index > 0 && '-ml-2')}>
          <UserAvatar
            alt={recipient.name}
            className="size-8 border-2 border-background"
            profileImage={recipient.profileImage}
          />
        </Box>
      ))}
    </HStack>
  );
}

function SentHeart({ style }: { style: ReturnType<typeof useAnimatedStyle> }) {
  return (
    <Box
      className="size-8 items-center justify-center rounded-full bg-white"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={style}>
        <HeartFilledIcon width={18} height={18} colorClassName="text-main" />
      </Animated.View>
    </Box>
  );
}

function LastThankedAt({ lastThankedAt }: { lastThankedAt: Date | null }) {
  const dateFormatContext = useDateFormatContext();

  if (lastThankedAt == null) {
    return null;
  }

  return (
    <CardDescription>
      {formatRelativeTimeLabel(lastThankedAt, new Date(), dateFormatContext)}
    </CardDescription>
  );
}
