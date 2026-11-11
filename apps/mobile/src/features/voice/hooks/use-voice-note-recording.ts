import {
  useIdGenerator,
  useSpeechRecognizer,
  useVoiceNoteDraftRepository,
  useVoiceNoteStorageService,
  useVoiceRecordingRepository,
} from '@src/bootstrap/providers/di-context';
import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { getNowInstant } from '@src/shared/date/clock';
import { noop } from 'es-toolkit';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { match } from 'ts-pattern';

import type { VoiceCaptureEntry } from '../constants/voice.events';
import { VoiceNotePolicy, type VoiceNote } from '../domains/voice-note.model';
import { VoiceRecordingIntakeSession } from '../services/voice-recording-intake.session';
import { useOfferOnDeviceModel } from './use-offer-on-device-model';
import { useSpeechEvent } from './use-speech-event';
import { useVoiceCaptureSession } from './use-voice-capture-session';
import { useVoiceNoteCaptions } from './use-voice-note-captions';

interface UseVoiceNoteRecordingOptions {
  accountId: string;
  locale: SpeechLocale;
  seedDraftId?: string;
  entry?: Extract<VoiceCaptureEntry, 'memo_tab' | 'quick_voice_upgrade'>;
  /** 서버 한도의 한 번 최대 길이(초). null이면 끝이 없다 */
  maxSeconds: number | null;
  onLimitReached: () => void;
  onFinished: (draftId: string) => void;
  onEmpty: () => void;
}

