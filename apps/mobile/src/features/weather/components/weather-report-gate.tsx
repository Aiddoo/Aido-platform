import { useTrackView } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import { Button, type QueryErrorFallbackProps, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { type ComponentProps, type ComponentType, type ReactNode, Suspense } from 'react';
import { match, P } from 'ts-pattern';

import { LIGHT_BUTTON_TEXT_CLASS } from '../constants/weather-colors.constants';
import {
  isLocationNotRegisteredError,
  isOfflineError,
  isTimeoutError,
  isWeatherProviderUnavailableError,
} from '../domains/weather.error';
import { useWeatherOpenKey } from '../hooks/use-weather-entry-params';
import { useWeatherLocation } from '../hooks/use-weather-location';
import { useUpdateWeatherLocationMutationOptions } from '../queries/weather.mutations';
import {
  useGetWeatherLocationQueryOptions,
  useGetWeatherReportQueryOptions,
} from '../queries/weather.queries';
import { toWeatherReportFailedCause } from '../utils/weather-analytics';
import { WeatherHero } from './weather-hero';
import { WeatherMascot } from './weather-mascot';

interface WeatherReportGateProps {
  children: ReactNode;
  /** 위치 미등록일 때 그린다. 리포트 경계의 fallback을 그대로 넘긴다 */
  fallback: ComponentType<QueryErrorFallbackProps>;
}

/**
 * 리포트 한 장을 나눠 보이는 칸들의 부모다. 칸은 `WeatherReportGate.Suspense`로 로딩 자리만 잡고, 리포트 실패는
 * 이 경계 하나가 `WeatherReportGate.Error`로 보인다. 위치 미등록(WEATHER_1902)은 장애가 아니라 위치 안내를 그릴
 * 상태라 경계로 던지지 않고 여기서 그린다. 개발 빌드는 경계가 잡은 오류도 화면을 덮는 Render Error로 띄운다
 */
export function WeatherReportGate({ children, fallback: Fallback }: WeatherReportGateProps) {
  const { data: report, error, refetch } = useQuery(useGetWeatherReportQueryOptions());

  if (report == null && isLocationNotRegisteredError(error)) {
    return (
      <Fallback
        error={error}
        reset={() => {
          refetch();
        }}
      />
    );
  }
  return children;
}

/** 리포트가 오기 전에는 블록을 마운트하지 않아, 위치 미등록 응답이 블록의 useSuspenseQuery로 던져지지 않는다 */
WeatherReportGate.Suspense = function ReportSuspense({
  fallback = null,
  children,
}: ComponentProps<typeof Suspense>) {
  const { data: report, error } = useQuery(useGetWeatherReportQueryOptions());

  if (report == null && (error == null || isLocationNotRegisteredError(error))) {
    return fallback;
  }
  return <Suspense fallback={fallback}>{children}</Suspense>;
};

/** 리포트는 모든 블록이 같은 요청을 쓰므로 실패도 여기 한 곳에서만 보여 준다 */
WeatherReportGate.Error = function ErrorFallback({ error, reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['weather', 'common']);
  const location = useWeatherLocation();
  const [openKey] = useWeatherOpenKey();
  const cause = toWeatherReportFailedCause(error);
  // 위치 등록을 기다리는 동안은 실패가 아니라 로딩으로 보인다
  const isWaitingForLocation = cause === 'no_location' && location.status === 'checking';

  // 위치 확인이 다시 돌아 로딩과 실패를 오가도 같은 열기의 같은 원인은 한 번만 센다
  useTrackView(
    'weather_report_failed',
    isWaitingForLocation ? null : { key: `${openKey}:${cause}`, params: { cause } },
  );

  const retryButton = (
    <WeatherResult.Action onPress={reset}>{t('common:actions.retry')}</WeatherResult.Action>
  );

  return match(error)
    .with(P.when(isLocationNotRegisteredError), () =>
      location.status === 'checking' ? (
        <WeatherHero.Loading />
      ) : (
        <LocationUnavailable onRecovered={reset} />
      ),
    )
    .with(P.when(isWeatherProviderUnavailableError), () => (
      <WeatherResult
        title={t('weather:screen.providerUnavailable')}
        description={t('weather:screen.retryLater')}
      >
        {retryButton}
      </WeatherResult>
    ))
    .with(P.when(isTimeoutError), () => (
      <WeatherResult
        title={t('weather:screen.timeout')}
        description={t('weather:screen.retryLater')}
      >
        {retryButton}
      </WeatherResult>
    ))
    .with(P.when(isOfflineError), () => (
      <WeatherResult
        title={t('weather:screen.offline')}
        description={t('weather:screen.offlineDescription')}
      >
        {retryButton}
      </WeatherResult>
    ))
    .otherwise(() => (
      <WeatherResult
        title={t('weather:screen.loadFailed')}
        description={t('weather:screen.retryLater')}
      >
        {retryButton}
      </WeatherResult>
    ));
};

interface LocationUnavailableProps {
  onRecovered: () => void;
}

/** 서버 저장 위치가 있으면 그 위치를 다시 등록하고, 없으면 기기 위치를 다시 읽은 뒤 리포트 경계를 푼다 */
function LocationUnavailable({ onRecovered }: LocationUnavailableProps) {
  const { t } = useTranslation(['weather', 'common']);
  const location = useWeatherLocation();
  const { data: reading } = useQuery(useGetWeatherLocationQueryOptions());
  const updateLocation = useMutation(useUpdateWeatherLocationMutationOptions());

  const handleRetry = async () => {
    if (reading?.status === 'located') {
      const { latitude, longitude } = reading.registered;
      await updateLocation.mutateAsync({ latitude, longitude }).catch(noop);
    } else if (location.status === 'unavailable') {
      await location.retry();
    }
    onRecovered();
  };

  return (
    <WeatherResult
      title={t('weather:locationPrompt.unavailableTitle')}
      description={t('weather:locationPrompt.unavailableDescription')}
    >
      <WeatherResult.Action isLoading={updateLocation.isPending} onPress={handleRetry}>
        {t('common:actions.retry')}
      </WeatherResult.Action>
    </WeatherResult>
  );
}

interface WeatherResultProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

/** 시안 V2States 2·6. 마스코트 이미지는 장식이라 보조 기술에서 숨긴다 */
function WeatherResult({ title, description, children }: WeatherResultProps) {
  return (
    <VStack align="center" px={8}>
      <WeatherMascot name="weatherAnchor" className="size-[136px]" fallbackCondition="CLEAR" />
      <Text
        size="t2"
        weight="semibold"
        tone="onSky"
        align="center"
        className="mt-3.5 max-w-[280px] text-[24px] leading-[32px] tracking-[-0.7px]"
        accessibilityRole="header"
        lineBreakStrategyIOS="hangul-word"
      >
        {title}
      </Text>
      {description != null && (
        <Text
          size="b3"
          align="center"
          className="mt-2 max-w-[300px] leading-[22px] text-on-sky/80"
          lineBreakStrategyIOS="hangul-word"
        >
          {description}
        </Text>
      )}
      {children != null && <VStack className="mt-7 w-full gap-2">{children}</VStack>}
    </VStack>
  );
}

interface WeatherResultActionProps extends Omit<
  ComponentProps<typeof Button>,
  'variant' | 'color' | 'size' | 'display' | 'children'
> {
  children: string;
}

/** 하늘 위 다시 시도 버튼은 밝은 면이다 */
WeatherResult.Action = function Action({
  children,
  className,
  ...props
}: WeatherResultActionProps) {
  return (
    <Button display="full" className={cn('bg-on-sky/95', className)} {...props}>
      <Text size="b1" weight="semibold" align="center" className={LIGHT_BUTTON_TEXT_CLASS}>
        {children}
      </Text>
    </Button>
  );
};
