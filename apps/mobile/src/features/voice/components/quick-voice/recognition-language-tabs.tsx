import { SPEECH_LOCALES, type SpeechLocale } from '@src/core/ports/speech-recognizer';
import { useTranslation } from '@src/shared/i18n';
import { SegmentTabTrigger } from '@src/shared/ui';
import { Tabs } from 'heroui-native';
import type { ComponentProps } from 'react';

interface RecognitionLanguageTabsProps extends Omit<
  ComponentProps<typeof Tabs>,
  'value' | 'onValueChange' | 'children'
> {
  value: SpeechLocale;
  onValueChange: (locale: SpeechLocale) => void;
}

export function RecognitionLanguageTabs({
  value,
  onValueChange,
  ...tabsProps
}: RecognitionLanguageTabsProps) {
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
        <SegmentTabTrigger
          value="ko-KR"
          testID="recognition-language-ko"
          size="b2"
          numberOfLines={1}
        >
          {t('language.ko')}
        </SegmentTabTrigger>
        <SegmentTabTrigger
          value="en-US"
          testID="recognition-language-en"
          size="b2"
          numberOfLines={1}
        >
          {t('language.en')}
        </SegmentTabTrigger>
      </Tabs.List>
    </Tabs>
  );
}
