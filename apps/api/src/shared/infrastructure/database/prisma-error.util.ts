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
