import { FriendPolicy } from './friend.model';

describe('FriendPolicy.isValidSearchQuery', () => {
  test('2자 이상이면 true', () => {
    expect(FriendPolicy.isValidSearchQuery('홍길')).toBe(true);
    expect(FriendPolicy.isValidSearchQuery('ab')).toBe(true);
  });

  test('trim 후 2자 이상으로 판정한다', () => {
    expect(FriendPolicy.isValidSearchQuery('  홍길동  ')).toBe(true);
  });

  test('2자 미만이면 false', () => {
    expect(FriendPolicy.isValidSearchQuery('a')).toBe(false);
    expect(FriendPolicy.isValidSearchQuery(' a ')).toBe(false);
    expect(FriendPolicy.isValidSearchQuery('')).toBe(false);
  });
});

describe('FriendPolicy.isValidTag', () => {
  test('8자리 영문 대문자·숫자면 true', () => {
    expect(FriendPolicy.isValidTag('ABCD1234')).toBe(true);
  });

  test('형식이 어긋나면 false', () => {
    expect(FriendPolicy.isValidTag('abcd1234')).toBe(false);
    expect(FriendPolicy.isValidTag('ABC123')).toBe(false);
  });
});
