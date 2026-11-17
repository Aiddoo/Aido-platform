import { ValueObject } from "#api/shared/domain/model/value-object";

import { invalidSuggestionEvidence } from "./suggestions.errors.js";

export interface SuggestionEvidencePrimitives {
  readonly recordedCount: number;
  readonly completedCount: number;
  readonly periodDays: number;
}

export class SuggestionEvidence extends ValueObject<SuggestionEvidencePrimitives> {
  static create(primitives: SuggestionEvidencePrimitives): SuggestionEvidence {
    const { recordedCount, completedCount, periodDays } = primitives;
    const hasRecords = 1 <= recordedCount && 1 <= periodDays;
    const isCompletedWithinRecorded = 0 <= completedCount && completedCount <= recordedCount;
    if (!hasRecords || !isCompletedWithinRecorded) {
      throw invalidSuggestionEvidence(primitives);
    }
    return new SuggestionEvidence({ ...primitives });
  }

  // 저장된 옛 행을 읽을 때 쓰므로 검증하지 않는다
  static reconstitute(primitives: SuggestionEvidencePrimitives): SuggestionEvidence {
    return new SuggestionEvidence({ ...primitives });
  }

  toPrimitives(): SuggestionEvidencePrimitives {
    return { ...this.value };
  }
}
