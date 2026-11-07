import { WeatherRescheduleSheet } from '@src/features/weather/components/weather-reschedule/weather-reschedule-sheet';
import { weatherRescheduleParamsSchema } from '@src/features/weather/schemas/weather-reschedule-params.schema';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function WeatherRescheduleSheetRoute() {
  const params = weatherRescheduleParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/weather" />;
  }

  return (
    <SheetRouteScreen>
      <WeatherRescheduleSheet />
    </SheetRouteScreen>
  );
}
