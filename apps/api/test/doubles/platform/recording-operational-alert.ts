import {
  type OperationalAlert,
  OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";

export class RecordingOperationalAlert extends OperationalAlertPort {
  readonly alerts: OperationalAlert[] = [];

  raise(alert: OperationalAlert): void {
    this.alerts.push(alert);
  }
}
