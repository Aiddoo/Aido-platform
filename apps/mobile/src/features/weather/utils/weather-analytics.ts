import { isConnectivityError } from '@src/shared/errors/infra-error';
import { match, P } from 'ts-pattern';

import type { BriefingResult } from '../domains/weather-briefing.model';
import type { WeatherLocationStatus } from '../domains/weather-location.model';
import {
  isLocationNotRegisteredError,
  isWeatherProviderUnavailableError,
} from '../domains/weather.error';
import type { WeatherEntry } from '../schemas/weather-entry-params.schema';

export type WeatherOpenedEntry = WeatherEntry | 'other';

export type WeatherBriefingKind =
  | 'rainy'
  | 'stormy'
  | 'snowy'
  | 'hot'
  | 'rain_later'
  | 'clear'
  | 'tomorrow_morning'
  | 'dry'
  | 'no_scheduled_todos';

export type WeatherLocationRegisteredResult = 'located' | 'denied' | 'unavailable';

export type WeatherReportFailedCause = 'no_location' | 'provider_unavailable' | 'offline' | 'other';

const BRIEFING_KINDS = {
  rainy: 'rainy',
  stormy: 'stormy',
  snowy: 'snowy',
  hot: 'hot',
  rainLater: 'rain_later',
  clear: 'clear',
  tomorrowMorning: 'tomorrow_morning',
  dry: 'dry',
  noScheduledTodos: 'no_scheduled_todos',
} as const satisfies Record<BriefingResult['kind'], WeatherBriefingKind>;

export function toWeatherOpenedEntry(entry: WeatherEntry | undefined): WeatherOpenedEntry {
  return entry ?? 'other';
}

export function toWeatherBriefingKind(kind: BriefingResult['kind']): WeatherBriefingKind {
  return BRIEFING_KINDS[kind];
}

export function toWeatherLocationRegisteredResult(
  status: WeatherLocationStatus['status'],
): WeatherLocationRegisteredResult | null {
  return match(status)
    .returnType<WeatherLocationRegisteredResult | null>()
    .with('ready', () => 'located')
    .with('denied', () => 'denied')
    .with('unavailable', () => 'unavailable')
    .with('checking', 'needsPermission', () => null)
    .exhaustive();
}

/** 리포트 경계가 보인 실패를 사용자가 겪은 원인으로 묶는다. 오류 메시지는 담지 않는다 */
export function toWeatherReportFailedCause(error: unknown): WeatherReportFailedCause {
  return match(error)
    .returnType<WeatherReportFailedCause>()
    .with(P.when(isLocationNotRegisteredError), () => 'no_location')
    .with(P.when(isWeatherProviderUnavailableError), () => 'provider_unavailable')
    .with(P.when(isConnectivityError), () => 'offline')
    .otherwise(() => 'other');
}

export type WeatherPermissionResult = 'granted' | 'needs_permission' | 'denied';

export function toPermissionResult(
  permission: { isGranted: boolean; canAskAgain: boolean } | null,
): WeatherPermissionResult {
  if (permission == null) {
    return 'needs_permission';
  }
  if (permission.isGranted) {
    return 'granted';
  }
  return permission.canAskAgain ? 'needs_permission' : 'denied';
}
