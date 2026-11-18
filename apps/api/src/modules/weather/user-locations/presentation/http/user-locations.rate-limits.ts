import { defineRateLimits } from "#api/platform/throttle/rate-limits";

// 리포트 조회는 저장된 위치만 쓰므로 공급자 호출을 늘리는 수단은 위치 변경이다. 먼 좌표를 바꿔 가며
// 새 칸을 만드는 요청이 WeatherKit 월 호출량을 쓰지 못하게 위치 변경을 더 좁게 막는다
export const UserLocationRateLimits = defineRateLimits({
  update: { limitPerMinute: 10 },
});
