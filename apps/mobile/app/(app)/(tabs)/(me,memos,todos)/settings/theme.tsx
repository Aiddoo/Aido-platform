import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import { isThemeMode } from '@src/shared/preferences/theme-mode.preference';
import { useAppTheme } from '@src/shared/providers/theme-provider';
import {
  DeviceDuoIcon,
  MoonDuoIcon,
  SettingsListGroup,
  SettingsScreenLayout,
  SunDuoIcon,
} from '@src/shared/ui';
import { Stack } from 'expo-router';
import { RadioGroup } from 'heroui-native';

function ThemeSettingsScreen() {
  const { mode, setMode } = useAppTheme();
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
    <>
      <Stack.Screen options={{ title: t('titles.theme') }} />

      <SettingsScreenLayout>
        <SettingsListGroup label={t('theme.label')}>
          <RadioGroup value={mode} onValueChange={handleThemeChange} className="gap-0">
            <SettingsListGroup.Radio
              value="system"
              label={t('theme.system')}
              description={t('theme.systemDescription')}
              icon={<SettingsListGroup.Icon Icon={DeviceDuoIcon} />}
            />
            <SettingsListGroup.Separator />
            <SettingsListGroup.Radio
              value="light"
              label={t('theme.light')}
              icon={<SettingsListGroup.Icon Icon={SunDuoIcon} />}
            />
            <SettingsListGroup.Separator />
            <SettingsListGroup.Radio
              value="dark"
              label={t('theme.dark')}
              icon={<SettingsListGroup.Icon Icon={MoonDuoIcon} />}
            />
          </RadioGroup>
        </SettingsListGroup>
      </SettingsScreenLayout>
    </>
  );
}

export default ThemeSettingsScreen;
