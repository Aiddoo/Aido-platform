declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    category_created: { color: string };
    category_updated: { field: 'name' | 'color' };
    category_deleted: undefined;
    category_reordered: { source: 'settings' };
  }
}

export {};
