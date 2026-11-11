import { z } from "zod";

import { ENTITY_ID_PATTERN } from "../vocabulary/entity-id.constants.js";

/** 검증 문구가 이미 출시 계약인 필드는 같은 규칙에 그 문구를 단다 */
export function entityIdSchemaWithMessage(message: string) {
  return z.string().regex(ENTITY_ID_PATTERN, message).describe("c로 시작하는 소문자·숫자 ID");
}

/** 서버가 발급한 엔티티 ID(사용자·세션·댓글·팔로우·캠페인 등) */
export const entityIdSchema = entityIdSchemaWithMessage("유효하지 않은 ID입니다");
