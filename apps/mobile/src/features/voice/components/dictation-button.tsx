import { useDismissKeyboard } from '@src/shared/hooks/use-dismiss-keyboard';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useOnScreenBlur } from '@src/shared/hooks/use-on-screen-blur';
import { useTranslation } from '@src/shared/i18n';
import { IconButton, type IconButtonProps, MicIcon, PauseIcon } from '@src/shared/ui';
import { useRef } from 'react';

import { useDictation } from '../hooks/use-dictation';

interface DictationButtonProps extends Omit<
  IconButtonProps,
  'icon' | 'accessibilityLabel' | 'onPress' | 'onChange' | 'className' | 'style'
> {
  value: string;
  onChange: (value: string) => void;
}

export function DictationButton({ value, onChange, ...pressableProps }: DictationButtonProps) {
  const dismissKeyboard = useDismissKeyboard();
  const { t } = useTranslation('voice');
  const fontScaledSize = useFontScaledSize();
  const baseTextRef = useRef('');
  const { isListening, start, stop } = useDictation({
    onResult: (transcript) => onChange(`${baseTextRef.current}${transcript}`),
  });
  useOnScreenBlur(() => {
    if (isListening) {
      stop();
    }
  });

  const handlePress = () => {
    if (isListening) {
      stop();
      return;
    }
    dismissKeyboard();
    baseTextRef.current = value.trim().length > 0 ? `${value.trim()} ` : '';
    start();
  };

  return (
    <IconButton
      accessibilityLabel={isListening ? t('dictation.stop') : t('dictation.start')}
      icon={
        isListening ? (
          <PauseIcon
            width={fontScaledSize(20)}
            height={fontScaledSize(20)}
            colorClassName="text-error"
          />
        ) : (
          <MicIcon
            width={fontScaledSize(20)}
            height={fontScaledSize(20)}
            colorClassName="text-main"
          />
        )
      }
      hitSlop={4}
      {...pressableProps}
      onPress={handlePress}
      className="size-9 min-h-0 min-w-0 rounded-full bg-main/10"
    />
  );
}
