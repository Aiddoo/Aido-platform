import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import { isLanguageMode, type LanguageMode } from '@src/shared/preferences/language.preference';
import { useLanguage } from '@src/shared/providers/language-provider';
import { StyledSafeAreaView } from '@src/shared/ui';
import { Radio, RadioGroup } from 'heroui-native';
import { Text as RNText, ScrollView, View } from 'react-native';

const LanguageSettingsScreen = () => {
  const { languageMode, setLanguageMode } = useLanguage();
  const { t } = useTranslation('settings');
  const { trackEvent } = useTrack();

  const handleChange = (value: string) => {
    if (!isLanguageMode(value)) {
      return;
    }
    setLanguageMode(value);
    trackEvent('settings_changed', { setting: 'language', value });
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1 py-5" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <RadioGroup
          value={languageMode}
          onValueChange={handleChange}
          className="bg-white rounded-2xl overflow-hidden gap-0"
        >
          <LanguageRadioItem
            value="system"
            label={t('language.system')}
            description={t('language.systemDescription')}
          />
          {/* 언어 이름은 해당 언어로 고정 표기한다 (번역하지 않음) */}
          <LanguageRadioItem value="ko" label="한국어" />
          <LanguageRadioItem value="en" label="English" />
        </RadioGroup>
      </ScrollView>
    </StyledSafeAreaView>
  );
};

export default LanguageSettingsScreen;

interface LanguageRadioItemProps {
  value: LanguageMode;
  label: string;
  description?: string;
}

function LanguageRadioItem({ value, label, description }: LanguageRadioItemProps) {
  return (
    <RadioGroup.Item value={value}>
      {() => (
        <View className="flex-row items-center gap-3 px-4 py-4">
          <View className="flex-1 gap-1">
            <RNText allowFontScaling={false} className="text-b3 font-semibold text-foreground">
              {label}
            </RNText>
            {description ? (
              <RNText allowFontScaling={false} className="text-b4 text-gray-6 font-normal">
                {description}
              </RNText>
            ) : null}
          </View>
          <Radio />
        </View>
      )}
    </RadioGroup.Item>
  );
}
