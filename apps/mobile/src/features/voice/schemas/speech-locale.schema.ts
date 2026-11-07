import { SPEECH_LOCALES } from '@src/core/ports/speech-recognizer';
import { z } from 'zod';

export const speechLocaleSchema = z.enum(SPEECH_LOCALES);
