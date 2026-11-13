export const ANIMATION = {
  durationMs: {
    fast: 150,
    normal: 200,
    slow: 300,
    emphasis: 600,
  },
  delayMs: {
    short: 50,
    medium: 100,
    long: 200,
  },
  /** CSS 전환(Reanimated `transitionTimingFunction`) 곡선. 들어올 때는 빨리 시작해 부드럽게 멈춘다 */
  easing: {
    easeOut: 'ease-out',
  },
} as const;
