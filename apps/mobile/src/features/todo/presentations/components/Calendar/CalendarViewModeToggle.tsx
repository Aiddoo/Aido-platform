import { useTranslation } from '@src/shared/i18n';
import { Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useCallback, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useCalendarContext } from './calendar-view-mode-context';
import type { CalendarViewMode } from './calendar.types';

const CALENDAR_VIEW_MODE = [
  { value: 'week', labelKey: 'calendar.week' },
  { value: 'month', labelKey: 'calendar.month' },
] as const satisfies ReadonlyArray<{ value: CalendarViewMode; labelKey: string }>;

const PADDING = 2;
const ITEM_HEIGHT = 22;
const SPRING_CONFIG = { stiffness: 500, damping: 30, mass: 0.8 };

export const CalendarViewModeToggle = () => {
  const { t } = useTranslation('todo');
  const { viewMode: value, setViewMode: onChange } = useCalendarContext();
  const [itemLayouts, setItemLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const hasAnimated = useRef(false);
  const translateX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const showIndicator = useSharedValue(0);

  const handleLayout = useCallback((mode: CalendarViewMode, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setItemLayouts((prev) => ({ ...prev, [mode]: { x, width } }));
  }, []);

  const activeLayout = itemLayouts[value];

  if (activeLayout) {
    if (!hasAnimated.current) {
      translateX.value = activeLayout.x;
      indicatorWidth.value = activeLayout.width;
      showIndicator.value = 1;
      hasAnimated.current = true;
    } else {
      translateX.value = withSpring(activeLayout.x, SPRING_CONFIG);
      indicatorWidth.value = withSpring(activeLayout.width, SPRING_CONFIG);
    }
  }

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: showIndicator.value,
    height: ITEM_HEIGHT,
    transform: [{ translateX: translateX.value }],
    width: indicatorWidth.value,
  }));

  return (
    <View className="flex-row items-center bg-gray-2 rounded-lg" style={{ padding: PADDING }}>
      <Animated.View className="absolute bg-white rounded-md" style={indicatorStyle} />
      {CALENDAR_VIEW_MODE.map((mode) => (
        <Pressable
          key={mode.value}
          onPress={() => onChange(mode.value)}
          onLayout={(e) => handleLayout(mode.value, e)}
          hitSlop={4}
          className={cn(
            'items-center justify-center rounded-md',
            value === mode.value && 'bg-white',
          )}
          style={{ height: ITEM_HEIGHT, paddingHorizontal: 10 }}
        >
          <Text size="e1" weight="medium" shade={value === mode.value ? 9 : 5}>
            {t(mode.labelKey)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};
