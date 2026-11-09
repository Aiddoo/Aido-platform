import type { PushPermission } from '../domains/push-permission.model';
import { toPushSummary } from './push-permission.view-model';

describe('toPushSummary', () => {
  it.each([
    [
      '앱 설정은 켜져 있어도 기기 알림이 꺼져 있으면 기기에서 꺼짐',
      { status: 'DENIED', canAskAgain: false },
      true,
      'deviceOff',
    ],
    [
      '기기 알림을 허용했으면 서버 설정대로 켜짐',
      { status: 'GRANTED', canAskAgain: true },
      true,
      'on',
    ],
    [
      'iOS 임시 허용은 조용히 도착하므로 켜짐',
      { status: 'PROVISIONAL', canAskAgain: true },
      true,
      'on',
    ],
    [
      '기기 알림을 아직 묻지 않았으면 거절한 것이 아니라 꺼짐',
      { status: 'NOT_DETERMINED', canAskAgain: true },
      true,
      'off',
    ],
    [
      '앱 설정에서 끈 푸시는 기기 권한과 상관없이 꺼짐',
      { status: 'DENIED', canAskAgain: false },
      false,
      'off',
    ],
  ] as const satisfies ReadonlyArray<readonly [string, PushPermission, boolean, string]>)(
    '%s이다',
    (_case, permission, pushEnabled, expected) => {
      // Given
      const settings = { pushEnabled };

      // When
      const summary = toPushSummary(permission, settings);

      // Then
      expect(summary).toBe(expected);
    },
  );
});
