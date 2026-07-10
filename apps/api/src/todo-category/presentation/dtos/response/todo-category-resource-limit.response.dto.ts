import { ApiProperty } from "@nestjs/swagger";

export class TodoCategoryResourceLimitResponseDto {
	@ApiProperty({ description: "현재 카테고리 개수", example: 3 })
	declare categoryCount: number;

	@ApiProperty({
		description: "최대 한도 (null이면 무제한)",
		example: 10,
		nullable: true,
		type: Number,
	})
	declare maxCount: number | null;
}
