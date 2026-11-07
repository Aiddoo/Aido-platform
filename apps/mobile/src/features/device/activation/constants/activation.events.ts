export type ActivationCompletedEvent = {
  campaign_id: string;
  days_since_signup: number;
};

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    activation_completed: ActivationCompletedEvent;
  }
}
