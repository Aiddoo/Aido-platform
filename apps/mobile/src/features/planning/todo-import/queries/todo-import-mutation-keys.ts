export const TODO_IMPORT_MUTATION_KEYS = {
  all: ['todo-import', 'mutation'] as const,
  start: () => [...TODO_IMPORT_MUTATION_KEYS.all, 'start'] as const,
  cancel: ({ importId }: { importId: string }) =>
    [...TODO_IMPORT_MUTATION_KEYS.all, 'cancel', { importId }] as const,
  undo: ({ importId }: { importId: string }) =>
    [...TODO_IMPORT_MUTATION_KEYS.all, 'undo', { importId }] as const,
} as const;
