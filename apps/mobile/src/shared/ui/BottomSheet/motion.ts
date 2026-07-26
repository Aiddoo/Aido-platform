export const resolveSheetAnimationDuration = (
  prefersReducedMotion: boolean,
  duration: number,
): number => (prefersReducedMotion ? 0 : duration);
