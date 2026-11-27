export const INQUIRY_MUTATION_KEYS = {
  all: ['inquiry', 'mutation'] as const,
  createInquiry: () => [...INQUIRY_MUTATION_KEYS.all, 'create-inquiry'] as const,
} as const;
