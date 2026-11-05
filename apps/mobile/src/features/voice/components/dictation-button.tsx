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
  'children' | 'onPress' | 'onChange'
> {
  value: string;
  onChange: (value: string) => void;
}

/** AI 없이 받아쓰기. 이미 적은 글 뒤에 들은 말을 이어 붙인다 */
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
      style={{ width: fontScaledSize(36), height: fontScaledSize(36) }}
      className="items-center justify-center rounded-full bg-main/10"
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
