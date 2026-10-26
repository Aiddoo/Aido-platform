import { getCategoryKey } from './notification-category.view-model';

describe('getCategoryKey', () => {
  test.each([
    'INVITE_JOINED',
    'INVITE_REWARDED',
    'INVITE_PROGRESS',
    'INVITE_QUALIFY_REMINDER',
  ] as const)('초대 알림 %s는 알림함에서 친구 라벨로 보인다', (type) => {
    expect(getCategoryKey(type)).toBe('friend');
  });
});
