import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { useTranslation } from '@src/shared/i18n';
import { ArrowUpIcon } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback, Spinner } from 'heroui-native';
import type { ComponentProps } from 'react';

interface TodoComposerSubmitButtonProps extends Pick<
  ComponentProps<typeof PressableFeedback>,
  'isDisabled' | 'onPress' | 'testID'
> {
  isSubmitting: boolean;
}

export function TodoComposerSubmitButton({
  isDisabled,
  isSubmitting,
  onPress,
  testID,
}: TodoComposerSubmitButtonProps) {
  const { t } = useTranslation('todo');
  const fontScaledSize = useFontScaledSize();
  const spinnerColor = useResolvedColor('text-white');

  return (
    <PressableFeedback
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={t('add.save')}
      accessibilityState={{ disabled: isDisabled === true, busy: isSubmitting }}
      isDisabled={isDisabled}
      onPress={onPress}
      style={{ width: fontScaledSize(36), height: fontScaledSize(36) }}
      className={cn(
        'items-center justify-center rounded-4xl',
        isDisabled ? 'bg-gray-3' : 'bg-main',
      )}
    >
      {isSubmitting ? (
        <Spinner size="sm" color={spinnerColor} />
      ) : (
        <ArrowUpIcon
          width={fontScaledSize(18)}
          height={fontScaledSize(18)}
          colorClassName="text-white"
        />
      )}
    </PressableFeedback>
  );
}
