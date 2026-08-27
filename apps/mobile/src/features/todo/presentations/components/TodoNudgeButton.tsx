import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import { PawIcon, useOverlay, usePremiumDialog } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps } from 'react';

import { NudgeBottomSheet, type NudgeReceiver, type NudgeTargetTodo } from './NudgeBottomSheet';

interface TodoNudgeButtonProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'children' | 'onPress'
> {
  receiver: NudgeReceiver;
  todo: NudgeTargetTodo;
  isLimitReached: boolean;
}

/** 친구 할 일 목록과 상세가 공유하는 넛지 진입점. 시트와 한도 UX도 이곳에서 한 번만 조립한다. */
export function TodoNudgeButton({
  receiver,
  todo,
  isLimitReached,
  isDisabled,
  className,
  hitSlop,
  accessibilityRole,
  accessibilityLabel,
  accessibilityState,
  ...pressableProps
}: TodoNudgeButtonProps) {
  const { t } = useTranslation('todo');
  const { trackEvent } = useTrack();
  const overlay = useOverlay();
  const premiumDialog = usePremiumDialog();

  const openNudgeSheet = () => {
    overlay
      .open(({ isOpen, close, exit }) => (
        <NudgeBottomSheet
          receiver={receiver}
          todo={todo}
          isOpen={isOpen}
          onOpenChange={(open) => {
            if (!open) {
              close();
              exit();
            }
          }}
        />
      ))
      .catch(() => undefined);
  };

  const handlePress = () => {
    if (isLimitReached) {
      trackEvent('premium_gate_shown', { feature: 'friend_todo_view' });
      premiumDialog.open({
        title: t('nudge.limitTitle'),
        description: t('nudge.subscribeUnlimited'),
      });
      return;
    }

    openNudgeSheet();
  };

  return (
    <PressableFeedback
      {...pressableProps}
      onPress={handlePress}
      hitSlop={hitSlop ?? 8}
      isDisabled={isDisabled}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel ?? t('friendTodo.nudge')}
      accessibilityState={{ ...accessibilityState, disabled: isDisabled }}
      className={cn('min-h-11 min-w-11 items-center justify-center', className)}
    >
      <PawIcon width={18} height={18} colorClassName="text-gray-6" />
    </PressableFeedback>
  );
}
