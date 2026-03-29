import { ErrorCode } from '@aido/errors';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { isApiError } from '@src/shared/errors/api-error';
import { Box, HStack, QueryErrorBoundary, Text, VStack } from '@src/shared/ui';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';
import { Suspense, useState } from 'react';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { WeatherPolicy } from '../../../models/weather.model';
import { WEATHER_QUERY_KEYS } from '../../constants/weather-query-keys.constant';
import { useGetForecastQueryOptions } from '../../queries/use-get-forecast-query-options';
import { WeatherHourlyStrip } from './WeatherHourlyStrip';
import { WeatherLocationPrompt } from './WeatherLocationPrompt';
import { WeatherSummaryRow } from './WeatherSummaryRow';

interface WeatherCardProps {
  date: string;
}

const expandStyle = {
  overflow: 'hidden' as const,
};

export function WeatherCard({ date }: WeatherCardProps) {
  return (
    <QueryErrorBoundary fallback={(props) => <WeatherCard.Error {...props} />}>
      <Suspense fallback={<WeatherCard.Loading />}>
        <WeatherCardContent date={date} />
      </Suspense>
    </QueryErrorBoundary>
  );
}

function WeatherCardContent({ date }: WeatherCardProps) {
  const queryClient = useQueryClient();
  const { data: forecast, isFetching } = useSuspenseQuery(useGetForecastQueryOptions(date));
  const [expanded, setExpanded] = useState(false);

  const canExpand = WeatherPolicy.isExpandable(forecast);

  return (
    <Animated.View entering={FadeIn.duration(ANIMATION.duration.slow)}>
      <VStack className="rounded-xl bg-white px-4">
        <WeatherSummaryRow
          forecast={forecast}
          expanded={expanded}
          onToggle={() => canExpand && setExpanded((prev) => !prev)}
          onRefresh={() =>
            queryClient.invalidateQueries({ queryKey: WEATHER_QUERY_KEYS.forecast(date) })
          }
          isRefreshing={isFetching}
        />

        {canExpand && expanded && (
          <Animated.View
            style={expandStyle}
            entering={FadeIn.duration(ANIMATION.duration.normal)}
            exiting={FadeOut.duration(ANIMATION.duration.normal)}
          >
            <WeatherHourlyStrip hourlyForecasts={forecast.hourlyForecasts} />
          </Animated.View>
        )}
      </VStack>
    </Animated.View>
  );
}

WeatherCard.Error = function ErrorFallback({
  error,
  reset,
}: {
  error: unknown;
  reset: () => void;
}) {
  if (isApiError(error) && error.hasCode(ErrorCode.WEATHER_1902)) {
    return <WeatherLocationPrompt />;
  }

  return (
    <Box className="rounded-xl bg-gray-1 px-4 py-3">
      <HStack align="center" justify="between">
        <Text size="b4" shade={5}>
          날씨 정보를 불러올 수 없어요
        </Text>
        <Text size="e1" shade={6} onPress={reset}>
          재시도
        </Text>
      </HStack>
    </Box>
  );
};

WeatherCard.Loading = function Loading() {
  return (
    <Box className="rounded-xl bg-white px-4 py-3">
      <HStack align="center" gap={10}>
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-12" />
      </HStack>
    </Box>
  );
};
