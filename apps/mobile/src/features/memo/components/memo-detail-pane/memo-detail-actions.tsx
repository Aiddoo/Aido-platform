import { useTranslation } from '@src/shared/i18n';
import { ArrowLeftIcon, CheckmarkIcon, PinFilledIcon, PinIcon, TrashIcon } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';

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

export function MemoBackButton(props: MemoActionProps) {
  const { t } = useTranslation('common');

  return (
    <MemoActionButton
      accessibilityLabel={t('actions.goBack')}
      icon={<ArrowLeftIcon width={20} height={20} colorClassName="text-gray-9" />}
      {...props}
    />
  );
}

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

export function MemoDeleteButton(props: MemoActionProps) {
  const { t } = useTranslation('common');

  return (
    <MemoActionButton
      accessibilityLabel={t('actions.delete')}
      icon={<TrashIcon width={20} height={20} colorClassName="text-gray-9" />}
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
      className={cn('rounded-full', isHighlighted ? 'bg-main' : 'bg-gray-4', className)}
      icon={<CheckmarkIcon width={20} height={20} colorClassName="text-white dark:text-gray-9" />}
      {...props}
    />
  );
}
