import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import { isLanguageMode } from '@src/shared/preferences/language.preference';
import { useLanguage } from '@src/shared/providers/language-provider';
import {
  DeviceIcon,
  EnglishIcon,
  KoreanIcon,
  SettingsCard,
  SettingsScreenLayout,
} from '@src/shared/ui';
import { IconRadioItem } from '@src/shared/ui/icon-radio-item';
import { RadioGroup } from 'heroui-native';

function LanguageSettingsScreen() {
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
    <SettingsScreenLayout>
      <SettingsCard>
        <RadioGroup value={languageMode} onValueChange={handleChange} className="gap-0">
          <IconRadioItem
            value="system"
            label={t('language.system')}
            description={t('language.systemDescription')}
            Icon={DeviceIcon}
            testID="language-option-system"
          />
          <SettingsCard.Separator />
          {/* 언어 이름은 해당 언어로 고정 표기한다 (번역하지 않음) */}
          <IconRadioItem value="ko" label="한국어" Icon={KoreanIcon} testID="language-option-ko" />
          <SettingsCard.Separator />
          <IconRadioItem
            value="en"
            label="English"
            Icon={EnglishIcon}
            testID="language-option-en"
          />
        </RadioGroup>
      </SettingsCard>
    </SettingsScreenLayout>
  );
}

export default LanguageSettingsScreen;
