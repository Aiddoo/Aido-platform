import { nudgeDirectionSchema } from '@src/features/todo/models/nudge-interaction.model';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

const NudgeSearchSchema = z.object({ direction: nudgeDirectionSchema.catch('received') });

export default function NudgesScreen() {
  const { direction } = NudgeSearchSchema.parse(useLocalSearchParams());
  return <Redirect href={direction === 'sent' ? '/nudges/sent' : '/notifications'} />;
}
