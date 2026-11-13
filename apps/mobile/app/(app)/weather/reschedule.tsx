import { WeatherRescheduleBottomSheet } from '@src/features/weather/components/weather-reschedule-bottom-sheet/weather-reschedule-bottom-sheet';
import { weatherRescheduleParamsSchema } from '@src/features/weather/schemas/weather-reschedule-params.schema';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { SheetRouteScreen } from '@src/shared/ui';

export default function WeatherRescheduleSheetRoute() {
  const route = useRouteParamsOrRedirect(weatherRescheduleParamsSchema, {
    fallbackHref: '/weather',
  });

  if (route.redirect != null) {
    return route.redirect;
  }

  return (
    <SheetRouteScreen>
      <WeatherRescheduleBottomSheet />
    </SheetRouteScreen>
  );
}
