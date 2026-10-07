import type {
  NotificationCopy,
  NotificationCopyFactory,
  RetentionNotificationCopyCatalog,
  SchedulerNotificationCopyCatalog,
  SocialNotificationCopyCatalog,
  SystemNotificationCopyCatalog,
  WeatherFallbackCopyCatalog,
  WeatherNotificationCopyCatalog,
} from "../notification-copy.types.js";

export const SOCIAL_SENDER_FALLBACK = "A friend";

const staticCopy =
  (title: string, body: string): NotificationCopyFactory<undefined> =>
  () => ({
    title,
    body,
  });

const copy = (title: string, body: string): NotificationCopy => ({ title, body });

const pluralRules = new Intl.PluralRules("en");
const countLabel = (count: number, singular: string, plural = `${singular}s`): string =>
  `${count} ${pluralRules.select(count) === "one" ? singular : plural}`;

const REPLY_LABEL = {
  STARTING: "I’ll get started",
  THANKFUL: "Thanks for cheering me on",
  LATER: "I’ll do it later",
};

export const SCHEDULER_TEMPLATES = {
  TODO_REMINDER_60MIN: {
    variants: [
      ({ todoTitle }) => copy("A to-do in one hour ⏰", `Get ready for “${todoTitle}”`),
      ({ todoTitle }) => copy("A little time to prepare", `“${todoTitle}” is in one hour`),
      ({ todoTitle }) => copy("Your next plan is coming", `One hour until “${todoTitle}”`),
    ],
  },
  TODO_REMINDER_10MIN: {
    variants: [
      ({ todoTitle }) =>
        copy("Your to-do is in 10 minutes ⏰", `Check the plan for “${todoTitle}”`),
      ({ todoTitle }) => copy("A quick reminder", `Ten minutes to “${todoTitle}”`),
      ({ todoTitle }) => copy("Nearly time to start", `Get set for “${todoTitle}”`),
    ],
  },
  TODO_REMINDER_IMMEDIATE: {
    variants: [
      ({ todoTitle }) => copy("Time for your to-do 🐾", `Let’s start “${todoTitle}”`),
      ({ todoTitle }) => copy("It’s time for your reminder", `Take a look at “${todoTitle}”`),
      ({ todoTitle }) => copy("One small start", `Begin with “${todoTitle}”`),
    ],
  },
  MORNING_REMINDER: {
    variants: [
      ({ count }) => copy(`${countLabel(count, "to-do")} today ☀️`, "Start with one easy task"),
      ({ count }) =>
        copy(`Morning! ${countLabel(count, "plan")} ready`, "Choose what matters today"),
      ({ count }) =>
        copy(`${countLabel(count, "to-do")} on today’s list`, "Take a look and pick your first"),
      ({ count }) =>
        copy(`${countLabel(count, "plan")}, at your pace`, "The cat will walk with you 🐾"),
      ({ count }) =>
        copy("A small start for today", `Choose from your ${countLabel(count, "to-do")}`),
    ],
  },
  EVENING_COMPLETE: {
    variants: [
      staticCopy("All done for today 🎉", "You’ve earned a quiet evening"),
      staticCopy("You did it today", "Every to-do has its checkmark"),
      staticCopy("Every box is checked", "A happy finish with your cat 🐾"),
      staticCopy("Your plans are complete", "Take a look at what you finished"),
      staticCopy("A day well spent", "Your finished tasks tell the story"),
    ],
  },
  EVENING_PARTIAL: {
    variants: [
      ({ remaining }) =>
        copy(`${countLabel(remaining, "to-do")} left today`, "Try one more if you have time"),
      ({ remaining }) =>
        copy(
          `${countLabel(remaining, "to-do")} not checked off`,
          "Check your list and choose what’s next",
        ),
      ({ remaining }) =>
        copy(`${countLabel(remaining, "plan")} to go`, "One small task is a fine next step 🐾"),
      ({ remaining }) => copy(`${remaining} on today’s list`, "Finish what fits your evening"),
    ],
  },
  EVENING_NONE: {
    variants: [
      staticCopy("A look at today’s list? 🌙", "See which plans still fit today"),
      staticCopy("Time to review today’s plans?", "Check your list and adjust what you need"),
      staticCopy("One small task tonight?", "Take a look at today’s list"),
      staticCopy("Go at your own pace", "It’s okay to need a rest day"),
    ],
  },
  MORNING_NO_TODO: {
    variants: [
      staticCopy("One plan for today? ☀️", "Start with a small thing on your mind"),
      staticCopy("Keep a small plan handy", "Write one thing you want to do"),
      staticCopy("What’s your first to-do?", "Make a little plan with your cat 🐾"),
    ],
  },
  EVENING_STREAK: {
    variants: [
      ({ streak, next }) => copy(`${streak}-day streak 🔥`, `Tomorrow could make it ${next}`),
      ({ streak, next }) =>
        copy(`${streak} days of steady steps`, `Your next step could be day ${next}`),
      ({ streak }) => copy(`${streak} days recorded`, "Another day of paw prints 🐾"),
    ],
  },
  EVENING_STREAK_7: {
    copy: staticCopy("A 7-day streak 🎉", "Every planned to-do done for a week"),
  },
  EVENING_STREAK_14: {
    copy: staticCopy("A 14-day streak 🏆", "Two weeks of completed plans"),
  },
  EVENING_STREAK_30: {
    copy: ({ streak }) => copy(`${streak}-day streak 🐾`, "Look back at a month of progress"),
  },
  EVENING_STREAK_RISK_PARTIAL: {
    variants: [
      ({ streak, remaining }) =>
        copy(`${streak}-day streak, ${remaining} left`, "Keep going one task at a time"),
      ({ remaining, streak }) =>
        copy(`${remaining} left to keep your streak`, `Take your time after ${streak} days 🔥`),
      ({ remaining }) => copy(`${remaining} left for today`, "Pick a small task that fits"),
    ],
  },
  EVENING_STREAK_RISK_NONE: {
    variants: [
      ({ streak }) =>
        copy(`Continue your ${streak}-day streak?`, "Check today’s list and what’s left"),
      ({ streak }) =>
        copy(`Check your ${streak}-day streak 🐾`, "Review what’s left on today’s list"),
      ({ streak }) =>
        copy(`You’ve kept going for ${streak} days`, "Start with something you can do"),
    ],
  },
  LUNCH_NUDGE: {
    variants: [
      staticCopy("Your afternoon plans?", "Choose a task you can do now"),
      staticCopy("Ready for an afternoon to-do?", "Pick one from your list"),
      staticCopy("A quick look at your list? 🐾", "One doable task is enough"),
      staticCopy("Start small today", "Finish one task and find your rhythm"),
    ],
  },
  STREAK_AT_RISK: {
    variants: [
      ({ streak }) => copy(`Check your ${streak}-day streak 🔥`, "See what’s left on today’s list"),
      ({ streak }) => copy("One more small step today?", `Check your ${streak}-day streak`),
      ({ streak }) => copy(`${streak} days of steady progress`, "Choose one doable task for today"),
    ],
  },
} satisfies SchedulerNotificationCopyCatalog;

