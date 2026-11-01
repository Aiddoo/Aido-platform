export const USER_BRIEF_RELATION = {
  columns: { id: true, userTag: true },
  with: { profile: { columns: { name: true, profileImage: true } } },
} as const;

export type UserBriefRow = {
  id: string;
  userTag: string;
  profile: { name: string | null; profileImage: string | null } | null;
};
