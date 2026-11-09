import { IDEMPOTENCY_KEY_HEADER, IDEMPOTENCY_KEY_MAX_LENGTH } from "@aido/api/vocabulary";
import { applyDecorators } from "@nestjs/common";
import { ApiHeader } from "@nestjs/swagger";

export const ApiIdempotencyKeyHeader = () =>
  ApiHeader({
    name: IDEMPOTENCY_KEY_HEADER,
    required: true,
    description: `사용자 행동 한 번마다 새로 만드는 키(${IDEMPOTENCY_KEY_MAX_LENGTH}자 이하 인쇄 가능한 ASCII). 재시도할 때 같은 키를 다시 보냅니다.`,
  });

export const ApiPlanningLocaleHeaders = () =>
  applyDecorators(
    ApiHeader({
      name: "X-Timezone",
      required: false,
      description: "사용자 타임존 (IANA). 미전송 시 저장된 사용자 타임존을 사용합니다.",
      example: "Asia/Seoul",
    }),
    ApiHeader({
      name: "Accept-Language",
      required: false,
      description: '요약·핵심 내용 언어 ("ko" | "en"). 미전송 시 저장된 사용자 언어를 사용합니다.',
      example: "ko",
    }),
  );