export const WEATHER_TEMPLATES = {
  MORNING_CLEAR: {
    variants: [
      ({ skyLabel, tempMin, tempMax }) =>
        copy(`Today: ${skyLabel} ☀️`, `${tempMin}–${tempMax}°C. Plan your time outside`),
      ({ tempMin, tempMax, skyLabel }) =>
        copy(`${tempMin}–${tempMax}°C today`, `${skyLabel}. Dress for your plans`),
    ],
  },
  MORNING_RAIN: {
    variants: [
      ({ precipProb, tempMin, tempMax }) =>
        copy(`${precipProb}% chance of rain ☔`, `${tempMin}–${tempMax}°C. Take an umbrella`),
      ({ precipProb, tempMin, tempMax }) =>
        copy("Rain in today’s forecast", `${precipProb}% chance, ${tempMin}–${tempMax}°C`),
    ],
  },
  MORNING_SNOW: {
    variants: [
      ({ precipProb, tempMin, tempMax }) =>
        copy(`${precipProb}% chance of snow ❄️`, `${tempMin}–${tempMax}°C. Wrap up warm`),
      ({ precipProb, tempMin, tempMax }) =>
        copy("Snow in today’s forecast", `${precipProb}% chance, ${tempMin}–${tempMax}°C`),
    ],
  },
  EVENING_CLEAR: {
    variants: [
      ({ skyLabel, tempMin, tempMax }) =>
        copy(`Tomorrow: ${skyLabel} 🌙`, `${tempMin}–${tempMax}°C. Get ready for tomorrow`),
      ({ tempMin, tempMax, skyLabel }) =>
        copy(`${tempMin}–${tempMax}°C tomorrow`, `${skyLabel}. Check before heading out`),
    ],
  },
  EVENING_RAIN: {
    variants: [
      ({ precipProb, tempMin, tempMax }) =>
        copy(`${precipProb}% rain tomorrow ☔`, `${tempMin}–${tempMax}°C. Have an umbrella ready`),
      ({ precipProb, tempMin, tempMax }) =>
        copy("Rain forecast for tomorrow", `${precipProb}% chance, ${tempMin}–${tempMax}°C`),
    ],
  },
  EVENING_SNOW: {
    variants: [
      ({ precipProb, tempMin, tempMax }) =>
        copy(`${precipProb}% snow tomorrow ❄️`, `${tempMin}–${tempMax}°C. Allow extra travel time`),
      ({ precipProb, tempMin, tempMax }) =>
        copy("Snow forecast for tomorrow", `${precipProb}% chance, ${tempMin}–${tempMax}°C`),
    ],
  },
} satisfies WeatherNotificationCopyCatalog;

