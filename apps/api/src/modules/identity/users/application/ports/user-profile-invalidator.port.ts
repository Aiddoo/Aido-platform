export abstract class UserProfileInvalidatorPort {
  abstract invalidateUserProfile(userId: string): Promise<void>;
}
