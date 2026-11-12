import { useHaptics } from '@src/bootstrap/providers/di-context';
import { UserAvatar } from '@src/features/identity/user/components/user-avatar';
import { todoCompletionWritesFilter } from '@src/features/planning/todo/queries/todo-cache';
import { ANIMATION } from '@src/shared/constants/animation';
import { formatRelativeTimeLabel } from '@src/shared/date/format/date-labels';
import { type Instant } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useTranslation } from '@src/shared/i18n';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import {
  Box,
  Button,
  HeartFilledIcon,
  HStack,
  InlineAlert,
  QueryErrorActions,
  type QueryErrorFallbackProps,
  Text,
  TextButton,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useIsMutating, useQuery, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { type ComponentProps, type ReactNode, useEffect, useRef } from 'react';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { match } from 'ts-pattern';

import {
  NudgeThanksPreviewPolicy,
  type NudgeThanksRecipient,
} from '../../domains/nudge-interaction.model';
import {
  useGetNudgeInteractionAvailabilityQueryOptions,
  useGetNudgeThanksPreviewInfiniteQueryOptions,
} from '../../queries/todo-nudge.queries';

const VISIBLE_AVATAR_COUNT = 2;
const BUTTON_HIT_SLOP = 4;
const HEART_SPRING = { damping: 12, stiffness: 320 } as const;

interface ThanksSummaryRowProps {
  todoId: number;
  onOpenThanks: () => void;
}

/**
 * 쓸 수 있는지, 보낼 대상이 있는지 두 번 조회해야 보일지 아는 줄이라 로딩 때 자리를 잡지 않는다.
 * 자리를 잡으면 대상이 없을 때 나타났다 사라져 아래가 두 번 움직인다.
 * 완료를 저장하는 동안은 서버가 아직 완료 전이라 묻지 않고, 저장이 끝나면 할 일 변경 무효화로 새로 받는다.
 */
export function ThanksSummaryRow(props: ThanksSummaryRowProps) {
  const availability = useQuery(useGetNudgeInteractionAvailabilityQueryOptions());
  const isCompletionSaving =
    useIsMutating(todoCompletionWritesFilter({ todoId: props.todoId })) > 0;
  if (availability.data !== true || isCompletionSaving) {
    return null;
  }

  return <ThanksSummaryRow.Preview {...props} />;
}

ThanksSummaryRow.Preview = function Preview({ todoId, onOpenThanks }: ThanksSummaryRowProps) {
  const { t } = useTranslation('todo');
  const { data } = useSuspenseInfiniteQuery(
    useGetNudgeThanksPreviewInfiniteQueryOptions({ todoId }),
  );
  const preview = data.pages[0];
  const heartStyle = useThanksCelebration(preview?.thankedRecipientCount ?? 0);

  if (preview == null) {
    return null;
  }

  const { state, pendingRecipientCount } = NudgeThanksPreviewPolicy.getThanksSummary(preview);
  const thanksButtonLabel = t('interaction.thanksQuickActionLabel', {
    count: pendingRecipientCount,
  });

  return match(state)
    .with('NONE', () => null)
    .with('PENDING', () => (
      <ThanksSummaryCard
        tone="highlighted"
        left={<RecipientAvatars recipients={preview.items} />}
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
            onPress={onOpenThanks}
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
      <ThanksSummaryCard
        tone="neutral"
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
      <ThanksSummaryCard
        tone="neutral"
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
            onPress={onOpenThanks}
          >
            {t('interaction.thanksSendMore')}
          </ThanksButton>
        }
      />
    ))
    .exhaustive();
};

interface ThanksSummaryRowErrorProps
  extends QueryErrorFallbackProps, Pick<ComponentProps<typeof InlineAlert>, 'className'> {
  /** 시트 안에서는 시트를 닫고 문의 화면으로 가도록 바꿔 준다 */
  onInquiry?: () => void;
}

/** 고마움 보내기 입구라 숨기지 않고 같은 자리에 다시 시도·문의를 둔다. 다른 인라인 안내처럼 조용히 알린다 */
ThanksSummaryRow.Error = function ErrorFallback({
  reset,
  onInquiry,
  className,
}: ThanksSummaryRowErrorProps) {
  const { t } = useTranslation(['todo', 'common']);

  return (
    <InlineAlert
      className={className}
      description={t('todo:interaction.thanksLoadFailed')}
      action={
        <HStack align="center" gap={16}>
          <TextButton size="small" testID="thanks-summary-retry" onPress={reset}>
            {t('common:actions.retry')}
          </TextButton>
          <QueryErrorActions.Inquiry onPress={onInquiry} />
        </HStack>
      }
    />
  );
};

function useThanksCelebration(thankedRecipientCount: number) {
  const haptics = useHaptics();
  const isReducedMotion = useIsReduceMotionEnabled();
  const scale = useSharedValue(1);
  const previousCount = useRef(thankedRecipientCount);

  useEffect(() => {
    if (thankedRecipientCount <= previousCount.current) {
      previousCount.current = thankedRecipientCount;
      return;
    }
    previousCount.current = thankedRecipientCount;
    haptics.notify('success');
    if (isReducedMotion) {
      return;
    }
    scale.set(withSequence(withSpring(1.2, HEART_SPRING), withSpring(1, HEART_SPRING)));
  }, [thankedRecipientCount, isReducedMotion, scale, haptics]);

  return useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
}

interface ThanksSummaryCardProps {
  tone: 'highlighted' | 'neutral';
  left: ReactNode;
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
}

function ThanksSummaryCard({ tone, left, title, description, action }: ThanksSummaryCardProps) {
  const { fontScale } = useFontScale();
  const isActionStacked = fontScale === 'xlarge';

  // 자리를 잡지 않고 받은 뒤에 나타나는 카드라 튀어나오지 않게 페이드로 들인다
  return (
    <Animated.View entering={FadeIn.duration(ANIMATION.durationMs.normal)}>
      <HStack
        align="center"
        gap={12}
        wrap={isActionStacked ? 'wrap' : 'nowrap'}
        className={cn(
          'min-h-16 rounded-2xl py-3 pl-4 pr-3',
          tone === 'highlighted' ? 'bg-main/8 dark:bg-main/20' : 'bg-gray-2',
        )}
      >
        {left}
        <VStack flex={1} gap={2} className="min-w-0">
          {title}
          {description}
        </VStack>
        {action != null && <Box className={cn(isActionStacked && 'w-full')}>{action}</Box>}
      </HStack>
    </Animated.View>
  );
}

function CardTitle({ children }: { children: string }) {
  return (
    <Text size="b3" weight="semibold" shade={9} numberOfLines={2}>
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

function RecipientAvatars({ recipients }: { recipients: NudgeThanksRecipient[] }) {
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

function LastThankedAt({ lastThankedAt }: { lastThankedAt: Instant | null }) {
  const dateFormatContext = useDateFormatContext();
  const now = useMinuteNow();

  if (lastThankedAt == null) {
    return null;
  }

  return (
    <CardDescription>
      {formatRelativeTimeLabel(lastThankedAt, now, dateFormatContext)}
    </CardDescription>
  );
}
