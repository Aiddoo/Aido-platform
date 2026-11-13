import { IDEMPOTENCY_KEY_HEADER, IDEMPOTENCY_KEY_MAX_LENGTH } from "@aido/api/vocabulary";
import { ApiHeader } from "@nestjs/swagger";

/** 앱 버전에 따라 응답이 달라지는 endpoint의 선택 헤더. 설명에는 그 endpoint의 버전 분기를 적는다 */
export function ApiAppVersionHeader(
  description = "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
): MethodDecorator & ClassDecorator {
  return ApiHeader({ name: "x-app-version", required: false, description });
}

/** `@IdempotencyKey()`로 읽는 필수 헤더 */
export function ApiIdempotencyKeyHeader(): MethodDecorator & ClassDecorator {
  return ApiHeader({
    name: IDEMPOTENCY_KEY_HEADER,
    required: true,
    description: `사용자 행동 한 번마다 새로 만드는 키(${IDEMPOTENCY_KEY_MAX_LENGTH}자 이하 인쇄 가능한 ASCII). 재시도할 때 같은 키를 다시 보냅니다.`,
  });
}
