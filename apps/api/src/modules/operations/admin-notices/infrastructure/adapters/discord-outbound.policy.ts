import type { OutboundPolicySpec } from "#api/platform/resilience/outbound-policy";

/**
 * 회로를 두지 않는다. 열린 회로가 pg-boss 재시도(2회)를 바로 소진해 알림을 잃게 하기 때문이다.
 * 시도별 timeout은 http-client(DISCORD_WEBHOOK_TIMEOUT_MS)가 걸고, 재시도는 pg-boss 한 층이다.
 */
export const DISCORD_WEBHOOK_POLICY: OutboundPolicySpec = { name: "discord" };
