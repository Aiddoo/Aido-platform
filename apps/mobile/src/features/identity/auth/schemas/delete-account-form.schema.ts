import { deleteAccountSchema } from '@aido/api';

export const deleteAccountFormSchema = deleteAccountSchema.required({ password: true });
