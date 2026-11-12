import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useOnScreenBlur } from '@src/shared/hooks/use-on-screen-blur';
import { useTranslation } from '@src/shared/i18n';
import { MicIcon, PauseIcon } from '@src/shared/ui';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps } from 'react';
import { useRef } from 'react';
import { Keyboard } from 'react-native';

import { useDictation } from '../hooks/use-dictation';

interface DictationButtonProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'children' | 'onPress' | 'onChange' | 'className' | 'style'
> {
  value: string;
  onChange: (value: string) => void;
}

export function DictationButton({ value, onChange, ...pressableProps }: DictationButtonProps) {
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
    Keyboard.dismiss();
    baseTextRef.current = value.trim().length > 0 ? `${value.trim()} ` : '';
    start();
  };

  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={isListening ? t('dictation.stop') : t('dictation.start')}
      {...pressableProps}
      onPress={handlePress}
      className="size-9 items-center justify-center rounded-full bg-main/10"
    >
      {isListening ? (
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
      )}
    </PressableFeedback>
  );
}
