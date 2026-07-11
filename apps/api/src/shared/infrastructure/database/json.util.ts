import type { Prisma } from "@/generated/prisma/client";

/**
 * 도메인 타입 값을 Prisma Json 입력값으로 좁히는 경계 헬퍼.
 *
 * 애플리케이션/도메인이 소유한 타입 안전 구조(예: 통계·패턴 배열)를 Prisma의
 * `InputJsonValue`로 전달할 때 발생하는 단일 캐스트를 이 경계 한 곳으로 격리한다.
 * (어댑터는 no-cast를 유지하고, 벤더(Prisma) 타입 불일치는 여기서만 흡수한다.)
 */
export function toInputJson(value: unknown): Prisma.InputJsonValue {
	return value as Prisma.InputJsonValue;
}
