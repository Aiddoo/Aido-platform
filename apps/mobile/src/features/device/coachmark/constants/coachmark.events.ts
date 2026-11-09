import type { CoachmarkKind } from '../domains/coachmark.model';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    coachmark_shown: { kind: CoachmarkKind };
    coachmark_dismissed: { kind: CoachmarkKind };
  }
}
