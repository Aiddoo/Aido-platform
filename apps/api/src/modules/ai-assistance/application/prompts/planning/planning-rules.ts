import { ACTION_PLAN_LIMITS } from "@aido/api/vocabulary";

/** quick-plan·voice-note-digest가 함께 쓰는 행동 규칙 블록 */
export const PLANNING_RULES_KO = {
  actions: `<action_rules>
- 사용자가 할 일만 CREATE_TODO로 만든다. 감상, 혼잣말, 이미 끝낸 일, 남의 이야기는 만들지 않는다.
- 서로 다른 일은 CREATE_TODO를 나눈다. 한 일의 목록·준비물·단계("장보기 우유 계란 두부")는 할 일 1개로 만들고 목록은 items에 말한 순서대로 쓴다.
- 할 일은 말한 순서대로 최대 ${ACTION_PLAN_LIMITS.MAX_TODOS}개까지만 쓴다.
- CREATE_MEMO는 "메모해 줘", "적어 둬", "기억해 둬"처럼 기록을 부탁한 정보가 있을 때만 최대 ${ACTION_PLAN_LIMITS.MAX_MEMOS}개 만든다. content에는 말한 정보만 정리해 쓴다.
- 할 일도 기록 부탁도 없으면 actions는 []다.
</action_rules>`,
  title: `<title_rules>
- title은 핵심 행동만 짧게 쓴다. 날짜·시각·반복·공개 범위 표현, "~해야 돼" 같은 어미, 이모지는 뺀다. 말한 대상과 분량("5km", "10쪽")은 그대로 둔다.
- items는 말한 항목만 쓴다. 할 일 제목을 items에 반복하지 않고, 항목이 없으면 []다.
</title_rules>`,
  visibility: `<visibility_rules>
- "비공개로", "나만 보게", "친구한테 안 보이게"처럼 공개하지 말라고 하면 visibility는 PRIVATE다. 언급이 없으면 null이다.
</visibility_rules>`,
  duplicate: `<duplicate_rules>
- context.upcomingTodos에 같은 일이 있으면 duplicateOfTodoId에 그 id를 쓴다. 같은 일은 같은 행동이고, 말한 날짜가 그 할 일의 date와 같거나 그 할 일이 repeating인 경우다.
- 비슷하기만 하거나 날짜가 다르면 null이다. 겹쳐도 할 일은 그대로 만든다(사용자가 고른다).
</duplicate_rules>`,
} as const;

export const PLANNING_RULES_EN = {
  actions: `<action_rules>
- Create CREATE_TODO only for things the user will do. Skip reflections, thinking aloud, finished work, and other people's stories.
- Split different tasks into separate CREATE_TODO actions. A list, supplies, or steps of one task ("groceries milk eggs tofu") become one to-do with the list in items, in spoken order.
- Write to-dos in spoken order, at most ${ACTION_PLAN_LIMITS.MAX_TODOS}.
- Create at most ${ACTION_PLAN_LIMITS.MAX_MEMOS} CREATE_MEMO, only for information the user asked you to note ("make a note", "write down", "remember that"). content holds only what was said.
- With no task and no note request, actions is [].
</action_rules>`,
  title: `<title_rules>
- title is the core action only, kept short. Remove date, time, repetition, and privacy phrases, filler such as "I need to", and emojis. Keep stated objects and amounts ("5 km", "10 pages").
- items contain only the listed things. Never repeat the to-do title as an item; use [] when nothing is listed.
</title_rules>`,
  visibility: `<visibility_rules>
- When the user asks to keep it private ("make it private", "just for me", "hide it from friends"), visibility is PRIVATE. Otherwise null.
</visibility_rules>`,
  duplicate: `<duplicate_rules>
- When context.upcomingTodos already has the same to-do, put its id in duplicateOfTodoId. Same means the same action, and either the stated day equals that to-do's date or that to-do is repeating.
- Merely similar to-dos or different days are null. Still create the to-do even when it is a duplicate (the user decides).
</duplicate_rules>`,
} as const;
