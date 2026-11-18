export interface RegistrationReadModel {
  userId: string;
  email: string;
  emailSent: boolean;
  message: string;
}

export interface UpdatedProfileReadModel {
  message: string;
  name: string | null;
  profileImage: string | null;
}

export interface AccountDeletionReadModel {
  message: string;
  deletedAt: string;
  gracePeriodDays: number;
}
