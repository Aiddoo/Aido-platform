export const USER_PROFILE_INVALIDATOR = Symbol("USER_PROFILE_INVALIDATOR");

export interface UserProfileInvalidatorPort {
  invalidateUserProfile(userId: string): Promise<void>;
}
