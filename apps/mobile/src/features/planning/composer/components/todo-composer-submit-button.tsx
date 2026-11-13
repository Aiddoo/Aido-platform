import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { useTranslation } from '@src/shared/i18n';
import { ArrowUpIcon, IconButton, type IconButtonProps } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { Spinner } from 'heroui-native';

interface TodoComposerSubmitButtonProps extends Omit<
  IconButtonProps,
  'icon' | 'accessibilityLabel'
> {
  isSubmitting: boolean;
}

// 큰 글꼴에서도 작성 줄 버튼(지우기·말하기·보내기)이 늘어나지 않게 칸은 36pt로 두고 아이콘만 키운다
export function TodoComposerSubmitButton({
  isDisabled = false,
  isSubmitting,
  className,
  ...props
}: TodoComposerSubmitButtonProps) {
  const { t } = useTranslation('todo');
  const fontScaledSize = useFontScaledSize();
  const spinnerColor = useResolvedColor('text-white');

  return (
    <IconButton
      accessibilityLabel={t('add.save')}
      accessibilityState={{ disabled: isDisabled, busy: isSubmitting }}
      icon={
        isSubmitting ? (
          <Spinner size="sm" color={spinnerColor} />
        ) : (
          <ArrowUpIcon
            width={fontScaledSize(18)}
            height={fontScaledSize(18)}
            colorClassName="text-white"
          />
        )
      }
      hitSlop={4}
      isDisabled={isDisabled}
      className={cn(
        'size-9 min-h-0 min-w-0 rounded-4xl',
        isDisabled && 'bg-gray-3',
        !isDisabled && 'bg-main',
        className,
      )}
      {...props}
    />
  );
}
