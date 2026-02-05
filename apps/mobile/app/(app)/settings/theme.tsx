import { ANIMATION } from '@src/shared/constants/animation.constants';
import { type ThemeMode, useTheme } from '@src/shared/providers/theme-provider';
import { DeviceIcon, MoonIcon, type StyledIconType, SunIcon } from '@src/shared/ui/Icon';
import { ListRow } from '@src/shared/ui/ListRow/ListRow';
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { RadioGroup } from 'heroui-native';
import { ScrollView } from 'react-native';
import Animated, { Easing, useAnimatedStyle, withTiming } from 'react-native-reanimated';

const ThemeSettingsScreen = () => {
  const { mode, setMode } = useTheme();

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <RadioGroup
          value={mode}
          onValueChange={(value) => setMode(value as ThemeMode)}
          className="bg-white rounded-2xl overflow-hidden gap-0"
        >
          <ThemeRadioItem value="light" label="라이트 모드" Icon={SunIcon} />
          <ThemeRadioItem value="dark" label="다크 모드" Icon={MoonIcon} />
          <ThemeRadioItem value="system" label="시스템 설정" Icon={DeviceIcon} />
        </RadioGroup>
      </ScrollView>
    </StyledSafeAreaView>
  );
};

export default ThemeSettingsScreen;

interface ThemeRadioItemProps {
  value: ThemeMode;
  label: string;
  Icon: StyledIconType;
}

function ThemeRadioItem({ value, label, Icon }: ThemeRadioItemProps) {
  return (
    <RadioGroup.Item value={value}>
      {({ isSelected }) => (
        <ListRow
          contents={
            <ListRow.Texts
              type="1RowTypeA"
              top={label}
              topProps={{ size: 'b3', weight: 'semibold' }}
            />
          }
          right={
            <RadioGroup.Indicator>
              <AnimatedThumbIcon Icon={Icon} isSelected={isSelected} />
            </RadioGroup.Indicator>
          }
          horizontalPadding="medium"
          verticalPadding="large"
        />
      )}
    </RadioGroup.Item>
  );
}

interface AnimatedThumbIconProps {
  Icon: StyledIconType;
  isSelected: boolean;
}

function AnimatedThumbIcon({ Icon, isSelected }: AnimatedThumbIconProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withTiming(isSelected ? 1 : 1.8, {
          duration: ANIMATION.duration.slow,
          easing: Easing.out(Easing.ease),
        }),
      },
    ],
    opacity: withTiming(isSelected ? 1 : 0, { duration: ANIMATION.duration.normal }),
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Icon colorClassName="text-white" width={14} height={14} />
    </Animated.View>
  );
}
