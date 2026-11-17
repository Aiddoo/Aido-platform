import { defineRateLimits } from "#api/platform/throttle/rate-limits";

// 해제는 로그인 전 요청이라 IP로 센다. 앱은 세션이 끝날 때 한 번(실패하면 다음 실행에 한 번 더) 보낸다
export const PushDeviceRateLimits = defineRateLimits({
  unregisterByToken: { limitPerMinute: 20 },
});
