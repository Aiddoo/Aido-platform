import { z } from "zod";

import { PROFILE_ICON_KEYS } from "../../vocabulary/auth.constants.js";

export const profileIconKeySchema = z.enum(PROFILE_ICON_KEYS);
