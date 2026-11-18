export { FriendshipLockKeys } from "./application/friendships.lock-keys.js";
export {
  FriendshipEstablisherPort,
  type FriendshipEstablishment,
} from "./application/ports/friendship-establisher.port.js";
export { FriendshipSeverancePort } from "./application/ports/friendship-severance.port.js";
export { MutualFriendReaderPort } from "./application/ports/mutual-friend.reader.port.js";
export { SocialFriendshipsModule } from "./social-friendships.module.js";
// 사람들의 맞팔 관계를 한 SQL에 붙이는 다른 Context가 친구 관계 테이블을 직접 읽지 않게 한다
export { acceptedFriendshipsOf } from "./infrastructure/persistence/accepted-friendship.query-fragment.js";
