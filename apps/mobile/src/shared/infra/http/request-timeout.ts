import { SECOND_MS } from '@src/shared/constants/time-units';

/** 공개 API와 인증 API 클라이언트가 같이 쓰는 요청 제한 시간. 한쪽만 바뀌면 로그인 전후 대기 시간이 달라진다 */
export const API_REQUEST_TIMEOUT_MS = 10 * SECOND_MS;
