export const PushDeviceLogEvent = {
  RELEASE_SESSION_PUSH_DEVICES_RELEASED:
    "notification.delivery.release-session-push-devices.released",
  REPORT_PUSH_DEVICE_REPORTED: "notification.delivery.report-push-device.reported",
  REPORT_PUSH_DEVICE_OWNER_TRANSFERRED:
    "notification.delivery.report-push-device.owner.transferred",
  REPORT_PUSH_DEVICE_TOKEN_CONFLICT_RETRIED:
    "notification.delivery.report-push-device.token-conflict.retried",
  UNREGISTER_PUSH_DEVICE_UNREGISTERED: "notification.delivery.unregister-push-device.unregistered",
  UNREGISTER_PUSH_DEVICE_ALL_UNREGISTERED:
    "notification.delivery.unregister-push-device.all.unregistered",
  PUSH_DEVICE_UNREGISTERED_BY_TOKEN: "notification.push.device-by-token.unregistered",
} as const;
