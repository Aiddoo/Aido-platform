import { z } from 'zod';

export const CATEGORY_SETTINGS_VIEW = {
  edit: 'edit',
  reorder: 'reorder',
} as const;

export const categorySettingsViewSchema = z
  .enum(CATEGORY_SETTINGS_VIEW)
  .catch(CATEGORY_SETTINGS_VIEW.edit);

export type CategorySettingsView = z.output<typeof categorySettingsViewSchema>;
