import { ANIMATION } from '@src/shared/constants/animation.constants';
import { Radio, RadioGroup } from 'heroui-native';
import type { ComponentProps } from 'react';
import Animated, { Easing, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import type { StyledIconType } from '../Icon';
import { ListRow } from '../ListRow/ListRow';

interface IconRadioItemProps extends Omit<ComponentProps<typeof RadioGroup.Item>, 'children'> {
  label: string;
  Icon: StyledIconType;
  description?: string;
}

export function IconRadioItem({ value, label, Icon, description, ...props }: IconRadioItemProps) {
  return (
    <RadioGroup.Item value={value} {...props}>
      {({ isSelected }) => (
        <ListRow
          contents={
            description ? (
              <ListRow.Texts
                type="2RowTypeA"
                top={label}
                topProps={{ size: 'b3', weight: 'semibold' }}
                bottom={description}
              />
            ) : (
              <ListRow.Texts
                type="1RowTypeA"
                top={label}
                topProps={{ size: 'b3', weight: 'semibold' }}
              />
            )
          }
          right={
            <Radio>
              <Radio.Indicator>
                <AnimatedThumbIcon Icon={Icon} isSelected={isSelected} />
              </Radio.Indicator>
            </Radio>
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
          easing: Easing.out(Easing.quad),
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
