import type { voiceNoteDigestRequestSchema } from '@aido/api/contracts/voice/v1';
import type { z } from 'zod';

// 정리 요청에 싣는 글자와 구간. 멱등 지문을 이 값으로 만들어 같은 노트를 다시 보내면 같은 키를 쓴다
export type VoiceNoteDigestInput = z.infer<typeof voiceNoteDigestRequestSchema>;
