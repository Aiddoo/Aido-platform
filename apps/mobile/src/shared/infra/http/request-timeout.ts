import { SECOND_MS } from '@src/shared/constants/time-units';

/** 한쪽만 바뀌면 로그인 전후 대기 시간이 달라진다 */
export const API_REQUEST_TIMEOUT_MS = 10 * SECOND_MS;

/** 서버 토큰 재사용 grace(10초)보다 짧게 잡는다. 응답이 유실되면 다음 재시도가 grace를 넘겨 재사용 공격으로 판정돼 토큰 패밀리가 폐기된다(SESSION_0704) */
export const REFRESH_TIMEOUT_MS = 8 * SECOND_MS;

/** 키체인 읽기는 보통 몇 ms다. 멈춘 읽기가 single-flight 갱신을 붙잡으면 뒤의 401이 모두 그 갱신을 기다리기만 한다 */
export const TOKEN_READ_TIMEOUT_MS = 4 * SECOND_MS;
