import {
  useLocationGateway,
  useWeatherLocationStateService,
  useWeatherService,
} from '@src/bootstrap/providers/di-context';
import type { LocationCoordinates } from '@src/core/ports/location-gateway';
import { WeatherPolicy } from '@src/features/weather/models/weather.model';
import { unwrap } from '@src/shared/errors/result';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  type PropsWithChildren,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { WEATHER_QUERY_KEYS } from '../constants/weather-query-keys.constant';
import { createWeatherClock } from '../view-models/weather-clock.view-model';

type LocationStatus =
  | 'checking'
  | 'registered'
  | 'unregistered'
  | 'denied'
  | 'unsupported'
  | 'error';
interface WeatherSession {
  clock: ReturnType<typeof createWeatherClock>;
  locationRevision: number;
  status: LocationStatus;
  isSyncing: boolean;
  needsIntroduction: boolean;
  locationName: string | null;
  syncLocation(requestPermission?: boolean): Promise<void>;
  dismissIntroduction(): void;
}
const WeatherSessionContext = createContext<WeatherSession | null>(null);

export function WeatherSessionProvider({ children }: PropsWithChildren) {
  const gateway = useLocationGateway();
  const locationState = useWeatherLocationStateService();
  const service = useWeatherService();
  const queryClient = useQueryClient();
  const [clock, setClock] = useState(() => createWeatherClock(new Date()));
  const [locationRevision, setLocationRevision] = useState(0);
  const [status, setStatus] = useState<LocationStatus>('checking');
  const [isSyncing, setIsSyncing] = useState(false);
  const [needsIntroduction, setNeedsIntroduction] = useState(true);
  const [locationName, setLocationName] = useState<string | null>(null);
  const mounted = useRef(false);
  const activeRequest = useRef<Promise<void> | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const previousCoordinates = useRef<LocationCoordinates | null>(null);
  const lastSynchronizedAt = useRef(0);

  const dismissIntroduction = useCallback(() => {
    setNeedsIntroduction(false);
    try {
      locationState.markIntroductionSeen();
    } catch {
      /* 이번 세션의 안내 종료는 유지한다. */
    }
  }, [locationState]);

  const syncLocation = useCallback(
    (requestPermission = false): Promise<void> => {
      if (activeRequest.current) return activeRequest.current;
      const controller = new AbortController();
      abortController.current = controller;
      const task = async () => {
        try {
          let permission = await gateway.getPermission();
          if (controller.signal.aborted) return;
          if (!permission.granted && requestPermission && permission.canAskAgain) {
            dismissIntroduction();
            permission = await gateway.requestPermission();
            if (controller.signal.aborted) return;
          }
          if (!permission.granted) {
            setStatus(permission.canAskAgain ? 'unregistered' : 'denied');
            setNeedsIntroduction(permission.canAskAgain && !locationState.hasSeenIntroduction());
            return;
          }
          setNeedsIntroduction(false);
          setIsSyncing(true);
          const coordinates = await gateway.getCoordinates(controller.signal);
          const place = await gateway.getPlace(coordinates, controller.signal);
          if (controller.signal.aborted) return;
          if (
            !WeatherPolicy.isSupportedLocation({ ...coordinates, countryCode: place.countryCode })
          ) {
            setStatus(
              place.countryCode === null && WeatherPolicy.isWithinSupportedBounds(coordinates)
                ? 'error'
                : 'unsupported',
            );
            setLocationName(null);
            return;
          }
          if (
            !requestPermission &&
            previousCoordinates.current &&
            !WeatherPolicy.isRelocationNeeded(coordinates, previousCoordinates.current)
          ) {
            setStatus('registered');
            lastSynchronizedAt.current = Date.now();
            return;
          }
          await queryClient.cancelQueries({ queryKey: WEATHER_QUERY_KEYS.all });
          unwrap(await service.updateLocation(coordinates, controller.signal));
          if (controller.signal.aborted) return;
          queryClient.removeQueries({ queryKey: WEATHER_QUERY_KEYS.all });
          previousCoordinates.current = coordinates;
          setLocationName(place.name);
          setLocationRevision((value) => value + 1);
          setStatus('registered');
          lastSynchronizedAt.current = Date.now();
        } catch {
          if (!controller.signal.aborted) {
            setStatus((current) => (current === 'unsupported' ? current : 'error'));
            setNeedsIntroduction(false);
          }
        } finally {
          if (mounted.current) setIsSyncing(false);
        }
      };
      const promise = task().finally(() => {
        if (activeRequest.current === promise) activeRequest.current = null;
        if (mounted.current && controller.signal.aborted && AppState.currentState === 'active')
          void syncLocation();
      });
      activeRequest.current = promise;
      return promise;
    },
    [dismissIntroduction, gateway, locationState, queryClient, service],
  );

  useEffect(() => {
    mounted.current = true;
    void syncLocation();
    let clockTimer: ReturnType<typeof setTimeout> | undefined;
    const reconcileClock = () => {
      clearTimeout(clockTimer);
      setClock(createWeatherClock(new Date()));
      if (AppState.currentState === 'active')
        clockTimer = setTimeout(reconcileClock, 60_000 - (Date.now() % 60_000) + 100);
    };
    reconcileClock();
    const subscription = AppState.addEventListener('change', (state) => {
      reconcileClock();
      if (state === 'active' && Date.now() - lastSynchronizedAt.current >= 30 * 60_000)
        void syncLocation();
      if (state === 'background') abortController.current?.abort();
    });
    return () => {
      mounted.current = false;
      clearTimeout(clockTimer);
      abortController.current?.abort();
      subscription.remove();
    };
  }, [syncLocation]);

  return (
    <WeatherSessionContext.Provider
      value={{
        clock,
        locationRevision,
        status,
        isSyncing,
        needsIntroduction,
        locationName,
        syncLocation,
        dismissIntroduction,
      }}
    >
      {children}
    </WeatherSessionContext.Provider>
  );
}

export function useWeatherSession(): WeatherSession {
  const context = use(WeatherSessionContext);
  if (!context) throw new Error('useWeatherSession must be used within WeatherSessionProvider');
  return context;
}
