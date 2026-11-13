import { applyDecorators } from "@nestjs/common";
import { ApiHeader } from "@nestjs/swagger";

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
