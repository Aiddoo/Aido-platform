import { INVITEE_PREMIUM_DAYS } from '@src/features/social/invite/constants/invite.constants';
import { InvitePolicy } from '@src/features/social/invite/domains/invite.model';
import { useIsInviteAvailable } from '@src/features/social/invite/hooks/use-is-invite-available';
import { useOpenMyInvite } from '@src/features/social/invite/hooks/use-open-my-invite';
import { useGetInviteQueryOptions } from '@src/features/social/invite/queries/invite.queries';
import { ANIMATION } from '@src/shared/constants/animation';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { Box, CheckmarkIcon, HStack, LabelChip, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useQuery } from '@tanstack/react-query';
import { PressableFeedback } from 'heroui-native';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useActivationChecklist } from '../hooks/use-activation-checklist';

interface ActivationChecklistProps {
  className?: string;
}

export function ActivationChecklist({ className }: ActivationChecklistProps) {
  const { t } = useTranslation(['todo', 'invite']);
  const { steps, isVisible } = useActivationChecklist();
  const isInviteAvailable = useIsInviteAvailable();
  // 초대 요약은 기능이 켜진 걸 확인한 뒤에만 부른다(꺼져 있으면 서버가 거절한다)
  const { data: invite } = useQuery({
    ...useGetInviteQueryOptions(),
    enabled: isInviteAvailable,
    throwOnError: false,
  });
  const openMyInvite = useOpenMyInvite();
  // 끝나서 숨길 때도 접히는 동안은 그려 두어 아래 목록이 한 번에 뛰지 않게 한다
  const [isMounted, setIsMounted] = useState(isVisible);
  // 첫 화면부터 보이던 카드는 그대로 두고, 조회가 끝난 뒤 늦게 나타나는 카드만 펼치며 보여 아래 목록이 뛰지 않게 한다
  const [isRevealedLate] = useState(!isVisible);
  if (isVisible && !isMounted) {
    setIsMounted(true);
  }
  const handleCollapsed = useCallback(() => setIsMounted(false), []);

  if (!isMounted) {
    return null;
  }

  return (
    <ActivationChecklistCollapse
      isOpen={isVisible}
      isRevealedLate={isRevealedLate}
      onCollapsed={handleCollapsed}
    >
      <VStack
        gap={12}
        className={cn('rounded-2xl border border-gray-2 bg-gray-1 p-4', className)}
        accessibilityLabel={t('activation.accessibilityLabel')}
      >
        <VStack gap={2}>
          <Text size="b2" weight="semibold">
            {t('activation.title')}
          </Text>
          <Text size="b4" shade={6}>
            {t('activation.description')}
          </Text>
        </VStack>

        <ActivationStep label={t('activation.createTodo')} isCompleted={steps.hasCreatedTodo} />
        <ActivationStep label={t('activation.completeTodo')} isCompleted={steps.hasCompletedTodo} />
        {isInviteAvailable && (
          <ActivationInviteStep
            isCompleted={invite != null && InvitePolicy.hasInvitedAnyone(invite)}
            onPress={() => openMyInvite('activation_checklist')}
          />
        )}
      </VStack>
    </ActivationChecklistCollapse>
  );
}

interface ActivationChecklistCollapseProps {
  isOpen: boolean;
  isRevealedLate: boolean;
  onCollapsed: () => void;
  children: ReactNode;
}

/** 늦게 나타나면 0에서 펼치고, 닫히면 지금 높이에서 0으로 접고 흐리게 한 뒤 알린다. 동작 줄이기 설정이면 바로 바뀐다 */
function ActivationChecklistCollapse({
  isOpen,
  isRevealedLate,
  onCollapsed,
  children,
}: ActivationChecklistCollapseProps) {
  const contentHeight = useSharedValue(0);
  const progress = useSharedValue(isRevealedLate ? 0 : 1);

  useEffect(() => {
    if (isOpen) {
      progress.set(
        withTiming(1, { duration: ANIMATION.durationMs.slow, reduceMotion: ReduceMotion.System }),
      );
      return;
    }
    progress.set(
      withTiming(
        0,
        { duration: ANIMATION.durationMs.slow, reduceMotion: ReduceMotion.System },
        (isFinished) => {
          if (isFinished) {
            scheduleOnRN(onCollapsed);
          }
        },
      ),
    );
  }, [isOpen, onCollapsed, progress]);

  // Reanimated는 빠진 키를 되돌리지 않아 height를 명시해야 애니메이션 값이 굳지 않는다
  const animatedStyle = useAnimatedStyle(() =>
    progress.get() === 1
      ? { height: 'auto', opacity: 1 }
      : { height: contentHeight.get() * progress.get(), opacity: progress.get() },
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    contentHeight.set(event.nativeEvent.layout.height);
  };

  return (
    <Animated.View style={[{ overflow: 'hidden' }, animatedStyle]}>
      <Box onLayout={handleLayout}>{children}</Box>
    </Animated.View>
  );
}

