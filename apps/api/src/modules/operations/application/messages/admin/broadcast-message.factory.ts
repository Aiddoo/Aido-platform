import type { BroadcastContent } from "../../../domain/value-objects/admin/broadcast-content.vo.js";
import type {
  AdminBroadcastMessage,
  AdminBroadcastType,
  BroadcastAction,
} from "../../read-models/admin/broadcast-message.read-model.js";

export function buildBroadcastMessages(
  content: BroadcastContent,
  userIds: readonly string[],
  type: AdminBroadcastType,
  action: BroadcastAction | undefined,
  force: boolean,
): AdminBroadcastMessage[] {
  return userIds.map((userId) => ({
    userId,
    type,
    title: content.title,
    body: content.body,
    action: action === undefined ? undefined : { ...action },
    metadata: action?.url ? { externalUrl: action.url } : undefined,
    force,
  }));
}
