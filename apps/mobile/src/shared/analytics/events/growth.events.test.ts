import { toFriendSearchLengthBucket } from './growth.events';

describe('toFriendSearchLengthBucket', () => {
  it.each([
    ['가나', '2_3'],
    ['Aido', '4_7'],
    ['ABCDEFGH', '8_plus'],
    ['  Matthew  ', '4_7'],
  ] as const)('검색 원문 %p를 저카디널리티 길이 버킷으로만 바꾼다', (query, expected) => {
    expect(toFriendSearchLengthBucket(query)).toBe(expected);
  });
});
