import { useIdGenerator, useVoiceNoteDraftRepository } from '@src/bootstrap/providers/di-context';
import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { getNowInstant } from '@src/shared/date/clock';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { createTranscribedVoiceNote } from '../domains/voice-note-caption.model';
import type { VoiceTranscript } from '../domains/voice-transcript.model';
import { useStartVoiceNote } from './use-start-voice-note';

interface ContinueAsVoiceNoteOptions {
  locale: SpeechLocale;
  /** 빠른 말하기가 지금까지 들은 글자와 길이 */
  heard: { transcript: VoiceTranscript; elapsedMs: number };
  /** 한도·동의·마이크를 통과해 녹음 화면으로 넘기기 직전. 빠른 말하기 세션을 넘긴 것으로 끝낸다 */
  onHandOff: () => void;
  /** 녹음 화면으로 가거나 구독 화면으로 떠나기 전에 시트를 닫는다 */
  onExit: () => void;
}

/** 들은 글자를 기기 초안에 먼저 저장하고 녹음 화면에서 이어 듣는다. 다음 화면이 실패해도 글자는 메모 탭에 남는다 */
export function useContinueAsVoiceNote() {
  const idGenerator = useIdGenerator();
  const voiceNoteDraftRepository = useVoiceNoteDraftRepository();
  const startVoiceNote = useStartVoiceNote();
  const pushRecordScreen = useSingleTap(router.push);
  const { data: me } = useQuery({ ...useGetMeQueryOptions(), throwOnError: false });

  const continueAsVoiceNote = (accountId: string, options: ContinueAsVoiceNoteOptions) => {
    const { locale, heard, onHandOff, onExit } = options;

    return startVoiceNote({
      entry: 'quick_voice_upgrade',
      onSubscribe: onExit,
      onReadyToRecord: () => {
        const note = createTranscribedVoiceNote({
          draftId: idGenerator.create(),
          locale,
          createdAt: getNowInstant(),
          transcript: heard.transcript,
          durationMs: heard.elapsedMs,
        });
        const hasHeardText = note.sentences.length > 0;
        if (hasHeardText) {
          voiceNoteDraftRepository.save(accountId, note);
        }
        onHandOff();
        onExit();
        pushRecordScreen({
          pathname: '/voice-notes/record',
          params: {
            draftId: hasHeardText ? note.draftId : undefined,
            entry: 'quick_voice_upgrade',
          },
        });
      },
    });
  };

  // 이어 갈 계정을 모르면 글자를 저장할 곳이 없어 넘기지 않는다. 부르는 쪽은 들은 글자로 정리한다
  return me == null
    ? null
    : (options: ContinueAsVoiceNoteOptions) => continueAsVoiceNote(me.id, options);
}
