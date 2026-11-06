import { z } from 'zod';

export const CATEGORY_SETTINGS_VIEW = {
  edit: 'edit',
  reorder: 'reorder',
} as const;

export const categorySettingsViewSchema = z.enum(CATEGORY_SETTINGS_VIEW);

export type CategorySettingsView = z.output<typeof categorySettingsViewSchema>;

export const categorySettingsParamsSchema = z.object({
  view: categorySettingsViewSchema.catch(CATEGORY_SETTINGS_VIEW.edit),
});
