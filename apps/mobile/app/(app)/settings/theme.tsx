import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import { isThemeMode } from '@src/shared/preferences/theme-mode.preference';
import { useTheme } from '@src/shared/providers/theme-provider';
import { DeviceIcon, MoonIcon, StyledSafeAreaView, SunIcon } from '@src/shared/ui';
import { IconRadioItem } from '@src/shared/ui/IconRadioItem/IconRadioItem';
import { RadioGroup } from 'heroui-native';
import { ScrollView } from 'react-native';

const ThemeSettingsScreen = () => {
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
    <StyledSafeAreaView className="flex-1 bg-gray-1 py-5" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <RadioGroup
          value={mode}
          onValueChange={handleThemeChange}
          className="bg-white rounded-2xl overflow-hidden gap-0"
        >
          <IconRadioItem value="system" label={t('theme.system')} Icon={DeviceIcon} />
          <IconRadioItem value="light" label={t('theme.light')} Icon={SunIcon} />
          <IconRadioItem value="dark" label={t('theme.dark')} Icon={MoonIcon} />
        </RadioGroup>
      </ScrollView>
    </StyledSafeAreaView>
  );
};

export default ThemeSettingsScreen;
