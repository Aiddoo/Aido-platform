import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import { type FontScale, isFontScale } from '@src/shared/preferences/font-scale.preference';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { StyledSafeAreaView } from '@src/shared/ui';
import { SCALED_FONT_STYLES } from '@src/shared/utils/font-scale';
import { Radio, RadioGroup } from 'heroui-native';
import { Text as RNText, ScrollView, View } from 'react-native';

const FontSizeSettingsScreen = () => {
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
    <StyledSafeAreaView className="flex-1 bg-gray-1 py-5" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <RadioGroup
          value={fontScale}
          onValueChange={handleChange}
          className="bg-white rounded-2xl overflow-hidden gap-0"
        >
          <FontScaleRadioItem value="xsmall" label={t('fontSize.xsmall')} />
          <FontScaleRadioItem value="small" label={t('fontSize.small')} />
          <FontScaleRadioItem value="medium" label={t('fontSize.medium')} />
          <FontScaleRadioItem value="large" label={t('fontSize.large')} />
          <FontScaleRadioItem value="xlarge" label={t('fontSize.xlarge')} />
        </RadioGroup>
      </ScrollView>
    </StyledSafeAreaView>
  );
};

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
        <View className="flex-row items-center gap-3 px-4 py-4">
          <View className="flex-1 gap-1">
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
          </View>
          <Radio />
        </View>
      )}
    </RadioGroup.Item>
  );
}
