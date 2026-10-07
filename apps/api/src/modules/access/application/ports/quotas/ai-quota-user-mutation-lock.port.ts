export const AI_QUOTA_USER_MUTATION_LOCK = Symbol("AI_QUOTA_USER_MUTATION_LOCK");

export interface AiQuotaUserMutationLockPort {
  lockById(userId: string): Promise<boolean>;
}
