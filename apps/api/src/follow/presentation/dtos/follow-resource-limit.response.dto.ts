import { ApiProperty } from "@nestjs/swagger";

export class FollowResourceLimitResponseDto {
	@ApiProperty({ description: "현재 친구 수", example: 5 })
	declare friendCount: number;

	@ApiProperty({
		description: "최대 한도 (null이면 무제한)",
		example: 50,
		nullable: true,
		type: Number,
	})
	declare maxCount: number | null;
}
