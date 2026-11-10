/** social의 FOLLOW_READER를 같은 인스턴스로 받으므로 인자는 그 포트와 같은 문자열 id다 */
export abstract class FriendshipReaderPort {
  abstract isMutualFriend(userId: string, targetUserId: string): Promise<boolean>;
}
