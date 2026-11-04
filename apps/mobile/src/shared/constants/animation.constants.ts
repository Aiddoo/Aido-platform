/**
 * 애니메이션 상수
 * React Native Reanimated에서 사용하는 duration, delay 값
 */
export const ANIMATION = {
  duration: {
    fast: 150,
    normal: 200,
    slow: 300,
    /** 새 알림 종 흔들기처럼 한 번 눈길을 끄는 강조 */
    emphasis: 600,
  },
  delay: {
    short: 50,
    medium: 100,
    long: 200,
  },
} as const;
