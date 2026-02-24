import { Text } from '@src/shared/ui/Text/Text';
import { useCallback, useState } from 'react';
import { type LayoutChangeEvent, Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import type { CalendarViewMode } from './calendar.types';

interface CalendarViewModeToggleProps {
  value: CalendarViewMode;
  onChange: (mode: CalendarViewMode) => void;
}

const MODES: { value: CalendarViewMode; label: string }[] = [
  { value: 'week', label: '주' },
  { value: 'month', label: '월' },
];

const PADDING = 2;
const ITEM_HEIGHT = 22;
const SPRING_CONFIG = { stiffness: 500, damping: 30, mass: 0.8 };

export const CalendarViewModeToggle = ({ value, onChange }: CalendarViewModeToggleProps) => {
  const [itemLayouts, setItemLayouts] = useState<Record<string, { x: number; width: number }>>({});

  const handleLayout = useCallback((mode: CalendarViewMode, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setItemLayouts((prev) => ({ ...prev, [mode]: { x, width } }));
  }, []);

  const activeLayout = itemLayouts[value];

  const indicatorStyle = useAnimatedStyle(() => {
    if (!activeLayout) return { opacity: 0 };
    return {
      opacity: 1,
      height: ITEM_HEIGHT,
      transform: [{ translateX: withSpring(activeLayout.x, SPRING_CONFIG) }],
      width: withSpring(activeLayout.width, SPRING_CONFIG),
    };
  }, [activeLayout]);

  return (
    <View className="flex-row items-center bg-gray-2 rounded-lg" style={{ padding: PADDING }}>
      <Animated.View className="absolute bg-white rounded-md" style={indicatorStyle} />
      {MODES.map((mode) => (
        <Pressable
          key={mode.value}
          onPress={() => onChange(mode.value)}
          onLayout={(e) => handleLayout(mode.value, e)}
          hitSlop={4}
          className="items-center justify-center rounded-md"
          style={{ height: ITEM_HEIGHT, paddingHorizontal: 10 }}
        >
          <Text size="e2" weight="medium" shade={value === mode.value ? 9 : 5}>
            {mode.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};
