import { ENV } from '@src/shared/config/env';
import ky, { type KyInstance } from 'ky';
import { handleApiErrors } from './error-handler';

/**
 * 토큰 없이 호출하는 공개 API용 HTTP 클라이언트
 * - 로그인, 회원가입 등 인증 전 요청에 사용
 */
export const createPublicClient = (): KyInstance => {
  return ky.create({
    prefixUrl: ENV.API_URL,
    timeout: 10_000,
    headers: {
      'Content-Type': 'application/json',
    },
    hooks: {
      afterResponse: [handleApiErrors],
    },
  });
};
