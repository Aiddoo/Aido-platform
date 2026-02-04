export interface AuthTokens {
  userId: string;
  accessToken: string;
  refreshToken: string;
  userName: string | null;
  userProfileImage: string | null;
}
