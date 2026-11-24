/**
 * The words on the pricing and enterprise pages. Layout and style come from the design;
 * every price, credit amount and limit comes from the server (`/api/billing/plans`). Nothing
 * here may state a number the server does not own.
 */
import { brand } from "@/config/brand";

export const pricingCopy = {
  offer: {
    // Only shown while `promo` in site.ts is enabled. Placeholder text.
    lineOne: "Sample offer",
    lineTwoLead: "Redeem code",
    countdownLabel: "Offer ends in...",
    units: { hours: "hours", minutes: "minutes", seconds: "seconds" },
    redeemHint: "Redeem it in the checkout window or under Wallet.",
  },
  heading: {
    title: "Plans for every pace of making",
    /** `{saving}` is the largest yearly saving the server reports. */
    sub: "Fresh credits every month. Pay yearly and save up to {saving}%.",
    subPlain: "Fresh credits every month on every paid plan.",
  },
  audience: { individual: "Individual", business: "Business plans" },
  period: { monthly: "Monthly", annual: "Annual", save: "Save up to {saving}%" },
  card: {
    perMonthYearly: "/mo, billed yearly",
    perMonthMonthly: "/mo, billed monthly",
    creditsUnit: "credits",
    perMonth: "/ month",
    jobsAtOnce: "jobs running at once",
    creditsKeep: "Unused credits stay in your balance",
    included: "Included in plan",
    billing: "Billing",
    billedMonthly: "Billed monthly",
    billedYearly: "Billed yearly",
    yearlySaving: "Yearly saves",
    demoNote: "Demo billing: no card is taken",
    get: "Get {plan}",
  },
  button: {
    current: "Current plan",
    upgrade: "Upgrade",
    downgrade: "Downgrade",
    toYearly: "Switch to yearly",
    toMonthly: "Switch to monthly",
    keep: "Keep {plan}",
    signIn: "Sign in to get {plan}",
  },
  current: {
    label: "Your plan",
    free: "You are on Free. Pick a plan below to get credits every month.",
    renews: "Renews on {date}",
    ends: "Ends on {date}. You keep it until then.",
    nextCharge: "Next charge {amount}",
    pending: "Changes to {plan} ({interval}) on {date}.",
    cancel: "Cancel plan",
    resume: "Resume plan",
    cancelTitle: "Cancel your plan?",
    cancelBody:
      "You keep your plan and its credits until {date}. After that you move to Free. Credits already in your balance stay.",
    cancelConfirm: "Cancel plan",
    cancelKeep: "Keep my plan",
    monthly: "monthly",
    yearly: "yearly",
  },
  checkout: {
    title: "Checkout",
    changeTitle: "Change plan",
    demo: "Demo billing: no card is taken and no money moves. Confirming switches the plan at once.",
    plan: "Plan",
    billing: "Billing",
    monthly: "Monthly",
    yearly: "Yearly",
    credits: "Credits",
    creditsValue: "{credits} credits every month",
    jobs: "Jobs at once",
    starts: "Starts",
    now: "Now",
    total: "Due today",
    totalLater: "Due on {date}",
    promoLabel: "Promo code",
    promoPlaceholder: "Enter a code",
    promoApply: "Apply",
    promoDone: "{code} added {credits} credits to your balance.",
    promoNote: "Codes add credits to your balance. They do not change the plan price.",
    confirm: "Confirm {plan}",
    confirmChange: "Confirm change",
    done: "You are on {plan}.",
    doneLater: "{plan} starts on {date}.",
    doneBody: "Your plan is shown at the top of this page. You can change or cancel it any time.",
    close: "Done",
    signedOutTitle: "Sign in to choose a plan",
  },
  note: [
    "Plans do not include unlimited generations: every job uses credits, at the price shown before you press Generate.",
    "Prices are in US dollars. Billing here is a demo, so no card is asked for and nothing is charged.",
    "New models may reach some members before others.",
  ],
  links: {
    howPlans: `How do ${brand.name} plans work?`,
    credits: "Where do I see my credits?",
  },
  compare: {
    title: "Compare plans",
    sub: "Everything each plan includes, side by side",
    free: "Free",
    freeSub: "No card, no charge",
    perMonth: "{price}/month",
    billedYearly: "Billed yearly",
    billedMonthly: "Billed monthly",
    get: "Get plan",
    annual: "Annual",
    save: "−{saving}%",
    sections: {
      credits: "Credits",
      making: "Making",
      included: "Included",
    },
    rows: {
      monthlyCredits: "Credits each month",
      monthlyCreditsSub: "Paid out at the start of every month",
      yearlyPrice: "Price per year",
      yearlyPriceSub: "When billed yearly",
      monthlyPrice: "Price per month",
      monthlyPriceSub: "When billed monthly",
      concurrency: "Jobs at once",
      concurrencySub: "Queued or running together",
    },
    jobs: "{n} jobs",
    none: "None",
    more: "Show all rows",
    less: "Show fewer rows",
  },
  faq: {
    title: "Common questions",
    items: [
      {
        q: "How do credits work?",
        a: "Every generation has a price in credits, shown on the Generate button before you start. The credits come off your balance when the job runs. A failed job is not charged.",
      },
      {
        q: "Does my plan renew by itself?",
        a: "Yes. A plan renews at the end of each month or year until you cancel. Cancelling keeps the plan until the end of the period you paid for, then moves you to Free.",
      },
      {
        q: "When do plan credits arrive?",
        a: "A paid plan adds its credits once a month, at the start of each month window. That is true on yearly billing too: a yearly plan pays out month by month.",
      },
      {
        q: "Do unused credits expire?",
        a: "No. Credits you have not spent stay in your balance, including after you cancel or change plans.",
      },
      {
        q: "Can I get more credits without changing plan?",
        a: "Yes. You can top up from your Wallet at any time, and promo codes add credits too.",
      },
      {
        q: "Can I change my plan later?",
        a: "Any time. A bigger plan or a move to yearly starts at once with a fresh period. A smaller plan or a move to monthly starts when your current period ends.",
      },
      {
        q: "What does yearly billing save?",
        a: "Yearly billing is charged once a year and costs less than twelve monthly payments. The saving for each plan is shown on its card.",
      },
      {
        q: "Is any money taken right now?",
        a: `No. ${brand.name} billing runs in demo mode: no card is asked for and nothing is charged. Plan changes, receipts and credits work as they will for real.`,
      },
      {
        q: `Can I use ${brand.name} for free?`,
        a: "Yes. Free accounts start with sign-up credits and can use every studio. Paid plans add credits each month and let more jobs run at once.",
      },
    ],
  },
  ready: { lead: "Ready to start?", cta: "Choose your plan" },
  errors: {
    plans: "The plans could not be loaded.",
    retry: "Try again",
  },
} as const;

export const enterpriseCopy = {
  eyebrow: "For teams",
  title: `${brand.name} for teams`,
  sub: "One place for your whole team to make images, video and sound with every model we host, and see what it costs before each job runs.",
  points: [
    {
      title: "Every studio, one account each",
      body: "Image, video, avatar, speech and music studios, with the same model list and the same up-front prices for everyone.",
    },
    {
      title: "Prices before you press Generate",
      body: "Every job shows its credit price first. Nothing runs without a known cost.",
    },
    {
      title: "Private by default",
      body: "Each member's library is private until they choose to share a piece.",
    },
    {
      title: "More jobs at once",
      body: "Bigger plans let more jobs queue and run together, for batch and video work.",
    },
    {
      title: "Built in the open",
      body: `${brand.name} is open source. You can read how it works and run it yourself.`,
    },
    {
      title: "Developer access",
      body: "Drive the same models from your own tools through the API and MCP.",
    },
  ],
  plansCta: "See plans",
  apiCta: "Read the API",
  contactTitle: "Talking to us",
  contactBody:
    "Team accounts with shared billing are not open yet. Until then, each person can pick their own plan on the pricing page.",
} as const;

/** "{plan}" style fill-ins. */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));
}
