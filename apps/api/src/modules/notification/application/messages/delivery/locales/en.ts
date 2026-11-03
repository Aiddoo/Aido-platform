import type { WeatherCondition } from "@aido/api/vocabulary";

import type { WeatherDayPart } from "../../../../domain/services/reminders/weather-briefing.policy.js";
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

/** 문장 중간에서는 이름을 모를 때의 `A friend` 대신 `your friend`로 읽히게 한다. */
const mention = (name: string): string => (name === SOCIAL_SENDER_FALLBACK ? "your friend" : name);

const REPLY_LABEL = {
  STARTING: "I’ll get started",
  THANKFUL: "Thanks for cheering me on",
  LATER: "I’ll do it later",
};

export const SCHEDULER_TEMPLATES = {
  TODO_REMINDER_60MIN: {
    variants: [
      ({ todoTitle }) => copy("Coming up in 1 hour ⏰", `“${todoTitle}” is on deck`),
      ({ todoTitle }) => copy("One-hour heads-up", `Time to get ready for “${todoTitle}”`),
      ({ todoTitle }) => copy("Next up in an hour", `“${todoTitle}” starts in 60 minutes`),
    ],
  },
  TODO_REMINDER_10MIN: {
    variants: [
      ({ todoTitle }) => copy("Starting in 10 minutes ⏰", `Get set for “${todoTitle}”`),
      ({ todoTitle }) => copy("10-minute heads-up", `“${todoTitle}” is almost here`),
      ({ todoTitle }) => copy("Almost time 🐾", `“${todoTitle}” starts in 10 minutes`),
    ],
  },
  TODO_REMINDER_IMMEDIATE: {
    variants: [
      ({ todoTitle }) => copy("It’s go time 🐾", `Ready to start “${todoTitle}”?`),
      ({ todoTitle }) => copy("Your reminder is here", `Time to check off “${todoTitle}”`),
      ({ todoTitle }) => copy("Starting is half the work", `Take step one on “${todoTitle}”`),
    ],
  },
  MORNING_REMINDER: {
    variants: [
      ({ count }) => copy(`${countLabel(count, "to-do")} today ☀️`, "Start with the easiest one"),
      ({ count }) =>
        copy(`Morning! ${countLabel(count, "to-do")} on deck`, "One check gets the day rolling"),
      ({ count }) =>
        copy(
          `${countLabel(count, "to-do")} on today’s list`,
          "Pick an order and you’re halfway there",
        ),
      ({ count }) =>
        copy(`${countLabel(count, "to-do")}, at your pace`, "Aido’s right here with you 🐾"),
      ({ count }) =>
        copy(`Today’s list: ${countLabel(count, "to-do")}`, "Knock out one and you’re rolling"),
    ],
  },
  EVENING_COMPLETE: {
    variants: [
      staticCopy("All done for today 🎉", "You’ve earned a cozy evening"),
      staticCopy("You crushed it today", "Every box checked, nothing left"),
      staticCopy("A perfect day", "Aido is purring with pride 🐾"),
      staticCopy("Your to-do list is clear", "Take a peek at everything you did"),
      staticCopy("Nice work today", "Your finished to-dos filled the day"),
    ],
  },
  EVENING_PARTIAL: {
    variants: [
      ({ remaining }) =>
        copy(`${countLabel(remaining, "to-do")} left today`, "Got a minute? Try one more"),
      ({ remaining }) =>
        copy(
          `${countLabel(remaining, "to-do")} still open`,
          "Check your to-do list and pick what’s next",
        ),
      ({ remaining }) =>
        copy(`${countLabel(remaining, "to-do")} to go`, "Wrap up an easy one first 🐾"),
      ({ remaining }) =>
        copy(`${remaining} left on today’s list`, "Do what you can. That’s enough"),
    ],
  },
  EVENING_NONE: {
    variants: [
      staticCopy("Check your to-do list? 🌙", "One before bed is plenty"),
      staticCopy("Revisit today’s plan?", "It’s fine to push things to tomorrow"),
      staticCopy("Just one small thing tonight?", "Start with a 5-minute task"),
      staticCopy("Rest day? That’s okay", "Maybe jot down tomorrow’s plans"),
    ],
  },
  MORNING_NO_TODO: {
    variants: [
      staticCopy("What’s one thing for today? ☀️", "One small to-do sets up your day"),
      staticCopy("Your to-do list is empty today", "Add one thing that comes to mind"),
      staticCopy("What’s first today?", "Let’s plan it with Aido 🐾"),
    ],
  },
  EVENING_STREAK: {
    variants: [
      ({ streak, next }) =>
        copy(`${streak}-day streak 🔥`, `Keep it up and tomorrow makes ${next}`),
      ({ streak, next }) => copy(`${streak} days in a row`, `See you on day ${next} tomorrow`),
      ({ streak }) => copy(`${streak}-day streak and counting`, "Aido saw every check today 🐾"),
    ],
  },
  EVENING_STREAK_7: {
    copy: staticCopy("7-day streak 🎉", "Every to-do done, all week long"),
  },
  EVENING_STREAK_14: {
    copy: staticCopy("14-day streak 🏆", "Two weeks straight. It’s a habit now"),
  },
  EVENING_STREAK_30: {
    copy: ({ streak }) => copy(`${streak}-day streak 🐾`, "Consistency is officially your thing"),
  },
  EVENING_STREAK_RISK_PARTIAL: {
    variants: [
      ({ streak, remaining }) =>
        copy(`${streak}-day streak, ${remaining} to go`, "Finish them all to keep it going"),
      ({ remaining, streak }) =>
        copy(`Finish ${remaining} to keep your streak`, `${streak} days strong. No rush 🔥`),
      ({ remaining }) => copy(`${remaining} left for today`, "Start with the easiest one"),
    ],
  },
  EVENING_STREAK_RISK_NONE: {
    variants: [
      ({ streak }) =>
        copy(`Keep your ${streak}-day streak going?`, "See what’s left on your to-do list"),
      ({ streak }) =>
        copy(`Your ${streak}-day streak is waiting 🐾`, "Finish what’s left to keep it going"),
      ({ streak }) =>
        copy(`${streak} days strong so far`, "Wrap up today’s to-dos to keep it going"),
    ],
  },
  LUNCH_NUDGE: {
    variants: [
      staticCopy("Post-lunch to-do?", "Pick something you can do now"),
      staticCopy("First check of the afternoon?", "Your easiest to-do is enough"),
      staticCopy("Peek at your to-do list? 🐾", "One done makes the afternoon lighter"),
      staticCopy("Start small today", "Finish one and find your rhythm"),
    ],
  },
  STREAK_AT_RISK: {
    variants: [
      ({ streak }) =>
        copy(`Keep your ${streak}-day streak alive 🔥`, "Check what’s left on your to-do list"),
      ({ streak }) =>
        copy("Finish what’s left today?", `Wrap it all up to keep your ${streak}-day streak`),
      ({ streak }) => copy(`${streak} days and counting`, "Tidy up what’s left before bed"),
    ],
  },
} satisfies SchedulerNotificationCopyCatalog;

