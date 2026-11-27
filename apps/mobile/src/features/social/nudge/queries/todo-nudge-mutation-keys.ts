export const TODO_NUDGE_MUTATION_KEYS = {
  all: ['nudge', 'mutation'] as const,
  replyToNudge: () => [...TODO_NUDGE_MUTATION_KEYS.all, 'reply-to-nudge'] as const,
  sendNudgeThanks: () => [...TODO_NUDGE_MUTATION_KEYS.all, 'send-nudge-thanks'] as const,
  sendRemindNudge: () => [...TODO_NUDGE_MUTATION_KEYS.all, 'send-remind-nudge'] as const,
  sendTodoNudge: () => [...TODO_NUDGE_MUTATION_KEYS.all, 'send-todo-nudge'] as const,
} as const;
