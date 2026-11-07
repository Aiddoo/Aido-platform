import { toScreenName } from './to-screen-name';

describe('toScreenName', () => {
  it.each([
    [['invite', '[inviteCode]'], '/invite/[inviteCode]'],
    [['(app)', 'users', '[userId]', 'report'], '/users/[userId]/report'],
    [
      ['(app)', 'todo', '[todoId]', 'comments', '[commentId]'],
      '/todo/[todoId]/comments/[commentId]',
    ],
  ] as const)('동적 세그먼트 %p는 실제 값 대신 템플릿 %p로 남긴다', (segments, expected) => {
    // Given 초대 코드·사용자 id가 들어가는 화면 / When 화면 이름을 만들면 / Then 템플릿만 남는다
    expect(toScreenName(segments)).toBe(expected);
  });

  it.each([
    [['(app)', '(tabs)', 'feed'], '/feed'],
    [['(auth)', 'login'], '/login'],
    [['(app)', 'memo', '[memoId]', 'index'], '/memo/[memoId]'],
    [['(app)', 'settings', 'notifications', 'index'], '/settings/notifications'],
  ] as const)('그룹과 index는 URL처럼 빼서 %p를 %p로 만든다', (segments, expected) => {
    // Given 그룹·index가 섞인 세그먼트 / When 화면 이름을 만들면 / Then URL과 같은 모양이다
    expect(toScreenName(segments)).toBe(expected);
  });

  it('세그먼트가 없는 첫 화면은 루트로 남긴다', () => {
    // Given 루트 index / When 화면 이름을 만들면 / Then '/'이다
    expect(toScreenName([])).toBe('/');
  });
});
