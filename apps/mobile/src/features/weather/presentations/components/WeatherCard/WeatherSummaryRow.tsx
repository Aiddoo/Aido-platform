import type { PrecipitationType, SkyCondition } from '@aido/validators';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { HStack, Text } from '@src/shared/ui';
import { RefreshIcon } from '@src/shared/ui/Icon';
import { useCallback } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  PRECIPITATION_TYPE_LABEL,
  SKY_CONDITION_LABEL,
} from '../../constants/weather-labels.constant';
import { WeatherConditionIcon } from './WeatherConditionIcon';

interface WeatherSummaryRowProps {
  forecast: {
    skyCondition: SkyCondition;
    precipitationType: PrecipitationType;
    precipitationProbability: number;
    temperatureMin: number;
    temperatureMax: number;
  };
  expanded: boolean;
  onToggle: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const formatTemperature = (min: number, max: number) => `${Math.round(min)}° / ${Math.round(max)}°`;

export function WeatherSummaryRow({
  forecast,
  expanded,
  onToggle,
  onRefresh,
  isRefreshing,
}: WeatherSummaryRowProps) {
  const refreshRotation = useSharedValue(0);

  const handleRefresh = useCallback(() => {
    refreshRotation.value = withSequence(
      withTiming(0, { duration: 0 }),
      withRepeat(withTiming(360, { duration: 600 }), 2, false),
    );
    onRefresh();
  }, [onRefresh, refreshRotation]);

  const refreshAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${refreshRotation.value}deg` }],
  }));

  const arrowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: withTiming(expanded ? '180deg' : '0deg', {
          duration: ANIMATION.duration.normal,
        }),
      },
    ],
  }));

  const showPrecipitation =
    forecast.precipitationType !== 'NONE' && forecast.precipitationProbability >= 30;

  return (
    <Pressable onPress={onToggle}>
      <HStack className="py-3" align="center" gap={10}>
        <WeatherConditionIcon
          skyCondition={forecast.skyCondition}
          precipitationType={forecast.precipitationType}
        />

        <Text size="b2" weight="semibold">
          {formatTemperature(forecast.temperatureMin, forecast.temperatureMax)}
        </Text>

        <Text size="b3" shade={6}>
          {SKY_CONDITION_LABEL[forecast.skyCondition]}
        </Text>

        {showPrecipitation && (
          <HStack
            className="rounded-full bg-blue-50 px-2 py-0.5 dark:bg-blue-950"
            align="center"
            gap={3}
          >
            <Text size="e1" weight="medium" className="text-blue-600 dark:text-blue-400">
              {PRECIPITATION_TYPE_LABEL[forecast.precipitationType]}{' '}
              {forecast.precipitationProbability}%
            </Text>
          </HStack>
        )}

        <HStack className="ml-auto" align="center" gap={6}>
          <Pressable onPress={handleRefresh} hitSlop={8} disabled={isRefreshing}>
            <Animated.View style={refreshAnimatedStyle}>
              <RefreshIcon width={18} height={18} colorClassName="text-gray-5" />
            </Animated.View>
          </Pressable>

          <Animated.View style={arrowAnimatedStyle}>
            <Text size="e2" shade={5}>
              {'\u25BC'}
            </Text>
          </Animated.View>
        </HStack>
      </HStack>
    </Pressable>
  );
}
