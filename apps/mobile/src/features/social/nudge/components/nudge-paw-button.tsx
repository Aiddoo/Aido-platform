import { useTranslation } from '@src/shared/i18n';
import { PawIcon } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps } from 'react';

type NudgePawButtonProps = Omit<ComponentProps<typeof PressableFeedback>, 'children'>;

/** 콕 찌르기 발바닥 버튼. 할 일 콕과 친구 독촉 콕이 같은 모양을 쓴다 */
export function NudgePawButton({
  isDisabled,
  className,
  hitSlop,
  accessibilityRole,
  accessibilityLabel,
  accessibilityState,
  ...pressableProps
}: NudgePawButtonProps) {
  const { t } = useTranslation('todo');

  return (
    <PressableFeedback
      {...pressableProps}
      hitSlop={hitSlop ?? 8}
      isDisabled={isDisabled}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel ?? t('friendTodo.nudge')}
      accessibilityState={{ ...accessibilityState, disabled: isDisabled === true }}
      className={cn('min-h-11 min-w-11 items-center justify-center', className)}
    >
      <PawIcon
        width={18}
        height={18}
        colorClassName={isDisabled === true ? 'text-gray-5' : 'text-main'}
      />
    </PressableFeedback>
  );
}
