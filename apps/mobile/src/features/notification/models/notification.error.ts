import type { BusinessError } from '@src/shared/errors';

export const NotificationErrorCode = {
  PERMISSION_DENIED: 'NOTIFICATION_PERMISSION_DENIED',
  NOT_PHYSICAL_DEVICE: 'NOTIFICATION_NOT_PHYSICAL_DEVICE',
  VALIDATION_FAILED: 'NOTIFICATION_VALIDATION_FAILED',
} as const;

export type NotificationErrorCode =
  (typeof NotificationErrorCode)[keyof typeof NotificationErrorCode];

export class NotificationError extends Error implements BusinessError {
  override readonly name = 'NotificationError';

  constructor(
    public readonly code: NotificationErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const NotificationErrors = {
  permissionDenied: () =>
    new NotificationError(
      NotificationErrorCode.PERMISSION_DENIED,
      '알림 권한이 거부되었어요. 설정에서 알림을 허용해주세요.',
    ),
  notPhysicalDevice: () =>
    new NotificationError(
      NotificationErrorCode.NOT_PHYSICAL_DEVICE,
      '푸시 알림은 실제 기기에서만 사용할 수 있어요.',
    ),
  validationFailed: () =>
    new NotificationError(NotificationErrorCode.VALIDATION_FAILED, '알림 데이터 검증에 실패했어요'),
} as const;

export const isNotificationError = (error: unknown): error is NotificationError =>
  error instanceof NotificationError;

export const isPermissionDeniedError = (error: unknown): boolean =>
  error instanceof NotificationError && error.code === NotificationErrorCode.PERMISSION_DENIED;

export const isNotPhysicalDeviceError = (error: unknown): boolean =>
  error instanceof NotificationError && error.code === NotificationErrorCode.NOT_PHYSICAL_DEVICE;
