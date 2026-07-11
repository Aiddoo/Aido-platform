import type { UserLocation } from "../../domain/entities/user-location.entity";

/** WeatherLocationRepositoryPort DI 토큰 */
export const WEATHER_LOCATION_REPOSITORY = Symbol(
	"WEATHER_LOCATION_REPOSITORY",
);

/**
 * 사용자 위치 저장소 포트.
 *
 * 위치 애그리게잇의 조회·upsert를 추상화한다. 영속 방식(Prisma)은 인프라 어댑터가
 * 담당한다.
 */
export interface WeatherLocationRepositoryPort {
	findByUserId(userId: string): Promise<UserLocation | null>;
	upsert(location: UserLocation): Promise<UserLocation>;
}
