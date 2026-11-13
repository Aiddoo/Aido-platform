import { parsePushNotification } from './push-notification.mapper';

const DATA = {
  notificationId: 7,
  type: 'NUDGE_RECEIVED',
  action: { type: 'DEEP_LINK' },
  navigation: { kind: 'NUDGE', nudgeId: 3 },
};

describe('parsePushNotification', () => {
  it('계약에 맞는 data를 앱 모델로 읽고 옛 앱용 이동 재료와 모르는 키는 버린다', () => {
    // When
    const result = parsePushNotification({
      ...DATA,
      context: { nudgeId: 3 },
      routing: { senderName: '지윤' },
      marketingOptOutToken: 'opt-out-token',
      campaignKey: 'spring',
      purpose: 'ENGAGEMENT',
      dispatchId: 3,
      unknownField: 'ignored',
    });

    // Then
    expect(result).toEqual({
      notification: {
        notificationId: 7,
        type: 'NUDGE_RECEIVED',
        target: { kind: 'NUDGE', nudgeId: 3 },
        marketingOptOutToken: 'opt-out-token',
        actionType: 'DEEP_LINK',
        campaignKey: 'spring',
        variantId: null,
        purpose: 'ENGAGEMENT',
      },
      droppedPaths: [],
    });
  });

  it('옛 앱용 이동 재료가 깨져도 navigation대로 열고 버린 칸으로 세지 않는다', () => {
    // When
    const result = parsePushNotification({ ...DATA, context: 'broken' });

    // Then
    expect(result.notification?.target).toEqual({ kind: 'NUDGE', nudgeId: 3 });
    expect(result.droppedPaths).toEqual([]);
  });

  it('모르는 종류는 그 칸만 null로 버리고 경로를 알린다', () => {
    // When
    const result = parsePushNotification({ ...DATA, type: 'NEW_KIND' });

    // Then
    expect(result.notification).toMatchObject({
      type: null,
      target: { kind: 'NUDGE', nudgeId: 3 },
    });
    expect(result.droppedPaths).toEqual(['type']);
  });

  it.each([
    ['서버의 새 kind', { kind: 'NEW_SCREEN' }],
    ['틀린 모양의 navigation', { kind: 'TODO', todoId: 'x' }],
  ])('%s는 알림함으로 열고 버린 경로를 알린다', (_case, navigation) => {
    // When
    const result = parsePushNotification({ ...DATA, navigation });

    // Then
    expect(result.notification).toMatchObject({
      type: 'NUDGE_RECEIVED',
      target: { kind: 'NOTIFICATIONS' },
    });
    expect(result.droppedPaths.every((path) => path.startsWith('navigation'))).toBe(true);
    expect(result.droppedPaths.length).toBeGreaterThan(0);
  });

  it('navigation이 없으면 알림함으로 열고 버린 칸은 없다', () => {
    // When
    const result = parsePushNotification({ ...DATA, navigation: undefined });

    // Then
    expect(result).toMatchObject({
      notification: { target: { kind: 'NOTIFICATIONS' } },
      droppedPaths: [],
    });
  });

  it.each([
    ['모르는 purpose', 'purpose', { purpose: 'NEW_PURPOSE' }],
    ['너무 긴 campaignKey', 'campaignKey', { campaignKey: 'x'.repeat(101) }],
    ['숫자 variantId', 'variantId', { variantId: 42 }],
    ['숫자 수신 거부 토큰', 'marketingOptOutToken', { marketingOptOutToken: 42 }],
  ])('%s는 그 칸만 null이 되고 종류·목적지는 남는다', (_case, field, overrides) => {
    // When
    const result = parsePushNotification({ ...DATA, ...overrides });

    // Then
    expect(result.notification).toMatchObject({
      type: 'NUDGE_RECEIVED',
      target: { kind: 'NUDGE', nudgeId: 3 },
      [field]: null,
    });
    expect(result.droppedPaths).toEqual([field]);
  });

  it('읽음 ID와 액션이 깨져도 탭은 동작한다', () => {
    // When
    const result = parsePushNotification({ type: 'FOLLOW_NEW' });

    // Then
    expect(result.notification).toMatchObject({ notificationId: 0, actionType: 'DEEP_LINK' });
    expect(result.droppedPaths).toEqual(['notificationId', 'action']);
  });

  it.each([
    ['data가 없으면', undefined],
    ['객체가 아니면', 'broken'],
  ])('%s 읽지 못해 null이다', (_case, data) => {
    // When
    const result = parsePushNotification(data);

    // Then
    expect(result.notification).toBeNull();
    expect(result.droppedPaths.length).toBeGreaterThan(0);
  });
});
