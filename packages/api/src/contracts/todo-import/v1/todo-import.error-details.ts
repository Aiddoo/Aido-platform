import { z } from "zod";

import { datetimeSchema } from "../../../common/datetime.js";
import { entityIdSchema } from "../../../common/entity-id.js";
import {
  TODO_IMPORT_INVALID_REASONS,
  TODO_IMPORT_STATUSES,
  TODO_IMPORT_TARGET_REJECTION_REASONS,
} from "../../../vocabulary/todo-import.constants.js";
import { todoImportTargetKeySchema } from "./todo-import.common.js";

/** TODO_IMPORT_2301·2304 공개 상세 */
export const todoImportReferenceErrorDetailsSchema = z
  .object({ importId: entityIdSchema.meta({ description: "가리킨 가져오기 id" }) })
  .meta({ description: "가져오기 참조 상세" });

/** TODO_IMPORT_2303 공개 상세 */
export const todoImportTargetsRejectedErrorDetailsSchema = z
  .object({
    targets: z
      .array(
        z.object({
          targetKey: todoImportTargetKeySchema,
          reason: z.enum(TODO_IMPORT_TARGET_REJECTION_REASONS),
          current: z
            .int()
            .nonnegative()
            .optional()
            .meta({ description: "지금 진행 중인 할 일 수" }),
          expected: z.int().nonnegative().optional().meta({ description: "가져올 일정 수" }),
          limit: z.int().positive().optional().meta({ description: "카테고리당 한도" }),
        }),
      )
      .min(1),
  })
  .meta({ description: "대상 카테고리 거절 상세" });

/** TODO_IMPORT_2305 공개 상세 */
export const todoImportStatusErrorDetailsSchema = z
  .object({ status: z.enum(TODO_IMPORT_STATUSES) })
  .meta({ description: "지금 상태라 할 수 없는 요청 상세" });

/** TODO_IMPORT_2306 공개 상세 */
export const todoImportInvalidErrorDetailsSchema = z
  .object({
    reason: z.enum(TODO_IMPORT_INVALID_REASONS),
    index: z.int().nonnegative().optional().meta({ description: "문제가 된 일정의 요청 안 위치" }),
  })
  .meta({ description: "기간·일정 검증 실패 상세" });

/** TODO_IMPORT_2308 공개 상세 */
export const todoImportUndoExpiredErrorDetailsSchema = z
  .object({ undoableUntil: datetimeSchema.nullable() })
  .meta({ description: "되돌리기 기간 상세" });

/** TODO_IMPORT_2309 공개 상세 */
export const todoImportTooManyItemsErrorDetailsSchema = z
  .object({
    limit: z.int().positive(),
    receivedItemCount: z.int().nonnegative(),
  })
  .meta({ description: "일정 수 초과 상세" });
