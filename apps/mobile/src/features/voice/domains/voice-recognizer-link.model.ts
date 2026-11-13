import { match } from 'ts-pattern';
import { z } from 'zod';

import type { VoiceCaptureState } from './voice-capture.model';

/** 이 음량(0..1)을 넘으면 말하는 중으로 본다 */
const SPEAKING_VOLUME_THRESHOLD = 0.18;

/** 음량이 커도 이만큼 새 글자가 없으면 말이 아니라 주변 소리로 본다. 시끄러운 곳에서도 자동으로 마무리되게 한다 */
const SPEECH_TEXT_GRACE_MS = 1_500;

// Android는 멈춘 동안 no-match도 end도 주지 않아, 말소리는 들리는데 글자가 없으면 시간으로 멈춤을 알고 다시 연다
const VOICE_STALL_RESTART = {
  // QA 로그에서 말 구간이 약 3초마다 닫혀 두 구간 길이다
  textlessMs: 6_000,
  // 기침·문소리 몇 번으로는 닿지 않는 말소리 합
  voicedMs: 3_000,
  // 음량은 50ms마다 온다. 이보다 벌어진 틈은 들은 시간으로 세지 않는다
  maxSampleGapMs: 250,
  // 시끄러운 곳에서 녹음 파일이 잘게 쪼개지지 않게 한다
  minIntervalMs: 30_000,
} as const;

/** 이 안에 end가 이만큼 연달아 오면 다시 열어도 소용없는 세션이다 */
const VOICE_RESTART_LOOP = { windowMs: 400, limit: 4 } as const;

const voiceStallWatchSchema = z.object({
  // 마지막 글자를 받았거나 구간이 열린 시각
  lastTextAt: z.number(),
  // 그 뒤로 말소리 크기로 들린 시간의 합(ms)
  voicedMs: z.number().nonnegative(),
  lastSampleAt: z.number().nullable(),
  // 조용할 때는 다시 열지 않는다
  isVoiceAudible: z.boolean(),
  // 글자가 오면 인식기가 살아난 것이라 지운다
  lastRestartAt: z.number().nullable(),
});
export type VoiceStallWatch = z.infer<typeof voiceStallWatchSchema>;

export function createVoiceStallWatch(
  now: number,
  lastRestartAt: number | null = null,
): VoiceStallWatch {
  return { lastTextAt: now, voicedMs: 0, lastSampleAt: null, isVoiceAudible: false, lastRestartAt };
}

export function withVolumeSample(
  watch: VoiceStallWatch,
  level: number,
  now: number,
): VoiceStallWatch {
  const isVoiceAudible = level >= SPEAKING_VOLUME_THRESHOLD;
  const gapMs = watch.lastSampleAt == null ? 0 : Math.max(0, now - watch.lastSampleAt);
  return {
    ...watch,
    voicedMs:
      watch.voicedMs + (isVoiceAudible && gapMs <= VOICE_STALL_RESTART.maxSampleGapMs ? gapMs : 0),
    lastSampleAt: now,
    isVoiceAudible,
  };
}

export function withTextHeard(watch: VoiceStallWatch, now: number): VoiceStallWatch {
  return { ...createVoiceStallWatch(now), lastSampleAt: watch.lastSampleAt };
}

// 파형은 움직이는데 글자가 오지 않으면 구간을 다시 연다. 앱이 stop을 부른 구간은 곧 end가 와서 열지 않는다
export function shouldRestartStalledRecognizer(
  { isStopRequested, stallWatch: watch }: VoiceRecognizerLink,
  state: Pick<VoiceCaptureState, 'status'>,
  now: number,
): boolean {
  return (
    !isStopRequested &&
    state.status === 'listening' &&
    watch.isVoiceAudible &&
    watch.voicedMs >= VOICE_STALL_RESTART.voicedMs &&
    now - watch.lastTextAt >= VOICE_STALL_RESTART.textlessMs &&
    (watch.lastRestartAt == null || now - watch.lastRestartAt >= VOICE_STALL_RESTART.minIntervalMs)
  );
}

/** 인식기와 세션의 연결 상태. 화면에 보이지 않고 시각은 호출한 쪽이 넘긴다 */
export interface VoiceRecognizerLink {
  /** 인식기에 시작을 맡긴 뒤 `end`를 아직 받지 못했다 */
  isRunning: boolean;
  /** 지금 구간에 앱이 stop을 불렀다. 그 구간의 `end`나 다음 시작까지 유지한다 */
  isStopRequested: boolean;
  lastStartedAt: number;
  quickEndCount: number;
  lastTextAt: number | null;
  lastTranscript: string;
  stallWatch: VoiceStallWatch;
}

