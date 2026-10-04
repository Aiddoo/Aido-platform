export const NUDGE_INTERACTION_CONFIG = Symbol("NUDGE_INTERACTION_CONFIG");

export interface NudgeInteractionConfigPort {
	readonly enabled: boolean;
}
