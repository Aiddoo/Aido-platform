import { deleteAccountSchema } from '@aido/api/contracts/auth/v1';

export const deleteAccountFormSchema = deleteAccountSchema.required({ password: true });
