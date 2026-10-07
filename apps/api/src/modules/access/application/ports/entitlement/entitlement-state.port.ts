export interface EntitlementUserState {
  readonly role: string;
  readonly subscriptionStatus: string;
}

export const ENTITLEMENT_DATABASE = Symbol("ENTITLEMENT_DATABASE");

export interface EntitlementDatabasePort {
  findUserState(userId: string): Promise<EntitlementUserState | null>;
}
