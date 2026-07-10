/** 신규 가입 시 시딩되는 기본 카테고리 (auth·oauth 회원가입 트랜잭션에서 사용) */
export interface DefaultCategoryData {
	name: string;
	color: string;
	sortOrder: number;
}

export const DEFAULT_CATEGORIES: DefaultCategoryData[] = [
	{ name: "중요한 일", color: "#FFB3B3", sortOrder: 0 },
	{ name: "할 일", color: "#FF6B43", sortOrder: 1 },
];
