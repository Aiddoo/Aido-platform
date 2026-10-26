import { InviteRewardPolicy } from '@src/features/invite/domains/invite-reward.model';
import { useInviteActivationStep } from '@src/features/invite/hooks/use-invite-activation-step';
import { useOpenMyInvite } from '@src/features/invite/hooks/use-open-my-invite';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { Box, CheckIcon, HStack, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
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

import { useActivationChecklist } from '../hooks/use-activation-progress';

interface ActivationChecklistProps {
  className?: string;
}

export function ActivationChecklist({ className }: ActivationChecklistProps) {
  const { t } = useTranslation(['todo', 'invite']);
  const { steps, isVisible } = useActivationChecklist();
  const inviteStep = useInviteActivationStep();
  const openMyInvite = useOpenMyInvite();
  // 끝나서 숨길 때도 접히는 동안은 그려 두어 아래 목록이 한 번에 뛰지 않게 한다
  const [isMounted, setIsMounted] = useState(isVisible);
  if (isVisible && !isMounted) {
    setIsMounted(true);
  }
  const handleCollapsed = useCallback(() => setIsMounted(false), []);

  if (!isMounted) {
    return null;
  }

  return (
    <ActivationChecklistCollapse isOpen={isVisible} onCollapsed={handleCollapsed}>
      <VStack
        gap={12}
        className={cn('rounded-2xl border border-gray-2 bg-white p-4', className)}
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
        {inviteStep.isVisible && (
          <ActivationInviteStep
            isCompleted={inviteStep.isCompleted}
            onPress={() => openMyInvite('activation_checklist')}
          />
        )}
      </VStack>
    </ActivationChecklistCollapse>
  );
}

interface ActivationChecklistCollapseProps {
  isOpen: boolean;
  onCollapsed: () => void;
  children: ReactNode;
}

/** 닫히면 지금 높이에서 0으로 접고 흐리게 한 뒤 알린다. 동작 줄이기 설정이면 바로 닫힌다 */
function ActivationChecklistCollapse({
  isOpen,
  onCollapsed,
  children,
}: ActivationChecklistCollapseProps) {
  const contentHeight = useSharedValue(0);
  const progress = useSharedValue(1);

  useEffect(() => {
    if (isOpen) {
      progress.set(1);
      return;
    }
    progress.set(
      withTiming(
        0,
        { duration: ANIMATION.duration.slow, reduceMotion: ReduceMotion.System },
        (isFinished) => {
          if (isFinished) {
            scheduleOnRN(onCollapsed);
          }
        },
      ),
    );
  }, [isOpen, onCollapsed, progress]);

  const animatedStyle = useAnimatedStyle(() =>
    progress.get() === 1
      ? { opacity: 1 }
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
    days: InviteRewardPolicy.welcomePremiumDays(),
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
  /** 단계를 마치면 받는 보상(오른쪽 강조 문구) */
  reward?: string;
}

function ActivationStep({ label, isCompleted, reward }: ActivationStepProps) {
  const fontScaledSize = useFontScaledSize();
  const { t } = useTranslation('todo');
  const status = isCompleted ? t('activation.completed') : t('activation.incomplete');

  return (
    <HStack
      gap={10}
      align="center"
      accessible
      accessibilityRole="text"
      accessibilityLabel={t('activation.stepAccessibilityLabel', { label, status })}
      accessibilityState={{ checked: isCompleted }}
    >
      <Box
        className={cn(
          'size-6 items-center justify-center rounded-full border',
          isCompleted ? 'border-main bg-main' : 'border-gray-4 bg-white',
        )}
      >
        {isCompleted && (
          <CheckIcon
            width={fontScaledSize(14)}
            height={fontScaledSize(14)}
            colorClassName="text-white"
          />
        )}
      </Box>
      <Text
        size="b3"
        weight={isCompleted ? 'medium' : 'normal'}
        shade={isCompleted ? 5 : 8}
        className="flex-1"
      >
        {label}
      </Text>
      {/* 보상 문구가 길어도 단계 이름이 글자 단위로 꺾이지 않게 행의 절반까지만 쓰고 줄바꿈한다 */}
      {reward != null && !isCompleted && (
        <Text size="e1" weight="bold" tone="brand" align="right" className="max-w-[50%] shrink">
          {reward}
        </Text>
      )}
    </HStack>
  );
}