export const WEATHER_TEMPLATES = {
  MORNING_TODO_RAIN: {
    copy: ({ time, todoTitle, precipChance, otherCount }) =>
      copy(
        `Rain likely at ${time} for “${todoTitle}” ☔`,
        otherCount > 0
          ? `${otherCount} more ${otherCount === 1 ? "to-do overlaps" : "to-dos overlap"} · Move to a dry time`
          : `${precipChance}% chance · Move to a dry time`,
      ),
  },
  MORNING_TODO_STORM: {
    copy: ({ time, todoTitle }) =>
      copy(`Lightning risk at ${time} for “${todoTitle}” ⚡`, "Do it indoors or move the time"),
  },
  MORNING_TODO_SNOW: {
    copy: ({ time, todoTitle }) =>
      copy(`Snow at ${time} for “${todoTitle}” ❄️`, "Leave 20 min early for the snow"),
  },
  MORNING_TODO_HEAT: {
    copy: ({ time, todoTitle, apparentTemp }) =>
      copy(
        `Feels like ${apparentTemp}°C at ${time} for “${todoTitle}” ☀️`,
        "Move it to cooler hours",
      ),
  },
  MORNING_RAIN_LATER: {
    copy: ({ time }) => copy(`Rain from ${time} today ☔`, "Take an umbrella when you head out"),
  },
  MORNING_SNOW_LATER: {
    copy: ({ time }) => copy(`Snow from ${time} today ❄️`, "Roads may be slippery. Dress warm"),
  },
  MORNING_SUMMARY: {
    copy: ({ conditionLabel, tempMin, tempMax, precipChance }) =>
      copy(
        `${conditionLabel} today, ${tempMin}–${tempMax}°C`,
        `${precipChance}% chance of precipitation. Have a good day`,
      ),
  },
  EVENING_RAIN: {
    copy: ({ dayPartLabel, chillyTemp }) =>
      copy(
        dayPartLabel == null ? "Rain expected tomorrow ☔" : `Rain starting ${dayPartLabel} ☔`,
        chillyTemp == null
          ? "Keep an umbrella handy"
          : `A chilly ${chillyTemp}°C morning. Bring an umbrella and a jacket`,
      ),
  },
  EVENING_SNOW: {
    copy: ({ dayPartLabel, chillyTemp }) =>
      copy(
        dayPartLabel == null ? "Snow expected tomorrow ❄️" : `Snow starting ${dayPartLabel} ❄️`,
        chillyTemp == null
          ? "Allow extra travel time"
          : `${chillyTemp}°C in the morning. Dress warm and leave early`,
      ),
  },
  EVENING_SUMMARY: {
    copy: ({ conditionLabel, tempMin, tempMax, isChilly }) =>
      isChilly
        ? copy(
            `Chilly ${tempMin}°C tomorrow morning 🌙`,
            `Bring a jacket. It warms to ${tempMax}°C later`,
          )
        : copy(`${conditionLabel} tomorrow, ${tempMin}–${tempMax}°C 🌙`, "Plan your day with it"),
  },
} satisfies WeatherNotificationCopyCatalog;

