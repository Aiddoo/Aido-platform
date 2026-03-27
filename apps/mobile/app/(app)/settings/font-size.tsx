import { useTrack } from '@src/shared/analytics';
import { type FontScale, useFontScale } from '@src/shared/providers/font-scale-provider';
import { StyledSafeAreaView } from '@src/shared/ui';
import { Radio, RadioGroup } from 'heroui-native';
import { Text as RNText, ScrollView, View } from 'react-native';

const FontSizeSettingsScreen = () => {
  const { fontScale, setFontScale } = useFontScale();
  const { trackEvent } = useTrack();

  const handleChange = (value: string) => {
    const newScale = value as FontScale;
    setFontScale(newScale);
    trackEvent('settings_changed', { setting: 'font_scale', value: newScale });
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1 py-5" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <RadioGroup
          value={fontScale}
          onValueChange={handleChange}
          className="bg-white rounded-2xl overflow-hidden gap-0"
        >
          <FontScaleRadioItem value="small" label="작게" />
          <FontScaleRadioItem value="normal" label="보통" />
          <FontScaleRadioItem value="large" label="크게" />
        </RadioGroup>
      </ScrollView>
    </StyledSafeAreaView>
  );
};

export default FontSizeSettingsScreen;

// 실제 b2(본문 기본)가 각 모드에서 리매핑되는 사이즈와 동일
// 작게: b2→b3(15px), 보통: b2(16px), 크게: b2→b1(17px)
const PREVIEW_FONT_SIZES = {
  small: { fontSize: 15, lineHeight: 20 },
  normal: { fontSize: 16, lineHeight: 23 },
  large: { fontSize: 17, lineHeight: 24 },
} as const;

interface FontScaleRadioItemProps {
  value: FontScale;
  label: string;
}

function FontScaleRadioItem({ value, label }: FontScaleRadioItemProps) {
  return (
    <RadioGroup.Item value={value}>
      {() => (
        <View className="flex-row items-center gap-3 px-4 py-4">
          <View className="flex-1 gap-1">
            <RNText className="text-b3 font-semibold text-foreground">{label}</RNText>
            <RNText className="text-gray-6 font-normal" style={PREVIEW_FONT_SIZES[value]}>
              가나다라마바사 ABC 123
            </RNText>
          </View>
          <Radio />
        </View>
      )}
    </RadioGroup.Item>
  );
}
