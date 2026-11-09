import { changePasswordSchema, type ChangePasswordInput } from '@aido/api';

/** 현재 비밀번호와 같은 새 비밀번호를 서버와 같은 규칙으로 막는다 */
export const changePasswordFormSchema = changePasswordSchema;

export type ChangePasswordFormValues = ChangePasswordInput;