export const SOCIAL_TEMPLATES = {
  NUDGE_REPLIED: {
    copy: ({ senderName, todoTitle, replyKind }) =>
      copy(`${senderName} replied to your nudge`, `“${todoTitle}” · “${REPLY_LABEL[replyKind]}”`),
  },
  NUDGE_THANKED: {
    copy: ({ senderName, todoTitle }) =>
      copy(`${senderName} says thanks 🐾`, `“${todoTitle}” is done. Your cheer worked!`),
  },
  FOLLOW_NEW: {
    variants: [
      ({ senderName }) =>
        copy(`${senderName} sent you a friend request`, "Accept to cheer each other on"),
      ({ senderName }) =>
        copy(`${senderName} wants to be friends`, "To-dos are easier with a buddy 🐾"),
      ({ senderName }) =>
        copy("New friend request", `Connect with ${mention(senderName)} and cheer each other on`),
    ],
  },
  FOLLOW_ACCEPTED: {
    variants: [
      ({ senderName }) =>
        copy(`${senderName} accepted your friend request`, "Now you can cheer each other on"),
      ({ senderName }) =>
        copy(`You and ${mention(senderName)} are friends now 🎉`, "Why not send the first cheer?"),
      ({ senderName }) =>
        copy("You’ve got a new friend", `Say hi to ${mention(senderName)} with a nudge 🐾`),
    ],
  },
  INVITE_PROGRESS: {
    copy: ({ inviteeName }) =>
      copy(`${inviteeName} finished day one 🐾`, "Nudge them to keep it going tomorrow"),
  },
  INVITE_QUALIFY_REMINDER: {
    copy: ({ inviterName }) =>
      copy("Just one more day 🐾", `Finish a to-do today and ${inviterName} gets a paw print`),
  },
  INVITE_JOINED: {
    copy: ({ inviteeName }) =>
      copy(`${inviteeName} accepted your invite 🐾`, "You’re friends now. Send a welcome cheer"),
  },
  INVITE_REWARDED: {
    copy: ({ premiumDays, friendSlots }) => {
      const premium = `You got ${countLabel(premiumDays, "day")} of Premium`;
      const friends = countLabel(friendSlots, "more friend");
      if (premiumDays > 0 && friendSlots > 0) {
        return copy("You got a paw print 🐾", `${premium} and can add ${friends}`);
      }
      return copy(
        "You got a paw print 🐾",
        premiumDays > 0 ? premium : `You can now add ${friends}`,
      );
    },
  },
  NUDGE_RECEIVED: {
    variants: [
      ({ senderName, todoTitle }) =>
        copy(
          `${senderName} nudged you 🐾`,
          todoTitle ? `Let’s get “${todoTitle}” started` : "Let’s get today’s to-dos started",
        ),
      ({ senderName, todoTitle }) =>
        copy(
          `A nudge from ${mention(senderName)}`,
          todoTitle ? `Ready to start “${todoTitle}”?` : "Pick one thing you can do now",
        ),
      ({ todoTitle, senderName }) =>
        copy(
          "A friend is cheering you on",
          todoTitle
            ? `${senderName} is rooting for “${todoTitle}”`
            : `${senderName} is rooting for you today`,
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
        copy(`${senderName} wants to get started with you 🐾`, "Add one to-do for today?"),
      ({ senderName }) =>
        copy(`A nudge from ${mention(senderName)}`, "Jot down one thing on your mind"),
      ({ senderName }) =>
        copy("A friend is cheering you on", `${senderName} sent a little check-in`),
    ],
  },
  REMIND_NUDGE_RECEIVED_WITH_MESSAGE: {
    copy: ({ senderName, message }) =>
      copy(`A nudge and a note from ${mention(senderName)}`, message),
  },
  CHEER_RECEIVED: {
    copy: ({ senderName, message }) => copy(`A cheer from ${mention(senderName)}`, message),
  },
  CHEER_RECEIVED_NO_MESSAGE: {
    variants: [
      ({ senderName }) => copy(`${senderName} sent you a cheer 🐾`, "Keep going at your own pace"),
      ({ senderName }) => copy(`${senderName} is cheering you on`, "You’ve got this today"),
      ({ senderName }) => copy("A friend is in your corner", `${senderName} is rooting for you`),
    ],
  },
  FRIEND_COMPLETED: {
    variants: [
      ({ friendName }) =>
        copy(`${friendName} finished all of today’s to-dos ✨`, "Send a quick congrats?"),
      ({ friendName }) =>
        copy(`${friendName} is all done for today`, "A little cheer goes a long way"),
      ({ friendName }) =>
        copy("Your friend wrapped up the day", `Tell ${mention(friendName)} nice job 🐾`),
    ],
  },
  SOCIAL_DIGEST_MULTI: {
    variants: [
      ({ completedFriendCount }) =>
        copy(
          `${countLabel(completedFriendCount, "friend")} finished today ✨`,
          "Knock out one too and send a cheer?",
        ),
      ({ completedFriendCount }) =>
        copy(
          `${countLabel(completedFriendCount, "friend")} wrapped up their to-dos`,
          "Send them a quick congrats",
        ),
      ({ completedFriendCount }) =>
        copy(
          `${countLabel(completedFriendCount, "friend")} crossed everything off`,
          "Peek at their progress, then do one 🐾",
        ),
    ],
  },
  SOCIAL_DIGEST_SINGLE: {
    variants: [
      ({ friendName }) =>
        copy(`${friendName} is all done today ✨`, "Cheer them on, then knock out one?"),
      ({ friendName }) => copy(`${friendName} finished today’s to-dos`, "Send a quick congrats?"),
      ({ friendName }) =>
        copy("Your friend wrapped up the day", `Cheer on ${mention(friendName)} and keep pace 🐾`),
    ],
  },
  NUDGE_SUGGEST: {
    variants: [
      ({ friendName }) =>
        copy(`Check in on ${mention(friendName)}?`, "A quick nudge goes a long way 🐾"),
      ({ friendName }) =>
        copy("Send a friend some cheer?", `Say hi to ${mention(friendName)} with a nudge`),
      ({ friendName }) => copy(`How’s ${mention(friendName)} doing?`, "Send a nudge to say hi"),
    ],
  },
  TODO_COMMENT: {
    variants: [
      ({ senderName }) =>
        copy(`${senderName} commented on your to-do`, "Tap to read the new comment"),
      ({ senderName }) => copy(`New comment from ${mention(senderName)}`, "See what they said 🐾"),
      ({ senderName }) =>
        copy("Your to-do has a new comment", `See what ${mention(senderName)} said`),
    ],
  },
  TODO_COMMENT_CHAIN: {
    variants: [
      ({ count, senderName }) =>
        copy(
          `${countLabel(count, "comment")} from ${mention(senderName)}`,
          "Catch up on the new comments",
        ),
      ({ senderName, count }) =>
        copy(`${senderName} left ${countLabel(count, "comment")}`, "The conversation’s going 🐾"),
      ({ count, senderName }) =>
        copy(`${countLabel(count, "new comment")} to read`, `See what ${mention(senderName)} said`),
    ],
  },
  TODO_COMMENT_REPLY: {
    variants: [
      ({ senderName }) => copy(`${senderName} replied to your comment`, "Tap to read the reply"),
      ({ senderName }) =>
        copy(`New reply from ${mention(senderName)}`, "Keep the conversation going 🐾"),
      ({ senderName }) => copy("Your comment got a reply", `See what ${mention(senderName)} said`),
    ],
  },
  TODO_COMMENT_REPLY_TO_REPLY: {
    variants: [
      ({ senderName }) => copy(`${senderName} replied to your reply`, "Tap to read the reply"),
      ({ senderName }) =>
        copy(`New reply from ${mention(senderName)}`, "Keep the conversation going 🐾"),
      ({ senderName }) => copy("Your reply got a reply", `See what ${mention(senderName)} said`),
    ],
  },
  TODO_COMMENT_REPLY_CHAIN: {
    variants: [
      ({ count, senderName }) =>
        copy(
          `${countLabel(count, "reply", "replies")} from ${mention(senderName)}`,
          "Catch up on the conversation",
        ),
      ({ senderName, count }) =>
        copy(
          `${senderName} left ${countLabel(count, "reply", "replies")}`,
          "Catch up on the new replies 🐾",
        ),
      ({ count, senderName }) =>
        copy(
          `${countLabel(count, "new reply", "new replies")} to read`,
          `${senderName} kept the conversation going`,
        ),
    ],
  },
  TODO_COMMENT_LIKE: {
    variants: [
      ({ senderName }) =>
        copy(`${senderName} liked your comment`, "Your words got a little love ❤️"),
      ({ senderName }) => copy(`${senderName} liked what you shared`, "Your comment got a heart"),
      ({ senderName }) => copy("Your comment got a heart", `It’s from ${mention(senderName)}`),
    ],
  },
} satisfies SocialNotificationCopyCatalog;

export const SYSTEM_TEMPLATES = {
  WINBACK_DAY3: {
    variants: [
      staticCopy("Ready to ease back in?", "Add just one to-do for today"),
      staticCopy("Plan today together?", "One small thing is enough"),
      staticCopy("One small step with Aido? 🐾", "Pick your first to-do for today"),
    ],
  },
  WINBACK_DAY7: {
    variants: [
      staticCopy("One thing for today?", "No big plan needed to restart"),
      staticCopy("Start again, nice and slow", "One small to-do is plenty"),
      staticCopy("Blank list, fresh start 🐾", "Add one to-do that’s on your mind"),
    ],
  },
  WINBACK_DAY14: {
    variants: [
      staticCopy("A good day for a fresh plan", "Start with what you need today"),
      staticCopy("Restarts count too", "One small to-do is a great start"),
      staticCopy("Plan today with Aido 🐾", "Skip the backlog. Start with today"),
    ],
  },
  WINBACK_DAY21: {
    variants: [
      staticCopy("Come back anytime", "Add one thing you can do now"),
      staticCopy("There’s room for a new plan", "Start with what you need today"),
      staticCopy("Aido’s still here 🐾", "Let’s pick up with one small plan"),
    ],
  },
  WINBACK_DAY30: {
    variants: [
      staticCopy("Plan something new today?", "Start with what matters now"),
      staticCopy("Familiar place, fresh start", "Write one to-do and take it slow"),
      staticCopy("Fresh start, with Aido 🐾", "Plan only what fits today"),
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
          `Last week: ${countLabel(completedCount, "to-do")} done`,
          "Keep that momentum this week",
        ),
      ({ completedCount }) =>
        copy(
          `You finished ${countLabel(completedCount, "to-do")} last week`,
          "Your small wins, in one place",
        ),
    ],
  },
  WEEKLY_ACHIEVEMENT_PERFECT: {
    variants: [
      staticCopy("100% done last week 🏆", "You finished every to-do. Amazing"),
      staticCopy("Every to-do done last week", "Carry that energy into this week"),
      staticCopy("Last week: all done", "Even Aido is impressed 🐾"),
    ],
  },
  WEEKLY_ACHIEVEMENT_ALMOST: {
    variants: [
      ({ rate }) => copy(`${rate}% done last week`, "So close! Take a look back"),
      ({ rate }) => copy(`${rate}% of last week’s plans done 🐾`, "Go for 100% this week?"),
      ({ rate }) => copy(`Last week: ${rate}% complete`, "Start with what went well"),
    ],
  },
  WEEKLY_REPORT: {
    copy: staticCopy("How did last week go? 📊", "Explore last week in Reports"),
  },
  MONTHLY_REPORT: {
    copy: staticCopy("How did last month go? 📈", "Explore last month in Reports"),
  },
  AI_SUGGESTION: {
    copy: staticCopy("New to-do ideas for you ✨", "Based on your recent to-dos. Take a look"),
  },
  BILLING_ISSUE: {
    copy: staticCopy("Check your payment details", "Update payment to keep your plan active."),
  },
  PREMIUM_GRANT_ENDING: {
    copy: staticCopy("Your Premium ends tomorrow", "Subscribe to keep Premium going"),
  },
  ONBOARDING_DAY0: {
    copy: staticCopy("Let’s add your first to-do 🌱", "One small thing is all it takes"),
  },
  ONBOARDING_DAY1: {
    copy: staticCopy("Start today with one to-do", "Write it, do it, check it off 🐾"),
  },
  ONBOARDING_DAY2: {
    copy: staticCopy("To-dos are better with friends", "See each other’s lists and send nudges"),
  },
  ONBOARDING_DAY3: {
    copy: staticCopy("Reminders that fit your day ⏰", "Set up notifications your way"),
  },
  ONBOARDING_DAY5: {
    copy: ({ completedCount }) =>
      completedCount === 0
        ? copy("Peek at your to-do list? 🐾", "Pick what’s next from the list")
        : copy(
            `${countLabel(completedCount, "to-do")} done so far`,
            "See everything you’ve checked off 🐾",
          ),
  },
  ONBOARDING_DAY7: {
    copy: ({ completedCount }) =>
      copy(
        "Your first week with Aido 🎉",
        completedCount === 0
          ? "Take a look at your first week"
          : `Look back at ${countLabel(completedCount, "finished to-do")}`,
      ),
  },
  MILESTONE_FIRST_COMPLETE: {
    copy: staticCopy("First to-do done! ✨", "Starting is the hardest part. You did it"),
  },
  MILESTONE_10: {
    copy: staticCopy("10 to-dos done 🐾", "Your small wins are stacking up"),
  },
  MILESTONE_50: {
    copy: staticCopy("50 to-dos done already 🎉", "Your consistency is showing"),
  },
  MILESTONE_100: {
    copy: staticCopy("100 to-dos done 🏆", "One at a time got you here"),
  },
  MILESTONE_STREAK_3: {
    copy: staticCopy("3 days in a row 🔥", "Nice rhythm. Keep it going tomorrow"),
  },
  MILESTONE_FIRST_FRIEND: {
    copy: staticCopy("You made your first friend 🐾", "Now you can cheer each other on"),
  },
} satisfies SystemNotificationCopyCatalog;