export function useVoiceNoteRecording({
  accountId,
  locale,
  seedDraftId,
  entry = 'memo_tab',
  maxSeconds,
  onLimitReached,
  onFinished,
  onEmpty,
}: UseVoiceNoteRecordingOptions) {
  const speechRecognizer = useSpeechRecognizer();
  const storage = useVoiceNoteStorageService();
  const draftRepository = useVoiceNoteDraftRepository();
  const recordingRepository = useVoiceRecordingRepository();
  const idGenerator = useIdGenerator();
  const offerOnDeviceModel = useOfferOnDeviceModel({ accountId, entry });

  const [seedNote] = useState(() =>
    seedDraftId == null ? null : draftRepository.find(accountId, seedDraftId),
  );
  const [baseNote] = useState<VoiceNote>(
    () =>
      seedNote ??
      VoiceNotePolicy.createVoiceNote({
        draftId: idGenerator.create(),
        locale,
        createdAt: getNowInstant(),
      }),
  );
  const [intake] = useState(
    () =>
      new VoiceRecordingIntakeSession({
        accountId,
        draftId: baseNote.draftId,
        draftRepository,
        recordingRepository,
        discard: storage.discard,
        // persist는 아래에 선언한 함수지만 녹음 조각이 저장된 뒤에만 불린다
        // oxlint-disable-next-line react/immutability -- 위 이유로 초기화 전에 접근하지 않는다
        onRecordingSaved: () => persist('later'),
      }),
  );
  const currentSegmentStartRef = useRef(0);
  const hasBegunRef = useRef(false);
  const isUnmountedRef = useRef(false);

  /** 말로 메모하기는 고르는 단계가 없다. 녹음 파일까지 받아 초안을 저장하고 넘긴 뒤 계획 없이(null) 처음으로 돌아간다 */
  const saveFinishedNote = async () => {
    await intake.waitUntilSettled();
    persist('now');
    intake.handOff();
    // 끝내는 동안 사용자가 이미 떠났다. 글자는 저장했고 다른 화면에서 끌어오지 않는다
    if (!isUnmountedRef.current) {
      onFinished(baseNote.draftId);
    }
    return null;
  };

  const session = useVoiceCaptureSession({
    entry,
    mode: 'note',
    maxSeconds,
    onLimitReached,
    onCaptured: saveFinishedNote,
  });

  const captions = useVoiceNoteCaptions({
    seedNote,
    getElapsedMs: session.getElapsedMs,
    onChange: () => persist('later'),
  });

  const toNote = (): VoiceNote => {
    const nowMs = session.getElapsedMs();
    return VoiceNotePolicy.withRecordings(
      VoiceNotePolicy.withSentences(baseNote, captions.getSentencesAt(nowMs), nowMs),
      intake.getRecordings(),
    );
  };

  function persist(timing: 'later' | 'now') {
    if (!intake.canWriteDraft()) {
      return;
    }
    const note = toNote();
    if (note.sentences.length === 0) {
      return;
    }
    if (timing === 'now') {
      draftRepository.save(accountId, note);
    } else {
      draftRepository.scheduleSave(accountId, note);
    }
  }

  useSpeechEvent((event) => {
    match(event)
      .with({ type: 'start' }, () => {
        currentSegmentStartRef.current = session.getElapsedMs();
      })
      .with({ type: 'recording-started' }, ({ uri }) => {
        intake.segmentStarted(uri, session.getElapsedMs());
      })
      .with({ type: 'result' }, (result) => {
        captions.applyResult(result, currentSegmentStartRef.current);
      })
      .with({ type: 'end' }, () => {
        captions.commitProvisional();
      })
      .with({ type: 'recording-saved' }, ({ uri }) => {
        intake.receive(uri, currentSegmentStartRef.current);
      })
      .with({ type: 'volume' }, { type: 'error' }, { type: 'no-match' }, noop)
      .exhaustive();
  });

  useEffect(() => {
    isUnmountedRef.current = false;

    return () => {
      isUnmountedRef.current = true;
      intake.listenForLate((listener) => speechRecognizer.subscribe(listener));
    };
  }, [intake, speechRecognizer]);

  const { status } = session.state;
  const previousStatusRef = useRef(status);
  const flushDraft = useEffectEvent(() => {
    persist('now');
  });
  const notifyEmpty = useEffectEvent(() => {
    if (hasBegunRef.current) {
      hasBegunRef.current = false;
      intake.discard();
      onEmpty();
    }
  });
  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = status;
    if (status === 'paused' || status === 'failed') {
      flushDraft();
    }
    // 듣기를 시작한 뒤 처음으로 돌아왔다면 들은 글자 없이 끝난 것이다. 저장하고 넘긴 끝내기는 planning을 거친다
    if (status === 'idle' && previousStatus !== 'planning') {
      notifyEmpty();
    }
  }, [status]);

  /** 확인을 기다리는 사이 화면이 내려갔거나 초안을 지웠다. 묻지도 듣지도 않는다 */
  const isStartAbandoned = () => isUnmountedRef.current || intake.isDiscarded();

  const start = async ({
    startLocale,
    hintWords,
  }: {
    startLocale: SpeechLocale;
    hintWords: readonly string[];
  }) => {
    await offerOnDeviceModel(startLocale, { isAbandoned: isStartAbandoned });
    if (isStartAbandoned()) {
      return;
    }
    const hasBegun = await session.begin({
      locale: startLocale,
      hintWords,
      recordingDirectory: recordingRepository.prepareDirectory(accountId),
      seed: seedNote == null ? undefined : VoiceNotePolicy.toCaptureSeed(seedNote),
    });
    hasBegunRef.current = hasBegun;
  };

  const discard = () => {
    hasBegunRef.current = false;
    session.cancel();
    intake.discard();
  };

  return {
    state: session.state,
    level: session.level,
    finish: session.finish,
    pause: session.pause,
    interrupt: session.interrupt,
    resume: session.resume,
    changeLocale: session.changeLocale,
    draftId: baseNote.draftId,
    sentences: captions.sentences,
    interimText: captions.interimText,
    hasText: captions.hasText,
    bookmarksMs: captions.bookmarksMs,
    markCount: captions.markCount,
    start,
    mark: captions.mark,
    discard,
  };
}
