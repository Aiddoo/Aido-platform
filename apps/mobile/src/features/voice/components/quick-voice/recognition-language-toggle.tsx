import { SPEECH_LOCALES, type SpeechLocale } from '@src/core/ports/speech-recognizer';
import { useTranslation } from '@src/shared/i18n';
import { Tabs } from 'heroui-native';
import type { ComponentProps } from 'react';

interface RecognitionLanguageToggleProps extends Omit<
  ComponentProps<typeof Tabs>,
  'value' | 'onValueChange' | 'children'
> {
  value: SpeechLocale;
  onValueChange: (locale: SpeechLocale) => void;
}

/** 말하는 언어(한국어·English). 한 줄이어야 하므로 라벨은 줄바꿈하지 않는다 */
export function RecognitionLanguageToggle({
  value,
  onValueChange,
  ...tabsProps
}: RecognitionLanguageToggleProps) {
  const { t } = useTranslation('voice');

  return (
    <Tabs
      {...tabsProps}
      value={value}
      onValueChange={(next) => {
        const locale = SPEECH_LOCALES.find((candidate) => candidate === next);
        if (locale != null) {
          onValueChange(locale);
        }
      }}
    >
      <Tabs.List>
        <Tabs.Indicator />
        <Tabs.Trigger value="ko-KR" testID="recognition-language-ko">
          <Tabs.Label numberOfLines={1}>{t('language.ko')}</Tabs.Label>
        </Tabs.Trigger>
        <Tabs.Trigger value="en-US" testID="recognition-language-en">
          <Tabs.Label numberOfLines={1}>{t('language.en')}</Tabs.Label>
        </Tabs.Trigger>
      </Tabs.List>
    </Tabs>
  );
}
