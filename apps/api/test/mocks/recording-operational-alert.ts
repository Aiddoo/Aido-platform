import type {
  OperationalAlert,
  OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";

/** 올린 운영 경보를 순서대로 모은다. */
export class RecordingOperationalAlert implements OperationalAlertPort {
  readonly alerts: OperationalAlert[] = [];

  raise(alert: OperationalAlert): void {
    this.alerts.push(alert);
  }
}
