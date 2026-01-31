import { ClientError } from '@src/shared/errors';

/**
 * Base error for notification-related operations
 */
export class NotificationError extends ClientError {
  override readonly name: string = 'NotificationError';
  readonly code: string = 'NOTIFICATION_ERROR';

  constructor(message = '알림 작업에 실패했어요') {
    super(message);
  }
}

/**
 * Thrown when user denies notification permission
 */
export class NotificationPermissionDeniedError extends NotificationError {
  override readonly name: string = 'NotificationPermissionDeniedError';
  override readonly code: string = 'NOTIFICATION_PERMISSION_DENIED';

  constructor() {
    super('알림 권한이 거부되었어요. 설정에서 알림을 허용해주세요.');
  }
}

/**
 * Thrown when push notifications are not available (simulator/emulator)
 */
export class NotificationNotPhysicalDeviceError extends NotificationError {
  override readonly name: string = 'NotificationNotPhysicalDeviceError';
  override readonly code: string = 'NOTIFICATION_NOT_PHYSICAL_DEVICE';

  constructor() {
    super('푸시 알림은 실제 기기에서만 사용할 수 있어요.');
  }
}

/**
 * Thrown when push token validation fails
 */
export class NotificationValidationError extends NotificationError {
  override readonly name: string = 'NotificationValidationError';
  override readonly code: string = 'NOTIFICATION_VALIDATION_ERROR';

  constructor(message = '알림 데이터 검증에 실패했어요') {
    super(message);
  }
}

/**
 * Type guard for notification errors
 */
export const isNotificationError = (error: unknown): error is NotificationError =>
  error instanceof NotificationError;
