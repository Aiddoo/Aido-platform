import { useHaptics } from '@src/bootstrap/providers/di-context';
import { useRef, useState } from 'react';

import {
  VoiceNoteCaptionsPolicy,
  type VoiceNoteCaptions,
  createVoiceNoteCaptions,
} from '../domains/voice-note-captions.model';
import type { VoiceNote } from '../domains/voice-note.model';

interface UseVoiceNoteCaptionsOptions {
  /** 이어 듣는 초안. 없으면 빈 자막에서 시작한다 */
  seedNote: VoiceNote | null;
  getElapsedMs: () => number;
  /** 자막이 바뀌었다. 초안 저장은 부른 쪽이 맡는다 */
  onChange: () => void;
}

/** 녹음 화면에 그리는 자막과 중요 표시 */
export function useVoiceNoteCaptions({
  seedNote,
  getElapsedMs,
  onChange,
}: UseVoiceNoteCaptionsOptions) {
  const haptics = useHaptics();
  const [captions, setCaptions] = useState<VoiceNoteCaptions>(() =>
    seedNote == null ? createVoiceNoteCaptions() : createVoiceNoteCaptions(seedNote.sentences),
  );
  const captionsRef = useRef(captions);

  const update = (next: VoiceNoteCaptions) => {
    if (next === captionsRef.current) {
      return;
    }
    captionsRef.current = next;
    setCaptions(next);
    onChange();
  };

  return {
    /** 카드로 그릴 문장. 아직 바뀔 수 있는 마지막 문장은 `interimText`로 따로 그린다 */
    sentences: VoiceNoteCaptionsPolicy.getSettledSentences(captions),
    interimText: VoiceNoteCaptionsPolicy.getCaptionInterimText(captions),
    /** 이어 받은 글자까지 포함해 들은 글자가 있다. 있으면 묻지 않고 지우면 안 된다 */
    hasText: VoiceNoteCaptionsPolicy.hasCaptionText(captions),
    bookmarksMs: captions.bookmarksMs,
    markCount: VoiceNoteCaptionsPolicy.getMarkedSentenceCount(captions),
    mark: () => {
      haptics.selection();
      update(VoiceNoteCaptionsPolicy.withBookmark(captionsRef.current, getElapsedMs()));
    },
    applyResult: (
      result: Parameters<typeof VoiceNoteCaptionsPolicy.applyCaptionResult>[1],
      segmentStartMs: number,
    ) => {
      update(
        VoiceNoteCaptionsPolicy.applyCaptionResult(captionsRef.current, result, {
          nowMs: getElapsedMs(),
          segmentStartMs,
        }),
      );
    },
    commitProvisional: () => {
      update(VoiceNoteCaptionsPolicy.commitProvisional(captionsRef.current, getElapsedMs()));
    },
    getSentencesAt: (nowMs: number) =>
      VoiceNoteCaptionsPolicy.getCaptionSentences(captionsRef.current, nowMs),
  };
}
