import { toEpochMs, toInstant } from '@src/shared/date/instant';

import { createPushPermission } from '../__tests__/notification.fixtures';
import { PUSH_PROMPT_SNOOZE_DAYS } from '../constants/notification.constants';
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

describe('isPromptSnoozed', () => {
  it('닫은 적이 없으면 안내를 숨기지 않는다', () => {
    // When
    const result = PushPermissionPolicy.isPromptSnoozed(null, NOW);

    // Then
    expect(result).toBe(false);
  });

  it('닫은 뒤 14일이 되기 직전까지 숨기고 14일째부터 다시 보인다', () => {
    // Given
    const dismissedAt = toInstant(
      new Date(toEpochMs(NOW) - PUSH_PROMPT_SNOOZE_DAYS * DAY_MS).toISOString(),
    );

    // When
    const justBefore = PushPermissionPolicy.isPromptSnoozed(
      dismissedAt,
      toInstant(new Date(toEpochMs(NOW) - 1).toISOString()),
    );
    const atBoundary = PushPermissionPolicy.isPromptSnoozed(dismissedAt, NOW);

    // Then
    expect(justBefore).toBe(true);
    expect(atBoundary).toBe(false);
  });
});