export const SOCIAL_TEMPLATES = {
  NUDGE_REPLIED: {
    copy: ({ senderName, todoTitle, replyKind }) =>
      copy(`${senderName} replied to your nudge`, `“${todoTitle}” · “${REPLY_LABEL[replyKind]}”`),
  },
  NUDGE_THANKED: {
    copy: ({ senderName, todoTitle }) =>
      copy(
        `A thank-you from ${senderName} 🐾`,
        `“${todoTitle}” is done. Thanks for cheering them on!`,
      ),
  },
  FOLLOW_NEW: {
    variants: [
      ({ senderName }) =>
        copy(`A friend request from ${senderName}`, "Accept to cheer each other on"),
      ({ senderName }) =>
        copy(`${senderName} wants to be friends`, "Share your plans and cheer each other on 🐾"),
      ({ senderName }) => copy("A new friend request", `Meet ${senderName} in Aido`),
    ],
  },
  FOLLOW_ACCEPTED: {
    variants: [
      ({ senderName }) =>
        copy(`${senderName} accepted your request`, "You can cheer each other on now"),
      ({ senderName }) =>
        copy(`You’re friends with ${senderName} 🎉`, "A little support for each other’s day"),
      ({ senderName }) => copy("One more friend in Aido", `Say hello to ${senderName} 🐾`),
    ],
  },
  NUDGE_RECEIVED: {
    variants: [
      ({ senderName, todoTitle }) =>
        copy(
          `A nudge from ${senderName} 🐾`,
          todoTitle
            ? `They’re cheering you on for “${todoTitle}”`
            : "They’re cheering you on today",
        ),
      ({ senderName, todoTitle }) =>
        copy(
          `${senderName} is cheering you on`,
          todoTitle ? `Ready to start “${todoTitle}”?` : "Pick one thing you can do now",
        ),
      ({ todoTitle, senderName }) =>
        copy(
          "A little encouragement from a friend",
          todoTitle
            ? `${senderName} nudged “${todoTitle}”`
            : `${senderName} is cheering you on today`,
        ),
    ],
  },
  NUDGE_RECEIVED_WITH_MESSAGE: {
    copy: ({ senderName, todoTitle, message }) =>
      copy(
        `${senderName} sent a nudge and a note`,
        todoTitle ? `“${todoTitle}” · ${message}` : message,
      ),
  },
  REMIND_NUDGE_RECEIVED: {
    variants: [
      ({ senderName }) =>
        copy(`${senderName} is cheering you on today`, "Start with one small to-do 🐾"),
      ({ senderName }) =>
        copy(`A nudge from ${senderName}`, "Start with a small thing on your mind"),
      ({ senderName }) =>
        copy("A friend is cheering you on", `${senderName} sent a little check-in`),
    ],
  },
  REMIND_NUDGE_RECEIVED_WITH_MESSAGE: {
    copy: ({ senderName, message }) => copy(`A nudge and note from ${senderName}`, message),
  },
  CHEER_RECEIVED: {
    copy: ({ senderName, message }) => copy(`A cheer from ${senderName}`, message),
  },
  CHEER_RECEIVED_NO_MESSAGE: {
    variants: [
      ({ senderName }) => copy(`${senderName} sent a cheer 🐾`, "Keep going at your own pace"),
      ({ senderName }) =>
        copy(`A little cheer from ${senderName}`, "A little support for your day"),
      ({ senderName }) => copy("A friend is cheering you on", `${senderName} is rooting for you`),
    ],
  },
  FRIEND_COMPLETED: {
    variants: [
      ({ friendName }) =>
        copy(`${friendName} finished today’s plans ✨`, "Every to-do is checked off"),
      ({ friendName }) =>
        copy(`All done today for ${friendName}`, "Send a little cheer to your friend"),
      ({ friendName }) => copy("Your friend’s to-dos are done", `Cheer for ${friendName} 🐾`),
    ],
  },
  SOCIAL_DIGEST_MULTI: {
    variants: [
      ({ completedFriendCount }) =>
        copy(
          `${countLabel(completedFriendCount, "friend")} finished today ✨`,
          "Send them a little cheer",
        ),
      ({ completedFriendCount }) =>
        copy(
          `${countLabel(completedFriendCount, "friend")} finished their to-dos`,
          "Take a moment to say well done",
        ),
      ({ completedFriendCount }) =>
        copy(
          `${countLabel(completedFriendCount, "friend")} completed their plans`,
          "See their progress together 🐾",
        ),
    ],
  },
  SOCIAL_DIGEST_SINGLE: {
    variants: [
      ({ friendName }) => copy(`${friendName} is all done today ✨`, "Send a little cheer"),
      ({ friendName }) =>
        copy(`${friendName} finished today’s to-dos`, "Send a little encouragement"),
      ({ friendName }) => copy("Your friend finished today’s plans", `Cheer for ${friendName} 🐾`),
    ],
  },
  NUDGE_SUGGEST: {
    variants: [
      ({ friendName }) => copy(`Check in with ${friendName}?`, "Send a gentle nudge 🐾"),
      ({ friendName }) =>
        copy("A little cheer for your friend", `Say hello to ${friendName} with a nudge`),
      ({ friendName }) =>
        copy("A little company for today?", `Take a look at ${friendName}’s plans`),
    ],
  },
  TODO_COMMENT: {
    variants: [
      ({ senderName }) =>
        copy(`${senderName} left a comment`, "There’s a new comment on your to-do"),
      ({ senderName }) =>
        copy(`A new comment from ${senderName}`, "Read the conversation in Aido 🐾"),
      ({ senderName }) => copy("Your to-do has a new comment", `Read what ${senderName} shared`),
    ],
  },
  TODO_COMMENT_CHAIN: {
    variants: [
      ({ count, senderName }) =>
        copy(`${countLabel(count, "comment")} from ${senderName}`, "Read the new comments in Aido"),
      ({ senderName, count }) =>
        copy(
          `${senderName} added ${countLabel(count, "comment")}`,
          "Your to-do’s conversation continues 🐾",
        ),
      ({ count, senderName }) =>
        copy(`${countLabel(count, "new comment")} to read`, `See what ${senderName} shared`),
    ],
  },
  TODO_COMMENT_REPLY: {
    variants: [
      ({ senderName }) =>
        copy(`${senderName} replied to your comment`, "There’s a new reply to read"),
      ({ senderName }) =>
        copy(`A reply from ${senderName}`, "Continue the conversation in Aido 🐾"),
      ({ senderName }) => copy("Your comment has a new reply", `Read what ${senderName} added`),
    ],
  },
  TODO_COMMENT_REPLY_CHAIN: {
    variants: [
      ({ count, senderName }) =>
        copy(
          `${countLabel(count, "reply", "replies")} from ${senderName}`,
          "See the conversation in Aido",
        ),
      ({ senderName, count }) =>
        copy(
          `${senderName} added ${countLabel(count, "reply", "replies")}`,
          "Catch up on the new replies 🐾",
        ),
      ({ count, senderName }) =>
        copy(
          `${countLabel(count, "new reply", "new replies")} to read`,
          `${senderName} continued the conversation`,
        ),
    ],
  },
  TODO_COMMENT_LIKE: {
    variants: [
      ({ senderName }) =>
        copy(`${senderName} liked your comment`, "A little heart for your words ❤️"),
      ({ senderName }) =>
        copy(`${senderName} liked what you shared`, "A little support for your comment"),
      ({ senderName }) => copy("Someone liked your comment", `${senderName} left a heart`),
    ],
  },
} satisfies SocialNotificationCopyCatalog;

