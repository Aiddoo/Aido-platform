import type { OsPermission } from '@src/core/ports/os-permission';
import { isConnectivityError } from '@src/shared/errors/infra-error';
import { getOsPermissionAccess } from '@src/shared/utils/get-os-permission-access';
import { match, P } from 'ts-pattern';

import type { WeatherLocationStatus } from '../domains/location-reading.model';
import type { WeatherBriefing } from '../domains/weather-briefing.model';
import {
  isLocationNotRegisteredError,
  isWeatherProviderUnavailableError,
} from '../domains/weather.error';
import type { WeatherEntry } from '../schemas/weather-entry-params.schema';

/** 진입점 파라미터가 없으면(딥 링크·다른 화면에서 되돌아옴) other로 센다 */
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
} as const satisfies Record<WeatherBriefing['kind'], WeatherBriefingKind>;

export function toWeatherOpenedEntry(entry: WeatherEntry | undefined): WeatherOpenedEntry {
  return entry ?? 'other';
}

export function toWeatherBriefingKind(kind: WeatherBriefing['kind']): WeatherBriefingKind {
  return BRIEFING_KINDS[kind];
}

/** 위치 확인이 끝난 결과만 센다. 확인 중이거나 권한을 아직 묻지 않았으면 null이다 */
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

/** 권한 요청 자체가 실패하면(null) 다시 물을 수 있는 상태로 본다. */
export function toPermissionResult(permission: OsPermission | null): WeatherPermissionResult {
  if (permission == null) {
    return 'needs_permission';
  }
  return match(getOsPermissionAccess(permission))
    .returnType<WeatherPermissionResult>()
    .with('granted', () => 'granted')
    .with('ask', () => 'needs_permission')
    .with('settings', () => 'denied')
    .exhaustive();
}
