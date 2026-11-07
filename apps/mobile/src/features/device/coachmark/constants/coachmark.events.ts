import type { CoachmarkKind } from '../schemas/coachmark.schema';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    coachmark_shown: { kind: CoachmarkKind };
    coachmark_dismissed: { kind: CoachmarkKind };
  }
}

export {};
