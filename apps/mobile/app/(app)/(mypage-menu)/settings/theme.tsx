import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import { isThemeMode } from '@src/shared/preferences/theme-mode.preference';
import { useTheme } from '@src/shared/providers/theme-provider';
import { DeviceIcon, MoonIcon, SettingsCard, SettingsScreenLayout, SunIcon } from '@src/shared/ui';
import { IconRadioItem } from '@src/shared/ui/icon-radio-item';
import { RadioGroup } from 'heroui-native';

function ThemeSettingsScreen() {
  const { mode, setMode } = useTheme();
  const { t } = useTranslation('settings');
  const { trackEvent } = useTrack();

  const handleThemeChange = (value: string) => {
    if (!isThemeMode(value)) {
      return;
    }
    setMode(value);
    trackEvent('settings_changed', { setting: 'theme', value });
  };

  return (
    <SettingsScreenLayout>
      <SettingsCard>
        <RadioGroup value={mode} onValueChange={handleThemeChange} className="gap-0">
          <IconRadioItem value="system" label={t('theme.system')} Icon={DeviceIcon} />
          <SettingsCard.Separator />
          <IconRadioItem value="light" label={t('theme.light')} Icon={SunIcon} />
          <SettingsCard.Separator />
          <IconRadioItem value="dark" label={t('theme.dark')} Icon={MoonIcon} />
        </RadioGroup>
      </SettingsCard>
    </SettingsScreenLayout>
  );
}

export default ThemeSettingsScreen;
