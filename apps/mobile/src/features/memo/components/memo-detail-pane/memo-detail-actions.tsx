import Check from '@expo/material-symbols/check.xml';
import Keep from '@expo/material-symbols/keep.xml';
import { useTranslation } from '@src/shared/i18n';
import { CheckmarkIcon, PinFilledIcon, PinIcon } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';

/** 메모 화면 네이티브 헤더 버튼 아이콘. iOS는 SF Symbol, Android는 Material Symbol을 쓴다. */
export const MEMO_TOOLBAR_ICON = {
  pin: process.env.EXPO_OS === 'ios' ? 'pin' : Keep,
  pinned: process.env.EXPO_OS === 'ios' ? 'pin.fill' : Keep,
  save: process.env.EXPO_OS === 'ios' ? 'checkmark' : Check,
} as const;

type MemoActionButtonProps = Omit<ComponentProps<typeof PressableFeedback>, 'children'> & {
  icon: ReactNode;
  accessibilityLabel: string;
};

export function MemoActionButton({ icon, className, ...props }: MemoActionButtonProps) {
  return (
    <PressableFeedback
      accessibilityRole="button"
      hitSlop={4}
      className={cn('items-center justify-center p-2', className)}
      {...props}
    >
      {icon}
    </PressableFeedback>
  );
}

type MemoActionProps = Omit<MemoActionButtonProps, 'icon' | 'accessibilityLabel'>;

interface MemoPinButtonProps extends MemoActionProps {
  isPinned: boolean;
}

export function MemoPinButton({ isPinned, ...props }: MemoPinButtonProps) {
  const { t } = useTranslation('memo');

  return (
    <MemoActionButton
      accessibilityLabel={t(isPinned ? 'detail.unpin' : 'detail.pin')}
      icon={
        isPinned ? (
          <PinFilledIcon width={20} height={20} colorClassName="text-main" />
        ) : (
          <PinIcon width={20} height={20} colorClassName="text-gray-9" />
        )
      }
      {...props}
    />
  );
}

interface MemoSaveButtonProps extends MemoActionProps {
  isHighlighted: boolean;
}

export function MemoSaveButton({ isHighlighted, className, ...props }: MemoSaveButtonProps) {
  const { t } = useTranslation('common');

  return (
    <MemoActionButton
      accessibilityLabel={t('actions.save')}
      className={cn('rounded-full', isHighlighted && 'bg-main', className)}
      icon={
        <CheckmarkIcon
          width={20}
          height={20}
          colorClassName={isHighlighted ? 'text-white dark:text-gray-9' : 'text-gray-5'}
        />
      }
      {...props}
    />
  );
}