export const SYSTEM_TEMPLATES = {
  WINBACK_DAY3: {
    variants: [
      staticCopy("Ready to ease back in?", "Write one small thing you need today"),
      staticCopy("Ready to update your plans?", "Take a look at what fits today"),
      staticCopy("One step with your cat? 🐾", "Choose your first to-do for today"),
    ],
  },
  WINBACK_DAY7: {
    variants: [
      staticCopy("A fresh plan for today?", "Write one thing you need now"),
      staticCopy("Begin again at your pace", "One small plan is enough"),
      staticCopy("Make room for a new plan 🐾", "Write down what’s on your mind"),
    ],
  },
  WINBACK_DAY14: {
    variants: [
      staticCopy("Ready for a fresh plan?", "Begin with what you need today"),
      staticCopy("A restart is a good start", "One small to-do is enough"),
      staticCopy("Plan today with your cat 🐾", "Choose what fits your day now"),
    ],
  },
  WINBACK_DAY21: {
    variants: [
      staticCopy("Take your time getting started", "Write one task you can do now"),
      staticCopy("Room for a new plan", "Start with what you need today"),
      staticCopy("Ready when you are 🐾", "Make one small plan with your cat"),
    ],
  },
  WINBACK_DAY30: {
    variants: [
      staticCopy("A fresh plan for today?", "Choose what matters to you now"),
      staticCopy("A familiar place to begin", "Write one to-do and take your time"),
      staticCopy("A fresh start with your cat 🐾", "Plan only what fits today"),
    ],
  },
  WEEKLY_ACHIEVEMENT: {
    variants: [
      ({ completedCount }) =>
        copy(
          `${countLabel(completedCount, "to-do")} done last week 🐾`,
          "Look back at your progress",
        ),
      ({ completedCount }) =>
        copy(
          `${countLabel(completedCount, "to-do")} done last week`,
          "See last week’s progress in one place",
        ),
      ({ completedCount }) =>
        copy(
          `${countLabel(completedCount, "little achievement")}`,
          "See the small wins from last week",
        ),
    ],
  },
  WEEKLY_ACHIEVEMENT_PERFECT: {
    variants: [
      staticCopy("100% complete last week 🏆", "You finished every planned to-do"),
      staticCopy("Every plan done last week", "Look back at what you finished"),
      staticCopy("Last week’s to-dos, all done", "Look back with your cat 🐾"),
    ],
  },
  WEEKLY_ACHIEVEMENT_ALMOST: {
    variants: [
      ({ rate }) => copy(`${rate}% complete last week`, "Look back at what you finished"),
      ({ rate }) =>
        copy(`You completed ${rate}% of your plans`, "Look back at last week’s plans 🐾"),
      ({ rate }) => copy(`Last week: ${rate}% complete`, "Start with the things you did well"),
    ],
  },
  WEEKLY_REPORT: {
    copy: staticCopy("Review last week’s record? 📊", "Explore last week in Reports"),
  },
  MONTHLY_REPORT: {
    copy: staticCopy("Review last month’s record? 📈", "Explore last month in Reports"),
  },
  AI_SUGGESTION: {
    copy: staticCopy("A to-do suggestion is here ✨", "See if it fits your plans"),
  },
  BILLING_ISSUE: {
    copy: staticCopy("Check your payment details", "Update payment to keep your plan active."),
  },
  ONBOARDING_DAY0: {
    copy: staticCopy("Let’s make your first to-do 🌱", "One small thing is enough to start"),
  },
  ONBOARDING_DAY1: {
    copy: staticCopy("A small plan for today", "Write it down and take one step 🐾"),
  },
  ONBOARDING_DAY2: {
    copy: staticCopy("Share your day with a friend?", "See each other’s plans and send cheers"),
  },
  ONBOARDING_DAY3: {
    copy: staticCopy("A reminder when you need it ⏰", "Set the times that work for you"),
  },
  ONBOARDING_DAY5: {
    copy: ({ completedCount }) =>
      completedCount === 0
        ? copy("Take a look at your plans? 🐾", "Choose what’s next from your list")
        : copy(`${countLabel(completedCount, "to-do")} finished`, "See what you’ve checked off 🐾"),
  },
  ONBOARDING_DAY7: {
    copy: ({ completedCount }) =>
      copy(
        "Your first week in Aido 🎉",
        `Look back at ${countLabel(completedCount, "finished to-do")}`,
      ),
  },
  MILESTONE_FIRST_COMPLETE: {
    copy: staticCopy("Your first to-do is done ✨", "Your first little win, saved"),
  },
  MILESTONE_10: {
    copy: staticCopy("Ten to-dos completed", "Your small wins are adding up 🐾"),
  },
  MILESTONE_50: {
    copy: staticCopy("Fifty to-dos completed 🎉", "A little progress, time after time"),
  },
  MILESTONE_100: {
    copy: staticCopy("One hundred to-dos done 🏆", "One task at a time brought you here"),
  },
  MILESTONE_STREAK_3: {
    copy: staticCopy("Three days in a row 🔥", "Another day, another small step"),
  },
  MILESTONE_FIRST_FRIEND: {
    copy: staticCopy("Your first friend in Aido 🐾", "Share a little support for your days"),
  },
} satisfies SystemNotificationCopyCatalog;

