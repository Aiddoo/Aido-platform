export const TODO_MUTATION_KEYS = {
  all: ['todo', 'mutation'] as const,
  /** 목록을 낙관적으로 고치는 뮤테이션 전부 */
  listWrites: () => [...TODO_MUTATION_KEYS.all, 'list-write'] as const,
  /** 그중 완료 기록(달력·위젯·시작 체크리스트)까지 바꾸는 것 */
  completionWrites: () => [...TODO_MUTATION_KEYS.listWrites(), 'completion'] as const,
} as const;
