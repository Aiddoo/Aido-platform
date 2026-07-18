import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import { isLanguageMode } from '@src/shared/preferences/language.preference';
import { useLanguage } from '@src/shared/providers/language-provider';
import { DeviceIcon, EnglishIcon, KoreanIcon, StyledSafeAreaView } from '@src/shared/ui';
import { RadioGroup } from 'heroui-native';
import { ScrollView } from 'react-native';
import { IconRadioItem } from './_components/icon-radio-item';

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
          <IconRadioItem
            value="system"
            label={t('language.system')}
            description={t('language.systemDescription')}
            Icon={DeviceIcon}
          />
          {/* 언어 이름은 해당 언어로 고정 표기한다 (번역하지 않음) */}
          <IconRadioItem value="ko" label="한국어" Icon={KoreanIcon} />
          <IconRadioItem value="en" label="English" Icon={EnglishIcon} />
        </RadioGroup>
      </ScrollView>
    </StyledSafeAreaView>
  );
};

export default LanguageSettingsScreen;
