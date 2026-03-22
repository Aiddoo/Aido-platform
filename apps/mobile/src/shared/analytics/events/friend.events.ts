export interface FriendEventMap {
  friend_request_sent: undefined;
  friend_request_accepted: undefined;
  friend_request_rejected: undefined;
  friend_removed: undefined;
  friend_reordered: undefined;
  nudge_sent: undefined;
  remind_nudge_sent: undefined;
  invite_link_shared: undefined;
  invite_deep_link_opened: { userTag: string };
  invite_friend_request_sent: { userTag: string; autoAccepted: boolean };
  invite_pending_resolved: { userTag: string; autoAccepted: boolean };
}
