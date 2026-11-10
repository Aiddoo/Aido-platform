export const QUOTA_USER_MUTATION_LOCK = Symbol("QUOTA_USER_MUTATION_LOCK");

export interface QuotaUserMutationLockPort {
  lockById(userId: string): Promise<boolean>;
}
