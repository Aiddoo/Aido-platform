import type { QueryErrorFallbackProps } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { type ComponentProps, type ComponentType, type ReactNode, Suspense } from 'react';

import { isLocationNotRegisteredError } from '../domains/weather.error';
import { useGetWeatherReportQueryOptions } from '../queries/weather.queries';

interface WeatherReportGateProps {
  children: ReactNode;
  /** 위치 미등록일 때 그린다. 리포트 경계의 fallback을 그대로 넘긴다 */
  fallback: ComponentType<QueryErrorFallbackProps>;
}

/**
 * 위치 미등록(WEATHER_1902)은 장애가 아니라 위치 안내를 그릴 상태라 경계로 던지지 않고 여기서 그린다.
 * 개발 빌드는 경계가 잡은 오류도 화면을 덮는 Render Error로 띄운다
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
