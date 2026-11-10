export const TodoSeriesLogEvent = {
  STARTED: "planning.todo-series.started",
  STOPPED: "planning.todo-series.stopped",
  SPLIT: "planning.todo-series.split",
  MATERIALIZED: "planning.todo-series.materialized",
  MATERIALIZE_FAILED: "planning.todo-series.materialize-failed",
  CATCH_UP_COMPLETED: "planning.todo-series.catch-up.completed",
  CATCH_UP_FAILED: "planning.todo-series.catch-up.failed",
  MATERIALIZE_SCHEDULER_REGISTERED: "planning.todo-series.materialize-scheduler-registered",
  MATERIALIZE_CATCH_UP_DISPATCHED: "planning.todo-series.materialize-catch-up-dispatched",
} as const;
