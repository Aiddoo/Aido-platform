import { createPushNotification } from '../__tests__/notification.fixtures';
import { getForegroundPushPresentation } from './foreground-push-presentation.view-model';

describe('getForegroundPushPresentation', () => {
  it.each([
    [
      '알림함을 보고 있으면',
      'FOLLOW_NEW',
      { isViewingInbox: true, isViewingDestination: false },
      'quiet',
    ],
    [
      '받을 때 다시 받는 화면(콕)을 보고 있으면',
      'NUDGE_RECEIVED',
      { isViewingInbox: false, isViewingDestination: true },
      'quiet',
    ],
    [
      '다시 받지 않는 화면(공유한 할 일)을 보고 있으면',
      'TODO_SHARED',
      { isViewingInbox: false, isViewingDestination: true },
      'banner',
    ],
    [
      '다른 화면을 보고 있으면',
      'NUDGE_RECEIVED',
      { isViewingInbox: false, isViewingDestination: false },
      'banner',
    ],
    [
      '모르는 타입은 알림함을 보고 있어도',
      null,
      { isViewingInbox: true, isViewingDestination: true },
      'banner',
    ],
  ] as const)('%s(%s) %s로 보인다', (_case, type, viewing, expected) => {
    // Given
    const pushNotification = createPushNotification({ type });

    // When
    const presentation = getForegroundPushPresentation(pushNotification, viewing);

    // Then
    expect(presentation).toBe(expected);
  });
});
