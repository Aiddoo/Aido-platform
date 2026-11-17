import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { VoiceDigestId } from "./voice-digest-id.vo.js";
import type { VoiceTranscript } from "./voice-transcript.vo.js";

interface VoiceDigestKeyPoint {
  readonly text: string;
  /** 앱이 보낸 문장의 시각. AI가 고른 문장이 없거나 범위 밖이면 null이다 */
  readonly startMs: number | null;
}

export interface VoiceDigestPrimitives {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly keyPoints: readonly VoiceDigestKeyPoint[];
}

interface VoiceDigestProps {
  readonly title: string;
  readonly summary: string;
  readonly keyPoints: readonly VoiceDigestKeyPoint[];
}

interface CreateVoiceDigestParams {
  readonly transcript: VoiceTranscript;
  readonly title: string;
  readonly summary: string;
  readonly keyPoints: readonly {
    readonly text: string;
    readonly sentenceIndex: number | null;
  }[];
}

/**
 * AI가 정리한 녹음 한 건. 저장하지 않고 응답과 재요청 재생에만 쓴다. 핵심 내용의 시각은 AI가 지어내지
 * 못하게 AI가 고른 문장 번호로 전사에서만 찾는다.
 */
export class VoiceDigest extends AggregateRoot<VoiceDigestId, VoiceDigestProps> {
  static create(params: CreateVoiceDigestParams): VoiceDigest {
    return new VoiceDigest(VoiceDigestId.generate(), {
      title: params.title,
      summary: params.summary,
      keyPoints: params.keyPoints.map((point) => ({
        text: point.text,
        startMs: params.transcript.startMsAt(point.sentenceIndex),
      })),
    });
  }

  toPrimitives(): VoiceDigestPrimitives {
    return {
      id: this.id.value,
      title: this.props.title,
      summary: this.props.summary,
      keyPoints: this.props.keyPoints.map((point) => ({ ...point })),
    };
  }
}
