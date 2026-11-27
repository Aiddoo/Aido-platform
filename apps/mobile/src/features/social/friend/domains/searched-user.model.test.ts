import { createSearchedUser } from '../__tests__/friend.fixtures';
import { SearchedUserPolicy } from './searched-user.model';

describe('SearchedUserPolicy', () => {
  describe('getRequestState', () => {
    it.each([
      { isFriend: true, requestPending: false, expected: 'friend' },
      { isFriend: true, requestPending: true, expected: 'friend' },
      { isFriend: false, requestPending: true, expected: 'pending' },
      { isFriend: false, requestPending: false, expected: 'none' },
    ] as const)(
      '친구 $isFriend, 요청 대기 $requestPending이면 $expected로 본다',
      ({ expected, isFriend, requestPending }) => {
        // Given
        const user = createSearchedUser({ isFriend, requestPending });

        // When
        const state = SearchedUserPolicy.getRequestState(user);

        // Then
        expect(state).toBe(expected);
      },
    );
  });
});
