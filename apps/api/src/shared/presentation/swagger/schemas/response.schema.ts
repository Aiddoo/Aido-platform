import { ApiProperty } from "@nestjs/swagger";

/**
 * Swagger 문서용 에러 상세 스키마
 */
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

/**
 * Swagger 문서용 에러 응답 스키마
 */
/**
 * Swagger 문서용 에러 응답 스키마
 *
 * 📋 **에러 코드별 처리 가이드**
 *
 * | 에러 코드 | HTTP | 설명 | 클라이언트 처리 |
 * |---------|------|------|----------------|
 * | **인증 에러** | | | |
 * | `AUTH_0101` | 401 | 유효하지 않은 토큰 | 재로그인 유도 |
 * | `AUTH_0102` | 401 | 만료된 토큰 | refresh token으로 재발급 |
 * | `AUTH_0107` | 401 | 인증 필요 | 로그인 화면으로 이동 |
 * | **사용자 에러** | | | |
 * | `USER_0601` | 409 | 이미 존재하는 이메일 | 다른 이메일로 가입 유도 |
 * | `USER_0608` | 401 | 이메일 인증 미완료 | 이메일 인증 화면으로 이동 |
 * | `USER_0610` | 404 | 사용자를 찾을 수 없음 | 입력 값 재확인 |
 * | **친구 요청 에러** | | | |
 * | `FOLLOW_0902` | 409 | 이미 보낸 요청 | 사용자 안내 |
 * | `FOLLOW_0903` | 409 | 이미 친구임 | 사용자 안내 |
 * | `FOLLOW_0906` | 403 | 친구가 아님 | 친구 추가 유도 |
 * | **할 일 에러** | | | |
 * | `TODO_0801` | 404 | 할 일을 찾을 수 없음 | 목록 새로고침 |
 * | **인증 코드 에러** | | | |
 * | `VERIFY_0751` | 400 | 잘못된 인증 코드 | 코드 재입력 유도 |
 * | `VERIFY_0752` | 400 | 만료된 인증 코드 | 재발송 유도 |
 * | `VERIFY_0753` | 404 | 인증 요청 없음 | 회원가입부터 진행 |
 * | `VERIFY_0754` | 400 | 이미 인증 완료 | 로그인 화면으로 이동 |
 * | **소셜 로그인 에러** | | | |
 * | `SOCIAL_0202` | 401 | 소셜 인증 토큰이 유효하지 않습니다 | 재로그인 유도 |
 * | `SOCIAL_0203` | 401 | 소셜 인증 토큰이 만료되었습니다 | 재로그인 유도 |
 * | **시스템 에러** | | | |
 * | `SYS_0001` | 500 | 서버 내부 오류 | 잠시 후 재시도 |
 * | `SYS_0002` | 400 | 잘못된 파라미터 | 입력 값 검증 |
 */
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
    example: 1704067200000,
  })
  timestamp!: number;
}

/**
 * Swagger 문서용 페이지네이션 정보 스키마
 * @see PaginationInfo in common/pagination/interfaces/pagination.interface.ts
 */
export class PaginationInfoSchema {
  @ApiProperty({
    description: "현재 페이지 번호",
    example: 1,
  })
  page!: number;

  @ApiProperty({
    description: "페이지당 아이템 수",
    example: 10,
  })
  size!: number;

  @ApiProperty({
    description: "전체 아이템 수",
    example: 100,
  })
  total!: number;

  @ApiProperty({
    description: "전체 페이지 수",
    example: 10,
  })
  totalPages!: number;

  @ApiProperty({
    description: "다음 페이지 존재 여부",
    example: true,
  })
  hasNext!: boolean;

  @ApiProperty({
    description: "이전 페이지 존재 여부",
    example: false,
  })
  hasPrevious!: boolean;
}

/**
 * Swagger 문서용 커서 기반 페이지네이션 정보 스키마
 * @see CursorPaginationInfo in common/pagination/interfaces/pagination.interface.ts
 */
/**
 * Swagger 문서용 커서 기반 페이지네이션 정보 스키마
 * @see numberCursorPaginationInfoSchema in packages/validators/src/domains/todo/todo.response.ts
 *
 * ℹ️ **커서 기반 페이지네이션**
 * - 다음 페이지는 응답받은 nextCursor를 쿼리 파라미터로 전달
 * - 이전 페이지 조회는 지원하지 않음 (모바일 친화적)
 * - nextCursor가 null이면 마지막 페이지
 */
export class CursorPaginationInfoSchema {
  @ApiProperty({
    description: "다음 페이지 커서 (마지막 아이템 ID)",
    example: 25,
    nullable: true,
  })
  nextCursor!: number | null;

  @ApiProperty({
    description: "다음 페이지 존재 여부",
    example: true,
  })
  hasNext!: boolean;

  @ApiProperty({
    description: "페이지당 아이템 수",
    example: 20,
  })
  size!: number;
}
