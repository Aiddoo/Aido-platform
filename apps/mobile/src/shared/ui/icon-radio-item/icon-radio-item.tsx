import { ANIMATION } from '@src/shared/constants/animation';
import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
import { Radio, RadioGroup } from 'heroui-native';
import type { ComponentProps } from 'react';
import Animated, { cubicBezier } from 'react-native-reanimated';

import type { StyledIconType } from '../icon';
import { ListRow } from '../list-row/list-row';

export interface IconRadioItemProps extends Omit<
  ComponentProps<typeof RadioGroup.Item>,
  'children'
> {
  label: string;
  Icon?: StyledIconType;
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
              {Icon ? (
                <Radio.Indicator>
                  <AnimatedThumbIcon Icon={Icon} isSelected={isSelected} />
                </Radio.Indicator>
              ) : (
                <Radio.Indicator />
              )}
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

// 이전 withTiming의 Easing.out(Easing.quad)와 기본 Easing.inOut(Easing.quad) 곡선이다
const SCALE_EASING = cubicBezier(0.5, 1, 0.89, 1);
const OPACITY_EASING = cubicBezier(0.455, 0.03, 0.515, 0.955);

function AnimatedThumbIcon({ Icon, isSelected }: AnimatedThumbIconProps) {
  const isReduceMotionEnabled = useIsReduceMotionEnabled();

  return (
    <Animated.View
      style={{
        transform: [{ scale: isSelected ? 1 : 1.8 }],
        opacity: isSelected ? 1 : 0,
        transitionProperty: ['transform', 'opacity'],
        transitionDuration: isReduceMotionEnabled
          ? 0
          : [ANIMATION.duration.slow, ANIMATION.duration.normal],
        transitionTimingFunction: [SCALE_EASING, OPACITY_EASING],
      }}
    >
      <Icon colorClassName="text-white" width={14} height={14} />
    </Animated.View>
  );
}
