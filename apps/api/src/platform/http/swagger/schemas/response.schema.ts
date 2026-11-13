import { ApiProperty } from "@nestjs/swagger";

export class ErrorDetailSchema {
  @ApiProperty({
    description: "에러 코드 (비즈니스 에러 코드)",
    example: "AUTH_0101",
  })
  code!: string;

  @ApiProperty({
    description: "에러 메시지",
    example: "유효하지 않은 토큰입니다.",
  })
  message!: string;

  @ApiProperty({
    description: "추가 에러 상세 정보",
    example: { reason: "Access token is missing or invalid" },
    required: false,
    nullable: true,
  })
  details?: Record<string, unknown> | null;
}

// 코드별 상태·문구는 @aido/api/errors의 Errors가 정본이다
export class ErrorResponseSchema {
  @ApiProperty({
    description: "요청 성공 여부",
    example: false,
  })
  success!: false;

  @ApiProperty({
    description: "에러 정보",
    type: ErrorDetailSchema,
  })
  error!: ErrorDetailSchema;

  @ApiProperty({
    description: "응답 타임스탬프 (Unix timestamp)",
    example: 1_704_067_200_000,
  })
  timestamp!: number;
}