export const WEATHER_CONDITION_LABEL = {
  CLEAR: "Clear",
  MOSTLY_CLEAR: "Mostly clear",
  PARTLY_CLOUDY: "Partly cloudy",
  MOSTLY_CLOUDY: "Mostly cloudy",
  CLOUDY: "Cloudy",
  FOGGY: "Foggy",
  HAZY: "Hazy",
  WINDY: "Windy",
  DRIZZLE: "Drizzle",
  RAIN: "Rain",
  HEAVY_RAIN: "Heavy rain",
  THUNDERSTORMS: "Thunderstorms",
  SLEET: "Sleet",
  SNOW: "Snow",
  HEAVY_SNOW: "Heavy snow",
  HAIL: "Hail",
  HOT: "Hot",
  FRIGID: "Frigid",
} satisfies Record<WeatherCondition, string>;

/** 영어는 "tomorrow"의 위치가 시간대마다 달라 내일을 포함한 완결된 구로 둔다. */
export const WEATHER_DAY_PART_LABEL = {
  dawn: "before dawn tomorrow",
  morning: "tomorrow morning",
  afternoon: "tomorrow afternoon",
  evening: "tomorrow evening",
} satisfies Record<WeatherDayPart, string>;

export const WEATHER_FALLBACK = {
  MORNING: {
    copy: staticCopy("Add weather to your plans? ☀️", "Set a weather location for daily updates"),
  },
  EVENING: {
    copy: staticCopy("Plan with tomorrow’s weather 🌙", "Set a weather location for forecasts"),
  },
  MORNING_UNAVAILABLE: {
    copy: staticCopy("Check today’s weather ☀️", "See the hourly forecast in the app"),
  },
  EVENING_UNAVAILABLE: {
    copy: staticCopy("Check tomorrow’s weather 🌙", "See tomorrow’s forecast in the app"),
  },
} satisfies WeatherFallbackCopyCatalog;