export type VoiceRecognizerLinkEvent =
  /** 준비를 마치고 인식기에 시작을 맡겼다. 재시작 횟수와 멈춤 감시를 새로 센다 */
  | { type: 'start-requested'; at: number }
  /** 사용자가 끝내지 않았는데 구간이 끝나 같은 세션을 다시 열었다 */
  | { type: 'segment-restarted'; at: number }
  | { type: 'started'; at: number }
  | { type: 'stop-requested' }
  /** 글자 없이 말소리만 들려 구간을 닫는다 */
  | { type: 'stall-restarted'; at: number }
  /** `end`를 받았거나 abort로 끝난 것으로 본다 */
  | { type: 'ended' }
  | { type: 'text-heard'; transcript: string; at: number }
  | { type: 'volume-sampled'; level: number; at: number };

export function createVoiceRecognizerLink(): VoiceRecognizerLink {
  return {
    isRunning: false,
    isStopRequested: false,
    lastStartedAt: 0,
    quickEndCount: 0,
    lastTextAt: null,
    lastTranscript: '',
    stallWatch: createVoiceStallWatch(0),
  };
}

function getQuickEndCount(
  { lastStartedAt, quickEndCount }: Pick<VoiceRecognizerLink, 'lastStartedAt' | 'quickEndCount'>,
  now: number,
): number {
  return now - lastStartedAt < VOICE_RESTART_LOOP.windowMs ? quickEndCount + 1 : 0;
}

export function isRestartLooping(link: VoiceRecognizerLink, now: number): boolean {
  return getQuickEndCount(link, now) >= VOICE_RESTART_LOOP.limit;
}

// 음량이 말소리만큼 크고, 글자가 아직 없거나 방금 왔으면 말하는 중이다. 글자가 끊긴 큰 소리는 주변 소리다
export function isSpeaking(
  { lastTextAt }: VoiceRecognizerLink,
  level: number,
  now: number,
): boolean {
  return (
    level >= SPEAKING_VOLUME_THRESHOLD &&
    (lastTextAt == null || now - lastTextAt < SPEECH_TEXT_GRACE_MS)
  );
}

export function reduceRecognizerLink(
  link: VoiceRecognizerLink,
  event: VoiceRecognizerLinkEvent,
): VoiceRecognizerLink {
  return match(event)
    .returnType<VoiceRecognizerLink>()
    .with({ type: 'start-requested' }, ({ at }) => ({
      ...link,
      isRunning: true,
      isStopRequested: false,
      lastStartedAt: at,
      quickEndCount: 0,
      stallWatch: createVoiceStallWatch(at),
    }))
    .with({ type: 'segment-restarted' }, ({ at }) => ({
      ...link,
      isRunning: true,
      isStopRequested: false,
      lastStartedAt: at,
      quickEndCount: getQuickEndCount(link, at),
    }))
    .with({ type: 'started' }, ({ at }) => ({
      ...link,
      stallWatch: createVoiceStallWatch(at, link.stallWatch.lastRestartAt),
    }))
    .with({ type: 'stop-requested' }, () => ({ ...link, isStopRequested: true }))
    .with({ type: 'stall-restarted' }, ({ at }) => ({
      ...link,
      stallWatch: createVoiceStallWatch(at, at),
    }))
    .with({ type: 'ended' }, () => ({ ...link, isRunning: false, isStopRequested: false }))
    .with({ type: 'text-heard' }, ({ transcript, at }) => ({
      ...link,
      lastTranscript: transcript,
      lastTextAt: transcript === link.lastTranscript ? link.lastTextAt : at,
      // stop 뒤에 온 마지막 결과는 살아 있다는 뜻이 아니다. 다시 연 간격을 지우지 않는다
      stallWatch: link.isStopRequested ? link.stallWatch : withTextHeard(link.stallWatch, at),
    }))
    .with({ type: 'volume-sampled' }, ({ level, at }) => ({
      ...link,
      stallWatch: withVolumeSample(link.stallWatch, level, at),
    }))
    .exhaustive();
}

export const VoiceRecognizerLinkPolicy = {
  isRestartLooping,
  isSpeaking,
  shouldRestartStalledRecognizer,
  withVolumeSample,
  withTextHeard,
  reduceRecognizerLink,
} as const;
