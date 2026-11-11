import { pushRegistrationSchema } from '../domains/push-registration.model';

/** 키체인에 남기는 이 기기의 푸시 등록. 토큰을 담아 평문 MMKV가 아니라 보안 저장소에 둔다 */
export const pushRegistrationStorageSchema = pushRegistrationSchema;
