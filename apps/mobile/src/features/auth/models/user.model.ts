export type SubscriptionStatus = 'FREE' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export interface User {
  id: string;
  email: string;
  name: string | null;
  profileImage: string | null;
  userTag: string;
  subscriptionStatus: SubscriptionStatus;
  isSubscribed: boolean;
  createdAt: Date;
}
