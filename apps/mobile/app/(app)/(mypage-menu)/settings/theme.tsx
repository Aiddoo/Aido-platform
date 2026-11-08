import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import { isThemeMode } from '@src/shared/preferences/theme-mode.preference';
import { useTheme } from '@src/shared/providers/theme-provider';
import {
  DeviceIcon,
  MoonFilledIcon,
  SettingsListGroup,
  SettingsScreenLayout,
  SunIcon,
} from '@src/shared/ui';
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
      <SettingsListGroup>
        <RadioGroup value={mode} onValueChange={handleThemeChange} className="gap-0">
          <IconRadioItem value="system" label={t('theme.system')} Icon={DeviceIcon} />
          <SettingsListGroup.Separator />
          <IconRadioItem value="light" label={t('theme.light')} Icon={SunIcon} />
          <SettingsListGroup.Separator />
          <IconRadioItem value="dark" label={t('theme.dark')} Icon={MoonFilledIcon} />
        </RadioGroup>
      </SettingsListGroup>
    </SettingsScreenLayout>
  );
}

export default ThemeSettingsScreen;
