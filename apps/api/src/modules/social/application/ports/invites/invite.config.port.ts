export const INVITE_CONFIG = Symbol("INVITE_CONFIG");

export interface InviteConfigPort {
  readonly isEnabled: boolean;
}
