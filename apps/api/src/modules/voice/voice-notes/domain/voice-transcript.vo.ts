import { ValueObject } from "#api/shared/domain/model/value-object";

export interface TranscriptSegment {
  readonly startMs: number;
  readonly text: string;
  readonly isBookmarked: boolean;
}

interface VoiceTranscriptValue {
  readonly text: string;
  readonly durationSeconds: number;
  readonly segments: readonly TranscriptSegment[];
}

/** 프롬프트의 JSON 인코딩에서 길어지는 글자. 입력 상한을 넘기 전에 글자 상한이 먼저 막도록 늘어난 길이로 센다. */
const SIX_CHARACTER_ESCAPES = /[<>&]/g;
const TWO_CHARACTER_ESCAPES = /["\\\n\t]/g;

function encodedLength(text: string): number {
  const sixCharacters = text.match(SIX_CHARACTER_ESCAPES)?.length ?? 0;
  const twoCharacters = text.match(TWO_CHARACTER_ESCAPES)?.length ?? 0;
  return text.length + sixCharacters * 5 + twoCharacters;
}

/**
 * 기기가 전사한 녹음 한 건. 요청을 처리하는 동안만 있고 저장하지 않는다.
 * 프롬프트는 문장 목록이 있으면 문장을, 없으면 전체 글자를 쓰므로 둘 중 긴 쪽으로 상한을 잰다.
 */
export class VoiceTranscript extends ValueObject<VoiceTranscriptValue> {
  static create(value: VoiceTranscriptValue): VoiceTranscript {
    return new VoiceTranscript({
      text: value.text,
      durationSeconds: value.durationSeconds,
      segments: value.segments.map((segment) => ({ ...segment })),
    });
  }

  get text(): string {
    return this.value.text;
  }

  get durationSeconds(): number {
    return this.value.durationSeconds;
  }

  get segments(): readonly TranscriptSegment[] {
    return this.value.segments;
  }

  get characterCount(): number {
    const segmentCharacters = this.value.segments.reduce(
      (total, segment) => total + encodedLength(segment.text),
      0,
    );
    return Math.max(encodedLength(this.value.text), segmentCharacters);
  }

  exceeds(limit: { readonly maxCharacters: number }): boolean {
    return this.characterCount > limit.maxCharacters;
  }

  /**
   * 앱이 보낸 녹음 길이가 한 번 녹음 상한을 허용 오차보다 넘었는지. 길이는 앱 타이머가 막으므로
   * 넘었다면 우회 의심이다. 1.15.1은 경보만 올리고 거절하지 않는다(1.15.2부터 거절).
   */
  exceedsDuration(limit: {
    readonly maxSeconds: number;
    readonly toleranceSeconds: number;
  }): boolean {
    return this.value.durationSeconds > limit.maxSeconds + limit.toleranceSeconds;
  }

  /** AI가 고른 문장 번호의 시각. AI가 시간을 지어내지 않게 앱이 보낸 값만 돌려준다. */
  startMsAt(sentenceIndex: number | null): number | null {
    return sentenceIndex == null ? null : (this.value.segments[sentenceIndex]?.startMs ?? null);
  }
}
