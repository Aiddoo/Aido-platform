import { followFacade } from "../../follow";
import { internalFollowFacade } from "../../follow/application/facades/follow.facade";
import { schedulerQueue } from "../../scheduler/queue";

export const boundedContextImports = [
	followFacade,
	internalFollowFacade,
	schedulerQueue,
];
