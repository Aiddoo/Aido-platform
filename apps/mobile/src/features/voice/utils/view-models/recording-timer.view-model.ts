import { clamp } from 'es-toolkit';

const RECORDING_RING_MAX_SIZE = 156;
const RECORDING_RING_MIN_SIZE = 112;
/** 작은 화면에서 링이 파형·자막 자리를 뺏지 않게 창 높이에 맞춰 줄이는 비율 */
const RECORDING_RING_WINDOW_SHARE = 0.24;
const RECORDING_RING_STROKE_WIDTH = 5;
/** 둥근 안쪽 벽에 글자 끝이 닿지 않게 비워 두는 폭 */
const RECORDING_RING_TEXT_INSET = 12;

export interface RecordingRingLayout {
  size: number;
  strokeWidth: number;
  radius: number;
  circumference: number;
  /** 링 안 글자 칸의 폭. 글꼴이 커지면 이 폭에 맞춰 글자를 줄인다 */
  textWidth: number;
}

export function getRecordingRingLayout(windowHeight: number): RecordingRingLayout {
  const size = clamp(
    Math.round(windowHeight * RECORDING_RING_WINDOW_SHARE),
    RECORDING_RING_MIN_SIZE,
    RECORDING_RING_MAX_SIZE,
  );
  const radius = (size - RECORDING_RING_STROKE_WIDTH) / 2;

  return {
    size,
    strokeWidth: RECORDING_RING_STROKE_WIDTH,
    radius,
    circumference: 2 * Math.PI * radius,
    textWidth: size - 2 * (RECORDING_RING_STROKE_WIDTH + RECORDING_RING_TEXT_INSET),
  };
}
