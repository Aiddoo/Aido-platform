import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import { type FontScale, isFontScale } from '@src/shared/preferences/font-scale.preference';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { Box, SettingsCard, SettingsScreenLayout } from '@src/shared/ui';
import { SCALED_FONT_STYLES } from '@src/shared/utils/font-scale';
import { Radio, RadioGroup } from 'heroui-native';
import { Text as RNText } from 'react-native';

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
    <SettingsScreenLayout>
      <SettingsCard>
        <RadioGroup value={fontScale} onValueChange={handleChange} className="gap-0">
          <FontScaleRadioItem value="xsmall" label={t('fontSize.xsmall')} />
          <SettingsCard.Separator />
          <FontScaleRadioItem value="small" label={t('fontSize.small')} />
          <SettingsCard.Separator />
          <FontScaleRadioItem value="medium" label={t('fontSize.medium')} />
          <SettingsCard.Separator />
          <FontScaleRadioItem value="large" label={t('fontSize.large')} />
          <SettingsCard.Separator />
          <FontScaleRadioItem value="xlarge" label={t('fontSize.xlarge')} />
        </RadioGroup>
      </SettingsCard>
    </SettingsScreenLayout>
  );
}

export default FontSizeSettingsScreen;

interface FontScaleRadioItemProps {
  value: FontScale;
  label: string;
}

function FontScaleRadioItem({ value, label }: FontScaleRadioItemProps) {
  const { t } = useTranslation('settings');
  const sample = t('fontSize.sample');

  return (
    <RadioGroup.Item value={value}>
      {() => (
        <Box className="flex-row items-center gap-3 px-4 py-4">
          <Box className="flex-1 gap-1">
            <RNText allowFontScaling={false} className="text-b3 font-semibold text-foreground">
              {label}
            </RNText>
            <RNText
              allowFontScaling={false}
              className="text-gray-6 font-normal"
              style={SCALED_FONT_STYLES[value]}
            >
              {sample}
            </RNText>
          </Box>
          <Radio />
        </Box>
      )}
    </RadioGroup.Item>
  );
}
