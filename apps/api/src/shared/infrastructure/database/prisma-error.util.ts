import { Prisma } from "@/generated/prisma/client";

/**
 * Prisma 알려진 요청 오류 판별 경계 헬퍼.
 *
 * 애플리케이션 레이어가 `@/generated`(Prisma) 결합 없이 유니크 위반·레코드 부재
 * 같은 벤더 오류를 분기할 수 있도록, Prisma 오류 코드 검사를 이 한 곳으로 격리한다.
 */

/** 유니크 제약 위반(P2002) 여부 */
export function isUniqueConstraintViolation(error: unknown): boolean {
	return (
		error instanceof Prisma.PrismaClientKnownRequestError &&
		error.code === "P2002"
	);
}

/** 대상 레코드 부재(P2025) 여부 */
export function isRecordNotFoundError(error: unknown): boolean {
	return (
		error instanceof Prisma.PrismaClientKnownRequestError &&
		error.code === "P2025"
	);
}

/**
 * 유니크 위반(P2002)의 대상 필드 목록.
 *
 * `error.meta.target`은 Prisma가 `string[]`로 채우지만 타입은 넓으므로,
 * 이 벤더 경계에서만 배열 여부를 좁혀 반환한다(어댑터/애플리케이션은 no-cast 유지).
 * 대상 정보가 없으면 `undefined`.
 */
export function uniqueConstraintTargets(error: unknown): string[] | undefined {
	if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
		return undefined;
	}
	const target = error.meta?.target;
	return Array.isArray(target) ? (target as string[]) : undefined;
}
