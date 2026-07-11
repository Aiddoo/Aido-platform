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

describe('toSearchedUserViewModel', () => {
  test('name이 있으면 displayName으로 사용한다', () => {
    const vm = toSearchedUserViewModel(baseUser({ name: '홍길동' }));
    expect(vm.displayName).toBe('홍길동');
  });

  test('name이 null이면 fallback 이름을 사용한다', () => {
    const vm = toSearchedUserViewModel(baseUser({ name: null }));
    // i18n 미초기화 시 키가 반환되어도 최소한 빈 값이 아님
    expect(vm.displayName).toBeTruthy();
  });

  test('isFriend면 actionState=friend', () => {
    const vm = toSearchedUserViewModel(baseUser({ isFriend: true }));
    expect(vm.actionState).toBe('friend');
  });

  test('requestPending이면 actionState=pending', () => {
    const vm = toSearchedUserViewModel(baseUser({ requestPending: true }));
    expect(vm.actionState).toBe('pending');
  });

  test('관계 없으면 actionState=add', () => {
    const vm = toSearchedUserViewModel(baseUser());
    expect(vm.actionState).toBe('add');
  });

  test('isFriend가 requestPending보다 우선한다', () => {
    const vm = toSearchedUserViewModel(baseUser({ isFriend: true, requestPending: true }));
    expect(vm.actionState).toBe('friend');
  });
});
