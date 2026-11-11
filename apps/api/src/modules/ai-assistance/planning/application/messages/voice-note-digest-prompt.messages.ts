import { ACTION_PLAN_LIMITS, PLAN_CATALOG } from "@aido/api/vocabulary";

import type { SupportedLocale } from "#api/shared/domain/locale";

import {
  composeUserTurn,
  type PromptDefinition,
} from "../../../generation/application/messages/prompt-definition.messages.js";
import {
  sanitizeLineForPrompt,
  sanitizeTextForPrompt,
  wrapUntrusted,
} from "../../../generation/application/messages/untrusted-input.messages.js";
import type {
  NormalizedVoiceNoteDigest,
  VoiceNoteDigestDraft,
} from "../../domain/action-plan-draft.constants.js";
import {
  normalizeVoiceNoteDigest,
  type VoiceNoteDigestNormalizeContext,
} from "../action-plan-draft.mapper.js";
import { type PlanningContextInput, buildPlanningContext } from "./planning-context.messages.js";
import { voiceNoteDigestDraftSchema } from "./voice-note-digest-draft.wire.js";
import { VOICE_NOTE_DIGEST_SYSTEM_EN } from "./voice-note-digest-system-en.messages.js";
import { VOICE_NOTE_DIGEST_SYSTEM_KO } from "./voice-note-digest-system-ko.messages.js";

/** 앱이 기기에서 전사한 문장 하나. 시각은 서버가 index로 다시 찾으므로 프롬프트에 넣지 않는다. */
export interface TranscriptSentence {
  readonly text: string;
  readonly isBookmarked: boolean;
}

export interface VoiceNoteDigestPromptInput extends PlanningContextInput {
  readonly transcript: string;
  /** 문장 목록. 비어 있으면 transcript 전체를 그대로 보내고 핵심 포인트의 문장 번호는 null이다. */
  readonly sentences: readonly TranscriptSentence[];
}

/** 전사 글자 상한은 등급별 1회 상한 중 가장 큰 값이다. 요청 검증이 등급별 값으로 먼저 거절한다. */
const TRANSCRIPT_MAX_LENGTH = PLAN_CATALOG.VOICE_NOTE.perUse.maxCharacters.premium;

const SYSTEM: Readonly<Record<SupportedLocale, string>> = {
  ko: VOICE_NOTE_DIGEST_SYSTEM_KO,
  en: VOICE_NOTE_DIGEST_SYSTEM_EN,
};

/** 프롬프트에 실을 번호 붙인 문장. 정규화의 sentenceCount와 같은 수를 쓴다. */
function toPromptSentences(sentences: readonly TranscriptSentence[]) {
  return sentences.slice(0, ACTION_PLAN_LIMITS.DIGEST_MAX_SEGMENTS).map((sentence, index) => ({
    index,
    text: sanitizeLineForPrompt(sentence.text, TRANSCRIPT_MAX_LENGTH),
    bookmarked: sentence.isBookmarked,
  }));
}

/** 녹음 정리: 긴 전사 → 제목·요약·핵심 포인트 + 할 일 최대 10개 + 메모 1개 계획 초안 */
export const voiceNoteDigestPrompt: PromptDefinition<
  VoiceNoteDigestPromptInput,
  VoiceNoteDigestDraft,
  NormalizedVoiceNoteDigest,
  VoiceNoteDigestNormalizeContext
> = {
  id: "voice-note-digest",
  version: "voice-note-digest@10",
  taskClass: "interactive",
  // 프리미엄 40,000자 전사를 문장 600개로 나눈 최대 user 턴이 약 94,000자다.
  maxInputChars: 100_000,
  schema: voiceNoteDigestDraftSchema,
  build: (input, locale) => ({
    system: SYSTEM[locale],
    prompt: composeUserTurn({
      context: buildPlanningContext(input, locale),
      input: wrapUntrusted(
        "transcript",
        input.sentences.length > 0
          ? { sentences: toPromptSentences(input.sentences) }
          : { text: sanitizeTextForPrompt(input.transcript, TRANSCRIPT_MAX_LENGTH) },
      ),
    }),
  }),
  normalize: normalizeVoiceNoteDigest,
};
