/**
 * TodoCategory 모듈 타입 정의
 */

import type { TodoCategory } from "@/generated/prisma/client";

// 공통 타입 재내보내기
export type { TransactionClient } from "@/common/database";

// ===== Entity Types =====

/**
 * TodoCategory 기본 엔티티 타입 (Prisma 모델)
 */
export type TodoCategoryEntity = TodoCategory;

/**
 * Todo count가 포함된 TodoCategory 엔티티 타입
 */
export type TodoCategoryWithCountEntity = TodoCategory & {
	_count: {
		todos: number;
	};
};

// ===== Service Layer Types =====

/**
 * 카테고리 생성 시 필요한 데이터
 */
export interface CreateTodoCategoryData {
	userId: string;
	name: string;
	color: string;
}

/**
 * 카테고리 수정 시 사용되는 데이터
 */
export interface UpdateTodoCategoryData {
	name?: string;
	color?: string;
}

/**
 * 카테고리 순서 변경 파라미터
 */
export interface ReorderTodoCategoryParams {
	userId: string;
	categoryId: number;
	targetCategoryId?: number;
	position: "before" | "after";
}

/**
 * 카테고리 삭제 파라미터
 */
export interface DeleteTodoCategoryParams {
	userId: string;
	categoryId: number;
	moveToCategoryId?: number;
}

// ===== Repository Layer Types =====

/**
 * 카테고리 with Todo count
 */
export interface TodoCategoryWithCount {
	id: number;
	userId: string;
	name: string;
	color: string;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
	_count: {
		todos: number;
	};
}

/**
 * 기본 카테고리 생성용 데이터
 */
export interface DefaultCategoryData {
	name: string;
	color: string;
	sortOrder: number;
}

/**
 * 기본 카테고리 목록
 */
export const DEFAULT_CATEGORIES: DefaultCategoryData[] = [
	{ name: "중요한 일", color: "#FFB3B3", sortOrder: 0 },
	{ name: "할 일", color: "#FF6B43", sortOrder: 1 },
];
