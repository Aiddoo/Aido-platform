import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import { type ThemeMode, useTheme } from '@src/shared/providers/theme-provider';
import { DeviceIcon, MoonIcon, StyledSafeAreaView, SunIcon } from '@src/shared/ui';
import { RadioGroup } from 'heroui-native';
import { ScrollView } from 'react-native';
import { IconRadioItem } from './_components/icon-radio-item';

const ThemeSettingsScreen = () => {
  const { mode, setMode } = useTheme();
  const { t } = useTranslation('settings');
  const { trackEvent } = useTrack();

  const handleThemeChange = (value: string) => {
    const newMode = value as ThemeMode;
    setMode(newMode);
    trackEvent('settings_changed', { setting: 'theme', value: newMode });
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1 py-5" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <RadioGroup
          value={mode}
          onValueChange={handleThemeChange}
          className="bg-white rounded-2xl overflow-hidden gap-0"
        >
          {/* 언어 설정과 동일하게 시스템 설정을 맨 위에 둔다 (시스템 → 라이트 → 다크) */}
          <IconRadioItem value="system" label={t('theme.system')} Icon={DeviceIcon} />
          <IconRadioItem value="light" label={t('theme.light')} Icon={SunIcon} />
          <IconRadioItem value="dark" label={t('theme.dark')} Icon={MoonIcon} />
        </RadioGroup>
      </ScrollView>
    </StyledSafeAreaView>
  );
};

export default ThemeSettingsScreen;
