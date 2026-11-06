import type { CoachmarkKind } from '../apis/coachmark.repository';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    coachmark_shown: { kind: CoachmarkKind };
    coachmark_dismissed: { kind: CoachmarkKind };
  }
}

export {};
