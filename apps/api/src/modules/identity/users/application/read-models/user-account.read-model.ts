export interface RegisterResult {
  userId: string;
  email: string;
  emailSent: boolean;
  message: string;
}

export interface UpdateProfileResult {
  message: string;
  name: string | null;
  profileImage: string | null;
}

export interface DeleteAccountResult {
  message: string;
  deletedAt: string;
  gracePeriodDays: number;
}
