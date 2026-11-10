import { ErrorCode } from "@aido/api/errors";
import { PLAN_CATALOG } from "@aido/api/vocabulary";
import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { AiDataSharingConsentGuard } from "#api/modules/ai-assistance/parsing/ai-assistance-parsing.public";
import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import {
  ClientAbortSignal,
  IdempotencyKey,
  Locale,
  Timezone,
} from "#api/platform/http/decorators/index";
import {
  ApiBadRequestError,
  ApiConflictError,
  ApiDoc,
  ApiErrorCodesResponse,
  ApiForbiddenError,
  ApiServiceUnavailableError,
  ApiSuccessResponse,
  ApiUnauthorizedError,
  SWAGGER_TAGS,
} from "#api/platform/http/swagger/index";
import { ThrottleByUser, ThrottleDaily } from "#api/platform/throttle/index";
import type { SupportedLocale } from "#api/shared/domain/locale";

import {
  ApiIdempotencyKeyHeader,
  ApiPlanningLocaleHeaders,
} from "../../../../action-plans/presentation/http/plan-request.decorator.js";
import { DigestVoiceNoteUseCase } from "../../../application/use-cases/digest-voice-note.use-case.js";
import { toVoiceNoteDigestResponse } from "./voice-note-response.mapper.js";
import { VoiceNoteDigestRequestDto, VoiceNoteDigestResponseDto } from "./voice-note.dto.js";

export const VOICE_NOTE_THROTTLE = {
  MINUTE: { default: { ttl: 60_000, limit: 4 } },
  DAY_LIMIT: 30,
} as const;

const { maxCharacters } = PLAN_CATALOG.VOICE_NOTE.perUse;

@ApiTags(SWAGGER_TAGS.VOICE)
@ApiBearerAuth()
@Controller("voice-notes")
export class VoiceNoteController {
  readonly #digestVoiceNote: DigestVoiceNoteUseCase;

  constructor(digestVoiceNote: DigestVoiceNoteUseCase) {
    this.#digestVoiceNote = digestVoiceNote;
  }

  @Post("digest")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AiDataSharingConsentGuard)
  @ThrottleByUser()
  @Throttle(VOICE_NOTE_THROTTLE.MINUTE)
  @ThrottleDaily(VOICE_NOTE_THROTTLE.DAY_LIMIT)
  @ApiIdempotencyKeyHeader()
  @ApiPlanningLocaleHeaders()
  @ApiDoc({
    summary: "녹음 전사를 요약·핵심 내용·실행 계획으로 정리",
    operationId: "digestVoiceNote",
    description: `기기가 전사한 글자만 받습니다. 서버는 녹음도 전사 글자도 저장하지 않습니다.

## 📏 길이
한 번에 보낼 수 있는 글자 수는 무료 ${maxCharacters.free.toLocaleString("ko-KR")}자, 프리미엄 ${maxCharacters.premium.toLocaleString("ko-KR")}자입니다(넘으면 AI_1312). 본문은 256KB까지입니다(넘으면 413). 프롬프트에서 길어지는 글자(\`<\`·\`>\`·\`&\`·따옴표·줄바꿈)는 늘어난 길이로 셉니다.

## 🚫 사용량
말로 메모하기: 무료 월 ${PLAN_CATALOG.VOICE_NOTE.free}회, 프리미엄 넉넉하게(월 ${PLAN_CATALOG.VOICE_NOTE.fairUse.premium}회까지, 넘으면 AI_1313). 요약이나 핵심 내용을 돌려주면 할 일이 0개여도 1회를 씁니다. 실패하거나 돌려줄 내용이 전혀 없으면 차감하지 않습니다(\`charged\`). 분당 ${VOICE_NOTE_THROTTLE.MINUTE.default.limit}회, 하루 ${VOICE_NOTE_THROTTLE.DAY_LIMIT}회까지 보낼 수 있습니다.

## 🔁 재시도
같은 \`Idempotency-Key\`는 한 번만 차감합니다. 처리 중이면 AI_1314, 결과를 잃었으면 추가 차감 없이 다시 만들고, 내용이 다르면 AI_1318입니다.`,
  })
  @ApiSuccessResponse({ type: VoiceNoteDigestResponseDto })
  @ApiBadRequestError(ErrorCode.AI_1316)
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiForbiddenError(ErrorCode.AI_1311)
  @ApiConflictError(ErrorCode.AI_1314)
  @ApiErrorCodesResponse(HttpStatus.UNPROCESSABLE_ENTITY, [
    ErrorCode.AI_1302,
    ErrorCode.AI_1312,
    ErrorCode.AI_1318,
  ])
  @ApiErrorCodesResponse(HttpStatus.TOO_MANY_REQUESTS, [ErrorCode.AI_1313, ErrorCode.AI_1310])
  @ApiServiceUnavailableError(ErrorCode.AI_1301)
  async digest(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: VoiceNoteDigestRequestDto }) dto: VoiceNoteDigestRequestDto,
    @IdempotencyKey() idempotencyKey: string,
    @Timezone({ preserveIfMissing: true }) timezone: string | undefined,
    @Locale() locale: SupportedLocale | undefined,
    @ClientAbortSignal() signal: AbortSignal,
  ): Promise<VoiceNoteDigestResponseDto> {
    const digested = await this.#digestVoiceNote.execute({
      userId: user.userId,
      text: dto.text,
      durationSeconds: dto.durationSeconds,
      segments: dto.segments,
      idempotencyKey,
      timezone,
      locale,
      signal,
    });
    return toVoiceNoteDigestResponse(digested);
  }
}
