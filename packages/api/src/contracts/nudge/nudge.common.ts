import { z } from "zod";

import { NUDGE_REPLY_KINDS } from "../../vocabulary/nudge.constants.js";

export const nudgeReplyKindSchema = z.enum(NUDGE_REPLY_KINDS);
