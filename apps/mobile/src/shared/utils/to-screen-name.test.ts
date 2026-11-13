import { toScreenName } from './to-screen-name';

describe('toScreenName', () => {
  it.each([
    [['invite', '[inviteCode]'], '/invite/[inviteCode]'],
    [['(app)', 'users', '[userId]', 'report'], '/users/[userId]/report'],
    [
      ['(app)', 'todo', '[todoId]', 'comments', '[commentId]', 'report'],
      '/todo/[todoId]/comments/[commentId]/report',
    ],
  ] as const)('동적 세그먼트 %p는 실제 값 대신 템플릿 %p로 남긴다', (segments, expected) => {
    // When
    const screenName = toScreenName(segments);

    // Then
    expect(screenName).toBe(expected);
  });

  it.each([
    [['(app)', '(tabs)', 'feed'], '/feed'],
    [['(auth)', 'login'], '/login'],
    [['(app)', 'memo', '[memoId]', 'index'], '/memo/[memoId]'],
    [['(app)', 'settings', 'notifications', 'index'], '/settings/notifications'],
  ] as const)('그룹과 index는 URL처럼 빼서 %p를 %p로 만든다', (segments, expected) => {
    // When
    const screenName = toScreenName(segments);

    // Then
    expect(screenName).toBe(expected);
  });

  it('세그먼트가 없는 첫 화면은 루트로 남긴다', () => {
    // When
    const screenName = toScreenName([]);

    // Then
    expect(screenName).toBe('/');
  });
});
