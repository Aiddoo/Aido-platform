import { useTranslation } from '@src/shared/i18n';
import {
  ArrowLeftIcon,
  CheckboxIcon,
  CheckmarkIcon,
  HStack,
  PinFilledIcon,
  PinIcon,
  RobotIcon,
  TrashIcon,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

type MemoActionButtonProps = Omit<ComponentProps<typeof Pressable>, 'children'> & {
  icon: ReactNode;
  accessibilityLabel: string;
};

function MemoActionButton({ icon, className, ...props }: MemoActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={4}
      className={cn('items-center justify-center p-2', className)}
      {...props}
    >
      {icon}
    </Pressable>
  );
}

interface MemoDetailBackButtonProps {
  onPress: () => void;
}

export function MemoDetailBackButton({ onPress }: MemoDetailBackButtonProps) {
  const { t } = useTranslation('common');

  return (
    <MemoActionButton
      onPress={onPress}
      accessibilityLabel={t('actions.goBack')}
      icon={<ArrowLeftIcon width={20} height={20} colorClassName="text-gray-9" />}
    />
  );
}

interface MemoDetailActionBarProps {
  isPinned: boolean;
  isTogglePinDisabled: boolean;
  onTogglePin: () => void;
  isAiParseLoading: boolean;
  isAiParseDisabled: boolean;
  onAiParse: () => void;
  isConvertToTodoDisabled: boolean;
  onConvertToTodo: () => void;
  onDelete: () => void;
  isSaveVisible: boolean;
  isSaveDisabled: boolean;
  isSaveHighlighted: boolean;
  onSave: () => void;
}

export function MemoDetailActionBar({
  isPinned,
  isTogglePinDisabled,
  onTogglePin,
  isAiParseLoading,
  isAiParseDisabled,
  onAiParse,
  isConvertToTodoDisabled,
  onConvertToTodo,
  onDelete,
  isSaveVisible,
  isSaveDisabled,
  isSaveHighlighted,
  onSave,
}: MemoDetailActionBarProps) {
  const { t } = useTranslation(['memo', 'common']);

  return (
    <HStack gap={4} align="center">
      <MemoActionButton
        onPress={onTogglePin}
        accessibilityLabel={t(isPinned ? 'memo:detail.unpin' : 'memo:detail.pin')}
        disabled={isTogglePinDisabled}
        icon={
          isPinned ? (
            <PinFilledIcon width={20} height={20} colorClassName="text-main" />
          ) : (
            <PinIcon width={20} height={20} colorClassName="text-gray-9" />
          )
        }
      />
      <MemoActionButton
        onPress={onAiParse}
        accessibilityLabel={t('memo:titles.aiReview')}
        disabled={isAiParseDisabled}
        icon={
          isAiParseLoading ? (
            <ActivityIndicator size="small" />
          ) : (
            <RobotIcon width={20} height={20} colorClassName="text-gray-9" />
          )
        }
      />
      <MemoActionButton
        onPress={onConvertToTodo}
        accessibilityLabel={t('memo:detail.convertToTodo')}
        disabled={isConvertToTodoDisabled}
        icon={<CheckboxIcon width={20} height={20} colorClassName="text-gray-9" />}
      />
      <MemoActionButton
        onPress={onDelete}
        accessibilityLabel={t('common:actions.delete')}
        icon={<TrashIcon width={20} height={20} colorClassName="text-gray-9" />}
      />
      {isSaveVisible && (
        <MemoActionButton
          onPress={onSave}
          accessibilityLabel={t('common:actions.save')}
          disabled={isSaveDisabled}
          className={cn('rounded-full', isSaveHighlighted ? 'bg-main' : 'bg-gray-4')}
          icon={<CheckmarkIcon width={20} height={20} color="white" />}
        />
      )}
    </HStack>
  );
}
