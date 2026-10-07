import type { NudgeProps } from "../entities/nudge.aggregate.js";

interface NudgeInteractionContext {
  readonly isMutualFriend: boolean;
  readonly todoOwnerId: string;
  readonly todoVisibility: string;
}

function isPublicOwnedTodo(ownerId: string, receiverId: string, visibility: string): boolean {
  return ownerId === receiverId && visibility === "PUBLIC";
}

export const NudgeInteractionPolicy = {
  isAvailable: (nudge: Pick<NudgeProps, "receiverId">, context: NudgeInteractionContext): boolean =>
    context.isMutualFriend &&
    isPublicOwnedTodo(context.todoOwnerId, nudge.receiverId, context.todoVisibility),
};
