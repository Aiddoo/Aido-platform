export type ActivationCompletedEvent = {
  days_since_signup: number;
};

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    activation_completed: ActivationCompletedEvent;
  }
}