export const SKY_LABEL_MAP = { CLEAR: "Clear", PARTLY_CLOUDY: "Partly cloudy", CLOUDY: "Cloudy" };

export const WEATHER_FALLBACK = {
  MORNING: {
    copy: staticCopy("Add weather to your plans? ☀️", "Set a location in Korea for forecasts"),
  },
  EVENING: {
    copy: staticCopy("Plan with tomorrow’s weather 🌙", "Choose a location in Korea for forecasts"),
  },
} satisfies WeatherFallbackCopyCatalog;

export const RETENTION_TEMPLATES = {
  "D0:d0_no_todo": {
    variants: [
      staticCopy("Start with one small to-do 🌱", "Write down what’s on your mind"),
      staticCopy("A first plan with your cat?", "Write one thing to remember 🐾"),
      staticCopy("Create your first to-do", "One doable thing is enough"),
    ],
  },
  "D1:d1_no_todo": {
    variants: [
      staticCopy("What’s one plan for today?", "Write one thing you want to do"),
      staticCopy("There’s room to make a plan", "Start with one thing on your mind 🐾"),
      staticCopy("Keep one small plan handy", "Begin with something that fits today"),
    ],
  },
  "D1:d1_has_todo_no_completion": {
    variants: [
      staticCopy("Ready for your first check? ✅", "Pick your easiest to-do"),
      staticCopy("Start with a plan you wrote", "Choose one to-do from your list"),
      staticCopy("A first check with your cat 🐾", "Start with one doable task"),
    ],
  },
  "D3:d3_restart": {
    variants: [
      staticCopy("A fresh start for today 🌱", "Write one thing you need now"),
      staticCopy("Keep today’s plan simple", "Restart with one small task"),
      staticCopy("Another step with your cat 🐾", "Start with what fits today"),
    ],
  },
  "D7:d7_has_progress": {
    variants: [
      staticCopy("Look back at your first week 🎉", "Your finished to-dos are all here"),
      staticCopy("See your first week’s record", "Look back at what you finished 🐾"),
      staticCopy("See your first week’s rhythm", "Use your progress to plan what’s next"),
    ],
  },
  "D7:d7_restart": {
    variants: [
      staticCopy("Ready for a small plan today?", "Write one thing you can do now"),
      staticCopy("It’s okay to begin again", "One useful to-do is enough to restart"),
      staticCopy("Plan today with your cat? 🐾", "Choose one to-do to begin"),
    ],
  },
} satisfies RetentionNotificationCopyCatalog;