export const RETENTION_TEMPLATES = {
  "D0:d0_no_todo": {
    variants: [
      staticCopy("Start with one tiny to-do 🌱", "Whatever’s on your mind works"),
      staticCopy("Make a first plan with Aido?", "Jot down one thing to remember 🐾"),
      staticCopy("Create your first to-do", "Even “drink water” counts"),
    ],
  },
  "D1:d1_no_todo": {
    variants: [
      staticCopy("What’s on for today?", "Write down one thing you want to do"),
      staticCopy("No big plans needed", "Start with whatever comes to mind 🐾"),
      staticCopy("Anything you can’t forget?", "Jot it down and clear your head"),
    ],
  },
  "D1:d1_has_todo_no_completion": {
    variants: [
      staticCopy("Ready for your first check? ✅", "Pick your easiest to-do"),
      staticCopy("Start with what you wrote", "Choose one to-do from your list"),
      staticCopy("Try that first checkmark 🐾", "Finishing one changes the day"),
    ],
  },
  "D3:d3_restart": {
    variants: [
      staticCopy("Start fresh today 🌱", "Add one thing you need right now"),
      staticCopy("Keep today’s plan simple", "One small to-do is a fine restart"),
      staticCopy("Another step with Aido 🐾", "Start with what fits today"),
    ],
  },
  "D7:d7_has_progress": {
    variants: [
      staticCopy("Your first week, wrapped up 🎉", "See what you got done this week"),
      staticCopy("Here’s your first week", "Use it to plan the week ahead 🐾"),
      staticCopy("How did your first week go?", "Check your progress and plan what’s next"),
    ],
  },
  "D7:d7_restart": {
    variants: [
      staticCopy("A small plan for today?", "Add one thing you can do now"),
      staticCopy("It’s never too late to restart", "One to-do is all it takes"),
      staticCopy("Plan today with Aido? 🐾", "Pick one to-do to start"),
    ],
  },
} satisfies RetentionNotificationCopyCatalog;
