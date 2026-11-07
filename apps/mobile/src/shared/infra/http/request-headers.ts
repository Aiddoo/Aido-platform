import { i18n } from '@src/shared/i18n';
import { getDeviceTimezone } from '@src/shared/infra/device-clock';
import { getDeviceHeaders } from '@src/shared/utils/device-headers';
import * as Crypto from 'expo-crypto';
import type { BeforeRequestState } from 'ky';

/** 서버 로그·Sentry와 앱 breadcrumb를 한 요청으로 잇는 ID. 서버가 같은 값을 응답 헤더로 돌려준다. */
export const REQUEST_ID_HEADER = 'X-Request-Id';

export interface AppHeaderSource {
  appVersion?: string;
  appBuild?: string;
}

/** 실행 중 바뀌지 않는 앱·기기 헤더. 클라이언트를 만들 때 한 번 정한다. */
export function createAppHeaders({
  appVersion,
  appBuild,
}: AppHeaderSource): Record<string, string> {
  return {
    ...(appVersion && { 'X-App-Version': appVersion }),
    ...(appBuild && { 'X-App-Build': appBuild }),
    ...getDeviceHeaders(),
  };
}

/** 요청마다 정하는 헤더. 언어·시간대는 실행 중 바뀔 수 있고 요청 ID는 요청마다 새로 만든다. */
export function setPerRequestHeaders(headers: Headers): void {
  headers.set(REQUEST_ID_HEADER, Crypto.randomUUID());
  headers.set('X-Timezone', getDeviceTimezone());
  if (i18n.language) {
    headers.set('Accept-Language', i18n.language);
  }
}

/**
 * ky v2의 beforeRequest는 최초 1회만 실행된다(재시도 시 재실행 안 함). 401 갱신 뒤 재시도는
 * 원 요청의 헤더를 복사하므로 같은 요청 ID로 서버에 다시 도착한다.
 */
export function applyPerRequestHeaders({ request }: BeforeRequestState): void {
  setPerRequestHeaders(request.headers);
}
