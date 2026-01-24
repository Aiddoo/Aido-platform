import { ErrorCode, type ErrorCodeType, Errors } from '@aido/errors';

export class FriendError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCodeType,
  ) {
    super(message);
    this.name = 'FriendError';
  }

  private static fromCode(code: ErrorCodeType): FriendError {
    const error = Errors[code];
    return new FriendError(error.message, code);
  }

  static invalidResponse(): FriendError {
    return new FriendError('잘못된 응답 형식입니다', ErrorCode.SYS_0001);
  }

  static requestNotFound(): FriendError {
    return FriendError.fromCode(ErrorCode.FOLLOW_0903);
  }

  static alreadyFriends(): FriendError {
    return FriendError.fromCode(ErrorCode.FOLLOW_0902);
  }

  static alreadyRequested(): FriendError {
    return FriendError.fromCode(ErrorCode.FOLLOW_0901);
  }

  static selfRequest(): FriendError {
    return FriendError.fromCode(ErrorCode.FOLLOW_0904);
  }

  static userNotFound(): FriendError {
    return FriendError.fromCode(ErrorCode.FOLLOW_0905);
  }

  static notFriends(): FriendError {
    return FriendError.fromCode(ErrorCode.FOLLOW_0907);
  }
}
