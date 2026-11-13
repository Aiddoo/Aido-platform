import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import { APP_LOCALES } from '@src/shared/i18n/app-locales';
import { isLanguageMode } from '@src/shared/preferences/language.preference';
import { useLanguage } from '@src/shared/providers/language-provider';
import {
  DeviceDuoIcon,
  EnglishDuoIcon,
  KoreanDuoIcon,
  SettingsListGroup,
  SettingsScreenLayout,
} from '@src/shared/ui';
import { Stack } from 'expo-router';
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
    <>
      <Stack.Screen options={{ title: t('titles.language') }} />

      <SettingsScreenLayout>
        <SettingsListGroup label={t('language.label')}>
          <RadioGroup value={languageMode} onValueChange={handleChange} className="gap-0">
            <SettingsListGroup.Radio
              value="system"
              label={t('language.system')}
              description={t('language.systemDescription')}
              icon={<SettingsListGroup.Icon Icon={DeviceDuoIcon} />}
              testID="language-option-system"
            />
            <SettingsListGroup.Separator />
            {/* 언어 이름은 그 언어를 읽는 사람이 찾도록 번역하지 않는다 */}
            <SettingsListGroup.Radio
              value="ko"
              label={APP_LOCALES.ko.nativeName}
              icon={<SettingsListGroup.Icon Icon={KoreanDuoIcon} />}
              testID="language-option-ko"
            />
            <SettingsListGroup.Separator />
            <SettingsListGroup.Radio
              value="en"
              label={APP_LOCALES.en.nativeName}
              icon={<SettingsListGroup.Icon Icon={EnglishDuoIcon} />}
              testID="language-option-en"
            />
          </RadioGroup>
        </SettingsListGroup>
      </SettingsScreenLayout>
    </>
  );
}

export default LanguageSettingsScreen;
