import type { ProfileChange } from '../schemas/update-profile-request.schema';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    /** 바꾼 칸마다 한 번이다 */
    profile_edited: { field: keyof ProfileChange };
  }
}
