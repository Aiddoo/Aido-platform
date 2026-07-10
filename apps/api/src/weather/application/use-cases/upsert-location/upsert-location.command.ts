import { Command } from "@nestjs/cqrs";
import type { UserLocation } from "../../../domain/entities/user-location.entity";

/**
 * 사용자 위치 등록/수정 커맨드. 좌표로부터 격자를 파생해 저장하고, 격자가 바뀌면
 * 이전 격자의 캐시를 무효화한다.
 */
export class UpsertLocationCommand extends Command<UserLocation> {
	constructor(
		public readonly userId: string,
		public readonly latitude: number,
		public readonly longitude: number,
	) {
		super();
	}
}
