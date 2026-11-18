import { normalizeIp } from "@nestjs/throttler";

// IP 요청 한도(ThrottlerGuard 기본 tracker)와 같은 기준이다. IPv6는 가입자 하나가 /64 대역을 받아 주소마다 세면 피해 간다
export function requestSourceKey(ip: string): string {
  return normalizeIp(ip);
}
