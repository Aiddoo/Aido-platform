export interface AdminNotificationField {
  readonly name: string;
  readonly value: string;
  readonly inline?: boolean;
}

export interface AdminNotification {
  readonly title: string;
  readonly body: string;
  readonly fields?: readonly AdminNotificationField[];
  readonly color?: number;
}
