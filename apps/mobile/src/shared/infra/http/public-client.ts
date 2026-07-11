import { ENV } from '@src/shared/config/env';
import { i18n } from '@src/shared/i18n';
import { getDeviceTimezone } from '@src/shared/utils/timezone';
import ky, { type KyInstance } from 'ky';
import { recordPublicApiFailureBreadcrumb } from './error-handler';

/**
 * 토큰 없이 호출하는 공개 API용 HTTP 클라이언트
 * - 로그인, 회원가입 등 인증 전 요청에 사용
 */
export const createPublicClient = (): KyInstance => {
  return ky.create({
    prefixUrl: ENV.API_URL,
    timeout: 10_000,
    // 재시도 정책은 React Query가 소유한다(`shouldRetryQuery`) — auth-client와 동일.
    retry: 0,
    headers: {
      'Content-Type': 'application/json',
      'X-Timezone': getDeviceTimezone(),
    },
    hooks: {
      beforeRequest: [
        (request) => {
          // 언어는 런타임에 바뀔 수 있으므로 정적 headers가 아닌 훅에서 주입한다
          if (i18n.language) {
            request.headers.set('Accept-Language', i18n.language);
          }
        },
      ],
      afterResponse: [recordPublicApiFailureBreadcrumb],
    },
  });
};
