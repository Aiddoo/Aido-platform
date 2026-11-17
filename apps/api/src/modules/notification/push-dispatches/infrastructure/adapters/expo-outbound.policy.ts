import type { OutboundPolicySpec } from "#api/platform/resilience/outbound-policy";

/**
 * Expo 푸시 발송·receipt 조회. SDK가 abort signal을 받지 않아 30초를 넘기면 기다리기를 멈추고
 * 재시도 가능한 transport 오류로 넘긴다(재시도는 SDK·pg-boss 한 층). 무료·비동기라 회로는 두지 않는다.
 */
export const EXPO_PUSH_POLICY: OutboundPolicySpec = { name: "expo", timeoutMs: 30_000 };
