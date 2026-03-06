export interface UserEventMap {
  profile_edited: { field: string };
  settings_changed: { setting: string; value: string };
}
