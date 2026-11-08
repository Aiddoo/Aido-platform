import { instantSchema } from '@src/shared/date/instant';

/** 출시된 앱이 남긴 값처럼 시각 문자열 하나다. 시각으로 읽을 수 없으면 답한 적 없는 것으로 본다 */
export const pushPermissionPromptAtStorageSchema = instantSchema.nullable().catch(null);
