import { updateProfileSchema } from '@aido/api';
import { trimmed } from '@src/shared/schemas/trimmed.schema';
import { z } from 'zod';

export const updateNameFormSchema = z.object({
  // 계약은 min(1) 뒤에 trim해 공백만 쓴 이름도 통과한다. 먼저 지워야 빈 이름으로 보고 저장 버튼을 끈다
  name: trimmed(updateProfileSchema.shape.name.unwrap()),
});
