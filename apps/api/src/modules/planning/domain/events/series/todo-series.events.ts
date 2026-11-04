export const TODO_SERIES_EVENTS = {
  STARTED: "todo-series.started",
  ENDED: "todo-series.ended",
} as const;

export class TodoSeriesStartedEvent {
  readonly eventName = TODO_SERIES_EVENTS.STARTED;

  constructor(
    public readonly seriesId: string,
    public readonly userId: string,
  ) {}
}

export class TodoSeriesEndedEvent {
  readonly eventName = TODO_SERIES_EVENTS.ENDED;

  constructor(
    public readonly seriesId: string,
    public readonly userId: string,
  ) {}
}