interface ActivationInviteStepProps {
  isCompleted: boolean;
  onPress: () => void;
}

/** 친구 초대는 선택 단계다. 앞의 두 단계를 끝내면 초대 전이라도 체크리스트를 마친다 */
function ActivationInviteStep({ isCompleted, onPress }: ActivationInviteStepProps) {
  const { t } = useTranslation(['todo', 'invite']);
  const label = t('invite:entry.checklistStep');
  const reward = t('invite:entry.checklistReward', {
    days: INVITEE_PREMIUM_DAYS,
  });
  const status = isCompleted ? t('activation.completed') : t('activation.incomplete');

  return (
    <PressableFeedback
      isDisabled={isCompleted}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('activation.stepAccessibilityLabel', {
        label: isCompleted ? label : `${label}, ${reward}`,
        status,
      })}
      accessibilityState={{ checked: isCompleted, disabled: isCompleted }}
    >
      <ActivationStep label={label} isCompleted={isCompleted} reward={reward} />
    </PressableFeedback>
  );
}

interface ActivationStepProps {
  label: string;
  isCompleted: boolean;
  /** 단계를 마치면 받는 보상. 단계 이름 아래 칩으로 보여 큰 글자에서도 이름을 좁히지 않는다 */
  reward?: string;
}

function ActivationStep({ label, isCompleted, reward }: ActivationStepProps) {
  const { t } = useTranslation('todo');
  const status = isCompleted ? t('activation.completed') : t('activation.incomplete');
  const hasReward = reward != null && !isCompleted;

  return (
    <HStack
      gap={10}
      align={hasReward ? 'start' : 'center'}
      accessible
      accessibilityRole="text"
      accessibilityLabel={t('activation.stepAccessibilityLabel', { label, status })}
      accessibilityState={{ checked: isCompleted }}
    >
      <ActivationStepIndicator isCompleted={isCompleted} />
      <VStack flex={1} gap={6} align="start">
        <Text
          size="b3"
          weight={isCompleted ? 'medium' : 'normal'}
          shade={isCompleted ? 5 : 8}
          lineBreakStrategyIOS="hangul-word"
          textBreakStrategy="highQuality"
        >
          {label}
        </Text>
        {/* 초대 단계는 PressableFeedback 안이라 Pressable인 Chip이 탭을 가로채지 않게 한다 */}
        {hasReward && (
          <LabelChip
            color="accent"
            label={reward}
            labelProps={{
              weight: 'semibold',
              lineBreakStrategyIOS: 'hangul-word',
              textBreakStrategy: 'highQuality',
              className: 'shrink',
            }}
            className="max-w-full"
            pointerEvents="none"
          />
        )}
      </VStack>
    </HStack>
  );
}

interface ActivationStepIndicatorProps {
  isCompleted: boolean;
}

// white 토큰은 다크 모드에서 어두워져 체크는 Avatar 선택 배지 색을 쓰고, 두 상태 크기·테두리를 같게 둬 행이 움직이지 않는다
function ActivationStepIndicator({ isCompleted }: ActivationStepIndicatorProps) {
  const fontScaledSize = useFontScaledSize();
  const size = fontScaledSize(24);
  const checkSize = fontScaledSize(14);

  return (
    <Box
      style={{ width: size, height: size }}
      className={cn(
        'items-center justify-center rounded-full border-[1.5px]',
        isCompleted ? 'border-main bg-main' : 'border-gray-5',
      )}
    >
      {isCompleted && (
        <CheckmarkIcon
          width={checkSize}
          height={checkSize}
          colorClassName="text-white dark:text-gray-9"
        />
      )}
    </Box>
  );
}
