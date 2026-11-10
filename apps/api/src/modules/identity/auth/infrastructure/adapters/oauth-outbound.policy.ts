import type { OutboundPolicySpec } from "#api/platform/resilience/outbound-policy";

/**
 * 회로와 bulkhead를 두지 않는다. 거절이 생기면 공급자가 살아 있어도 로그인이 실패하기 때문이다.
 * 공급자마다 정책을 나눠 한 곳의 설정이 다른 로그인으로 번지지 않게 한다.
 * 시도별 timeout은 http-client(OAUTH_PROVIDER_TIMEOUT_MS)가 건다. 인가 코드가 일회용이라 재시도는 없다.
 */
/** 공급자가 응답하지 않아도 로그인 요청을 오래 붙잡지 않도록 OAuth 공급자 호출마다 거는 시간 제한 */
export const OAUTH_PROVIDER_TIMEOUT_MS = 10_000;

export const GOOGLE_OAUTH_POLICY: OutboundPolicySpec = { name: "oauth:google" };
export const KAKAO_OAUTH_POLICY: OutboundPolicySpec = { name: "oauth:kakao" };
export const NAVER_OAUTH_POLICY: OutboundPolicySpec = { name: "oauth:naver" };
