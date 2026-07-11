/**
 * 스케줄러 리더 포트가 반환하는 읽기 모델(read-model) DTO 모음.
 *
 * Prisma select 형태를 애플리케이션 레이어에 노출하지 않기 위한 명시적 계약.
 * 어댑터가 이 형태로 투영(projection)하고, 전략은 이 타입만 소비한다.
 */
import type { SupportedLocale } from "@/shared/presentation/decorators";

/** 아침 리마인더 수신자 (오늘 시작 투두 개수 포함) */
export interface ReminderCountUser {
	readonly id: string;
	readonly preference: { readonly locale: string } | null;
	readonly _count: { readonly todos: number };
}

/** 저녁/스트릭 판정 수신자 (오늘 투두 완료 상태 + 스트릭 정보) */
export interface UserWithTodosAndStreak {
	readonly id: string;
	readonly todos: ReadonlyArray<{ readonly completed: boolean }>;
	readonly preference: {
		readonly currentStreak: number;
		readonly lastCompletedDate: Date | null;
		readonly locale: string;
	} | null;
}

/** ID만 필요한 수신자 (점심 넛지·주간/월간 리포트·활성 유저 목록) */
export interface UserIdRow {
	readonly id: string;
}

/** Win-back 대상 (마지막 접속 시각 포함) */
export interface WinbackUser {
	readonly id: string;
	readonly lastActiveAt: Date | null;
}

/** 온보딩 대상 (가입 시각 포함) */
export interface OnboardingCandidate {
	readonly id: string;
	readonly createdAt: Date;
}

/** 유저별 투두 집계 (groupBy 결과) */
export interface UserTodoCount {
	readonly userId: string;
	readonly count: number;
}

/** 팔로우 관계에서 조회된 상대 유저 (활동성·프로필명) */
export interface FollowRelationUser {
	readonly id: string;
	readonly lastActiveAt: Date | null;
	readonly profile: { readonly name: string | null } | null;
}

/** 넛지 추천용 맞팔 관계 (양방향 상대 정보 포함) */
export interface NudgeSuggestFollow {
	readonly followerId: string;
	readonly followingId: string;
	readonly follower: FollowRelationUser;
	readonly following: FollowRelationUser;
}

/** 소셜 다이제스트 후보 (오늘 투두 완료 상태) */
export interface SocialDigestCandidate {
	readonly id: string;
	readonly todos: ReadonlyArray<{ readonly completed: boolean }>;
}

/** 맞팔 관계 ID 쌍 */
export interface FollowPair {
	readonly followerId: string;
	readonly followingId: string;
}

/** 오늘 투두를 가진 친구 (프로필명 + 완료 상태) */
export interface FriendWithTodos {
	readonly id: string;
	readonly profile: { readonly name: string | null } | null;
	readonly todos: ReadonlyArray<{ readonly completed: boolean }>;
}

/** 날씨 알림 수신자 (위치 있음 — 위치는 조회 후 필터로 non-null 확정) */
export interface WeatherReminderUser {
	readonly id: string;
	readonly preference: { readonly locale: string } | null;
	readonly location: {
		readonly latitude: number;
		readonly longitude: number;
		readonly gridX: number;
		readonly gridY: number;
	} | null;
}

/** 날씨 폴백 수신자 (위치 없음) */
export interface WeatherFallbackUser {
	readonly id: string;
	readonly preference: { readonly locale: string } | null;
}

/** 리마인더 발송 대상 투두 (미완료 확인 결과) */
export interface ActiveTodo {
	readonly id: number;
	readonly title: string;
}

/** 유저 ID → 푸시 로케일 매핑 */
export type UserLocaleMap = Map<string, SupportedLocale>;
