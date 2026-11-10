import { instantSchema } from '@src/shared/date/instant';

/** 해제를 요청한 시각. 시각으로 읽을 수 없으면 보낼 해제가 없는 것으로 본다 */
export const pushDeviceReleaseRequestedAtStorageSchema = instantSchema.nullable().catch(null);
