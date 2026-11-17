export interface ExchangeCodeResult {
  userId: string;
  accessToken: string;
  refreshToken: string;
  userName?: string;
  profileImage?: string;
  accountRestored?: boolean;
  isNewUser: boolean;
}
