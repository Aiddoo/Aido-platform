import { useTranslation } from '@src/shared/i18n';
import { Box, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useCalendarContext } from '../providers/calendar-provider';
import type { CalendarViewMode } from './calendar.types';

const PADDING = 2;
const ITEM_HEIGHT = 22;
const SPRING_CONFIG = { stiffness: 500, damping: 30, mass: 0.8 };

export function CalendarViewModeToggle() {
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

  useLayoutEffect(() => {
    if (!activeLayout) {
      return;
    }

    if (!hasAnimated.current) {
      translateX.value = activeLayout.x;
      indicatorWidth.value = activeLayout.width;
      showIndicator.value = 1;
      hasAnimated.current = true;
    } else {
      translateX.value = withSpring(activeLayout.x, SPRING_CONFIG);
      indicatorWidth.value = withSpring(activeLayout.width, SPRING_CONFIG);
    }
  }, [activeLayout, indicatorWidth, showIndicator, translateX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: showIndicator.value,
    height: ITEM_HEIGHT,
    transform: [{ translateX: translateX.value }],
    width: indicatorWidth.value,
  }));

  return (
    <Box className="flex-row items-center bg-gray-2 rounded-lg" style={{ padding: PADDING }}>
      <Animated.View className="absolute bg-white rounded-md" style={indicatorStyle} />
      <ViewModeOption
        label={t('calendar.week')}
        isActive={value === 'week'}
        onPress={() => onChange('week')}
        onLayout={(e) => handleLayout('week', e)}
      />
      <ViewModeOption
        label={t('calendar.month')}
        isActive={value === 'month'}
        onPress={() => onChange('month')}
        onLayout={(e) => handleLayout('month', e)}
      />
    </Box>
  );
}

interface ViewModeOptionProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
}

function ViewModeOption({ label, isActive, onPress, onLayout }: ViewModeOptionProps) {
  return (
    <PressableFeedback
      onPress={onPress}
      onLayout={onLayout}
      hitSlop={4}
      className={cn('items-center justify-center rounded-md', isActive && 'bg-white')}
      style={{ height: ITEM_HEIGHT, paddingHorizontal: 10 }}
    >
      <Text size="e1" weight="medium" shade={isActive ? 9 : 5}>
        {label}
      </Text>
    </PressableFeedback>
  );
}
