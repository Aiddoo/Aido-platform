import { ANIMATION } from '@src/shared/constants/animation.constants';
import { ListRow, type StyledIconType } from '@src/shared/ui';
import { Radio, RadioGroup } from 'heroui-native';
import Animated, { Easing, useAnimatedStyle, withTiming } from 'react-native-reanimated';

interface IconRadioItemProps {
  value: string;
  label: string;
  Icon: StyledIconType;
  /** 있으면 라벨 아래 보조 설명을 함께 노출한다 (예: 언어 시스템 옵션). */
  description?: string;
}

/**
 * 아이콘 썸을 가진 라디오 항목. 선택 시 브랜드색 썸 위에 흰색 아이콘이 나타난다.
 * 테마·언어 설정 화면에서 동일한 형태로 재사용한다 (`RadioGroup` 컨텍스트 안에서 사용).
 */
export function IconRadioItem({ value, label, Icon, description }: IconRadioItemProps) {
  return (
    <RadioGroup.Item value={value}>
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
