import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import { isFontScale } from '@src/shared/preferences/font-scale.preference';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { SettingsListGroup, SettingsScreenLayout, Text } from '@src/shared/ui';
import { Stack } from 'expo-router';
import { RadioGroup } from 'heroui-native';

function FontSizeSettingsScreen() {
  const { fontScale, setFontScale } = useFontScale();
  const { t } = useTranslation('settings');
  const { trackEvent } = useTrack();

  const handleChange = (value: string) => {
    if (!isFontScale(value)) {
      return;
    }
    setFontScale(value);
    trackEvent('settings_changed', { setting: 'font_scale', value });
  };

  return (
    <>
      <Stack.Screen options={{ title: t('titles.fontSize') }} />

      <SettingsScreenLayout>
        {/* 고르는 즉시 앱 전체 글꼴이 바뀌어 미리 보기도 고른 크기로 다시 그려진다 */}
        <SettingsListGroup label={t('fontSize.previewLabel')}>
          <SettingsListGroup.Custom gap={2}>
            <Text size="b2" shade={8} lineBreakStrategyIOS="hangul-word">
              {t('fontSize.previewTitle')}
            </Text>
            <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
              {t('fontSize.previewDescription')}
            </Text>
          </SettingsListGroup.Custom>
        </SettingsListGroup>

        <SettingsListGroup label={t('fontSize.label')}>
          <RadioGroup value={fontScale} onValueChange={handleChange} className="gap-0">
            <SettingsListGroup.Radio value="xsmall" label={t('fontSize.xsmall')} />
            <SettingsListGroup.Separator />
            <SettingsListGroup.Radio value="small" label={t('fontSize.small')} />
            <SettingsListGroup.Separator />
            <SettingsListGroup.Radio value="medium" label={t('fontSize.medium')} />
            <SettingsListGroup.Separator />
            <SettingsListGroup.Radio value="large" label={t('fontSize.large')} />
            <SettingsListGroup.Separator />
            <SettingsListGroup.Radio value="xlarge" label={t('fontSize.xlarge')} />
          </RadioGroup>
        </SettingsListGroup>
      </SettingsScreenLayout>
    </>
  );
}

export default FontSizeSettingsScreen;
