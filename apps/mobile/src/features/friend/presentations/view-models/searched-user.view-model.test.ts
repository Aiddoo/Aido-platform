import type { SearchedUser } from '../../models/friend.model';
import { toSearchedUserViewModel } from './searched-user.view-model';

const baseUser = (overrides: Partial<SearchedUser> = {}): SearchedUser => ({
  id: 'u1',
  userTag: 'ABCD1234',
  name: '홍길동',
  profileImage: null,
  isFollowing: false,
  isFollower: false,
  isFriend: false,
  requestPending: false,
  ...overrides,
});

describe('검색 사용자 행의 표시 상태', () => {
  test('사용자 이름을 번역된 기본 이름보다 우선 표시한다', () => {
    // Given
    const user = baseUser({ name: '홍길동' });

    // When
    const vm = toSearchedUserViewModel(user, '친구');

    // Then
    expect(vm.displayName).toBe('홍길동');
  });

  test('이름이 없으면 호출자가 전달한 언어의 이름을 표시한다', () => {
    // Given
    const user = baseUser({ name: null });

    // When
    const korean = toSearchedUserViewModel(user, '친구');
    const english = toSearchedUserViewModel(user, 'Friend');

    // Then
    expect(korean.displayName).toBe('친구');
    expect(english.displayName).toBe('Friend');
    expect(user.name).toBeNull();
  });

  test.each([
    ['이미 친구인 사용자', { isFriend: true }, 'friend'],
    ['요청이 대기 중인 사용자', { requestPending: true }, 'pending'],
    ['새 사용자', {}, 'add'],
    ['친구와 대기 상태가 함께 있는 사용자', { isFriend: true, requestPending: true }, 'friend'],
  ] as const)('%s에게 알맞은 행 액션을 표시한다', (_name, flags, expected) => {
    // Given
    const user = baseUser(flags);

    // When
    const vm = toSearchedUserViewModel(user, '친구');

    // Then
    expect(vm.actionState).toBe(expected);
  });
});
