export class FriendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FriendError';
  }

  static invalidResponse(): FriendError {
    return new FriendError('잘못된 응답 형식이에요');
  }

  static invalidTag(): FriendError {
    return new FriendError('올바른 태그 형식이 아니에요');
  }

  static emptyMessage(): FriendError {
    return new FriendError('메시지를 입력해주세요');
  }
}
