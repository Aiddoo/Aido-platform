import { useTranslation } from '@src/shared/i18n';
import { useThemeModeSetting } from '@src/shared/preferences/use-theme-mode-setting';
import {
  DeviceDuoIcon,
  MoonDuoIcon,
  SettingsListGroup,
  SettingsScreenLayout,
  SunDuoIcon,
} from '@src/shared/ui';
import { Stack } from 'expo-router';
import { RadioGroup } from 'heroui-native';

export default function ThemeSettingsScreen() {
  const { mode, changeMode } = useThemeModeSetting();
  const { t } = useTranslation('settings');

  return (
    <>
      <Stack.Screen options={{ title: t('titles.theme') }} />

      <SettingsScreenLayout>
        <SettingsListGroup label={t('theme.label')}>
          <RadioGroup value={mode} onValueChange={changeMode} className="gap-0">
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
