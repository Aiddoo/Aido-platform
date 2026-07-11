/**
 * FollowNotifierPort — 친구 관계 알림 발행 포트.
 *
 * 알림은 내구성 있는 부수효과이므로 BullMQ 큐로 enqueue한다(트랜잭션 커밋 후, fire-and-forget).
 * 아직 클린아키텍처로 이관되지 않은 notification 모듈의 큐 서비스를 감싼 위임 어댑터가 구현한다.
 * 페이로드 타입은 애플리케이션 소유(notification 내부 타입에 의존하지 않음).
 */

export interface FollowNewNotification {
	followerId: string;
	followingId: string;
	followerName: string;
}

export interface FollowMutualNotification {
	userId: string;
	friendId: string;
	friendName: string;
}

export interface FirstFriendMilestoneNotification {
	userId: string;
}

export const FOLLOW_NOTIFIER = Symbol("FOLLOW_NOTIFIER");

export interface FollowNotifierPort {
	/** 새 친구 요청 알림 */
	notifyFollowNew(payload: FollowNewNotification): void;
	/** 맞팔(친구 성립) 알림 */
	notifyFollowMutual(payload: FollowMutualNotification): void;
	/** 첫 친구 마일스톤 알림 */
	notifyFirstFriendMilestone(payload: FirstFriendMilestoneNotification): void;
}
