import { toEpochMs, toInstant } from '@src/shared/date/instant';

import { createPushPermission } from '../__tests__/notification.fixtures';
import {
  PUSH_ONBOARDING_WINDOW_DAYS,
  PUSH_PROMPT_SNOOZE_DAYS,
} from '../constants/notification.constants';
import { PushPermissionPolicy } from './push-permission.model';

const NOW = toInstant('2026-11-04T09:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

describe('getNextStep', () => {
  it('iOS 임시 허용은 알림이 오므로 앱 설정만 켜져 있으면 더 할 일이 없다', () => {
    // Given
    const permission = createPushPermission({ status: 'PROVISIONAL', canAskAgain: true });

    // When
    const step = PushPermissionPolicy.getNextStep(permission, { pushEnabled: true });

    // Then
    expect(step).toBe('NONE');
  });

  it('OS는 허용했지만 앱 푸시 설정을 껐으면 앱 안에서 켜게 한다', () => {
    // Given
    const permission = createPushPermission({ status: 'GRANTED' });

    // When
    const step = PushPermissionPolicy.getNextStep(permission, { pushEnabled: false });

    // Then
    expect(step).toBe('ENABLE_IN_APP');
  });

  it('아직 묻지 않았으면 앱 안에서 먼저 묻는다', () => {
    // Given
    const permission = createPushPermission({ status: 'NOT_DETERMINED', canAskAgain: true });

    // When
    const step = PushPermissionPolicy.getNextStep(permission, { pushEnabled: true });

    // Then
    expect(step).toBe('ASK');
  });

  it('Android에서 한 번 거절했어도 다시 물을 수 있으면 시스템 창을 띄운다', () => {
    // Given
    const permission = createPushPermission({ status: 'DENIED', canAskAgain: true });

    // When
    const step = PushPermissionPolicy.getNextStep(permission, { pushEnabled: true });

    // Then
    expect(step).toBe('REQUEST_SYSTEM');
  });

  it('거절했고 다시 물을 수 없으면 설정 앱으로 보낸다', () => {
    // Given
    const permission = createPushPermission({ status: 'DENIED', canAskAgain: false });

    // When
    const step = PushPermissionPolicy.getNextStep(permission, { pushEnabled: true });

    // Then
    expect(step).toBe('OPEN_SETTINGS');
  });
});

describe('getDeviceStep', () => {
  it('기기가 허용했으면 앱 안 푸시 설정과 상관없이 기기에서 할 일이 없다', () => {
    // Given
    const permission = createPushPermission({ status: 'GRANTED' });

    // When
    const step = PushPermissionPolicy.getDeviceStep(permission);

    // Then
    expect(step).toBe('NONE');
  });
});

describe('isPushDeliverable', () => {
  it.each([
    ['GRANTED', true],
    ['PROVISIONAL', true],
    ['DENIED', false],
    ['NOT_DETERMINED', false],
  ] as const)('권한이 %s면 푸시를 받을 수 있는지는 %s다', (status, expected) => {
    // Given
    const permission = createPushPermission({ status });

    // When
    const result = PushPermissionPolicy.isPushDeliverable(permission);

    // Then
    expect(result).toBe(expected);
  });
});

describe('canRequestSystemDialog', () => {
  it('이미 허용했으면 시스템 창을 다시 띄우지 않는다', () => {
    // Given
    const permission = createPushPermission({ status: 'PROVISIONAL', canAskAgain: true });

    // When
    const result = PushPermissionPolicy.canRequestSystemDialog(permission);

    // Then
    expect(result).toBe(false);
  });
});

describe('getAskMoment', () => {
  const SIGNED_UP_AT = toInstant('2026-11-04T08:00:00.000Z');
  const NOT_ASKED = createPushPermission({ status: 'NOT_DETERMINED', canAskAgain: true });
  const DENIED = createPushPermission({ status: 'DENIED', canAskAgain: false });
  const NO_ANSWER = { deferredAt: null, noticeDismissedAt: null };

  const shiftedFromNow = (ms: number) => toInstant(new Date(toEpochMs(NOW) + ms).toISOString());

  it.each([
    [
      '가입 직후 아직 묻지 않았으면 알림 화면',
      NOT_ASKED,
      SIGNED_UP_AT,
      NO_ANSWER,
      'ONBOARDING_SCREEN',
    ],
    ['알림 화면을 닫았으면 다시 띄우지 않는다', NOT_ASKED, SIGNED_UP_AT, { deferredAt: NOW }, null],
    [
      '이미 허용했으면 묻지 않는다',
      createPushPermission({ status: 'GRANTED' }),
      SIGNED_UP_AT,
      NO_ANSWER,
      null,
    ],
    ['이미 거절했으면 알림 화면을 건너뛴다', DENIED, SIGNED_UP_AT, NO_ANSWER, null],
    [
      '가입한 지 하루가 지난 기존 사용자에게는 띄우지 않는다',
      NOT_ASKED,
      shiftedFromNow(-PUSH_ONBOARDING_WINDOW_DAYS * DAY_MS),
      NO_ANSWER,
      null,
    ],
  ] as const)('%s', (_label, permission, signedUpAt, prompt, expected) => {
    // When
    const moment = PushPermissionPolicy.getAskMoment(permission, {
      surface: 'onboarding',
      signedUpAt,
      prompt,
      now: NOW,
    });

    // Then
    expect(moment).toBe(expected);
  });

  it.each([
    ['아직 묻지 않았으면 그 자리에서 시스템 창', NOT_ASKED, 'SYSTEM_DIALOG'],
    [
      'Android에서 한 번 거절했어도 꺼짐 안내',
      createPushPermission({ status: 'DENIED', canAskAgain: true }),
      'DENIED_NOTICE',
    ],
    ['거절했으면 꺼짐 안내', DENIED, 'DENIED_NOTICE'],
    [
      'iOS 임시 허용은 알림이 오므로 안내하지 않는다',
      createPushPermission({ status: 'PROVISIONAL' }),
      null,
    ],
  ] as const)('할 일 시간을 정할 때 %s', (_label, permission, expected) => {
    // When
    const moment = PushPermissionPolicy.getAskMoment(permission, { surface: 'todo-time' });

    // Then
    expect(moment).toBe(expected);
  });

  it.each([
    ['거절했고 알림이 갈 할 일이 있으면 꺼짐 안내', DENIED, true, null, 'DENIED_NOTICE'],
    ['알림이 갈 할 일이 없으면 안내하지 않는다', DENIED, false, null, null],
    ['아직 묻지 않았으면 피드에서는 묻지 않는다', NOT_ASKED, true, null, null],
    [
      '닫은 지 14일이 되기 직전까지 숨긴다',
      DENIED,
      true,
      shiftedFromNow(-PUSH_PROMPT_SNOOZE_DAYS * DAY_MS + 1),
      null,
    ],
    [
      '닫은 지 14일째부터 다시 보인다',
      DENIED,
      true,
      shiftedFromNow(-PUSH_PROMPT_SNOOZE_DAYS * DAY_MS),
      'DENIED_NOTICE',
    ],
  ] as const)(
    '피드에서 %s',
    (_label, permission, hasUpcomingTimedTodo, noticeDismissedAt, expected) => {
      // When
      const moment = PushPermissionPolicy.getAskMoment(permission, {
        surface: 'feed',
        hasUpcomingTimedTodo,
        prompt: { noticeDismissedAt },
        now: NOW,
      });

      // Then
      expect(moment).toBe(expected);
    },
  );
});

describe('canReceivePush', () => {
  it.each([
    ['GRANTED', true, true],
    ['PROVISIONAL', true, true],
    ['GRANTED', false, false],
    ['DENIED', true, false],
    ['NOT_DETERMINED', true, false],
  ] as const)(
    '권한 %s, 앱 푸시 %s면 할 일 알림이 닿는지는 %s다',
    (status, pushEnabled, expected) => {
      // When
      const result = PushPermissionPolicy.canReceivePush(createPushPermission({ status }), {
        pushEnabled,
      });

      // Then
      expect(result).toBe(expected);
    },
  );
});

describe('isNotDetermined', () => {
  it('아직 묻지 않은 권한이면 시스템 창을 띄울 차례다', () => {
    // Given
    const permission = createPushPermission({ status: 'NOT_DETERMINED' });

    // When
    const result = PushPermissionPolicy.isNotDetermined(permission);

    // Then
    expect(result).toBe(true);
  });

  it.each(['GRANTED', 'PROVISIONAL', 'DENIED'] as const)(
    '%s로 이미 답한 권한은 정해진 상태다',
    (status) => {
      // Given
      const permission = createPushPermission({ status });

      // When
      const result = PushPermissionPolicy.isNotDetermined(permission);

      // Then
      expect(result).toBe(false);
    },
  );
});
