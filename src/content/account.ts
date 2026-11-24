/**
 * Words for the member's own pages: settings, notification settings, wallet and invites.
 * Layout and style come from the design; every word here is Parallax's own.
 */
import { brand } from "@/config/brand";

export const accountNav = {
  label: "Account",
  sections: [
    { id: "profile", label: "Profile", anchor: "profile" },
    { id: "sign-in", label: "Sign-in", anchor: "sign-in" },
    { id: "sessions", label: "Devices", anchor: "sessions" },
    { id: "preferences", label: "Preferences", anchor: "preferences" },
    { id: "delete", label: "Delete account", anchor: "delete" },
  ],
  notifications: "Notifications",
  wallet: "Wallet",
  invite: "Invite friends",
  guestPlan: "Guest",
  planSuffix: "plan",
} as const;

export const gate = {
  signedOut: {
    settings: { title: "Your settings live here", body: "Sign in to change your profile, password, devices and preferences." },
    notifications: { title: "Choose what you hear about", body: "Sign in to pick which notices reach you." },
    wallet: { title: "Your credits, in one place", body: "Sign in to see your balance, add credits and read your history." },
    invite: { title: "Bring a friend, both get credits", body: "Sign in to get your own invite link." },
  },
  signIn: "Log in",
  join: "Create account",
  guestTitle: "You are using a guest account",
  guestBody: "Create an account to keep your work, set a password and use every setting.",
} as const;

export const common = {
  save: "Save",
  saving: "Saving…",
  saved: "Saved.",
  retry: "Try again",
  loadFailed: "This part did not load.",
  showMore: "Show more",
  loadingMore: "Loading…",
  end: "That is everything.",
  demoNote: "Demo: no payment is taken.",
} as const;

export const profileCopy = {
  title: "Profile",
  hint: "How others see you",
  name: "Display name",
  handle: "Handle",
  handleChecking: "Checking…",
  handleFree: "That handle is free.",
  handleOwn: "This is your handle now.",
  bio: "Bio",
  bioPlaceholder: "A line or two about what you make",
  bioCount: (n: number) => `${n}/300`,
  avatar: "Picture",
  avatarPick: "Choose from your images",
  avatarRemove: "Remove picture",
  avatarEmpty: "Make or upload an image first, then pick it here.",
  avatarOpenLibrary: "Open the library",
  avatarSaved: "Picture updated.",
  avatarRemoved: "Picture removed.",
  pickerTitle: "Pick a picture",
  nothingChanged: "Nothing to save yet.",
} as const;

export const signInCopy = {
  title: "Sign-in",
  hint: "Email and password",
  email: "Email",
  newEmail: "New email",
  currentPassword: "Current password",
  newPassword: "New password",
  passwordRule: "8 characters or more.",
  changeEmail: "Change email",
  changePassword: "Change password",
  emailSaved: "Email changed.",
  passwordSaved: (n: number) =>
    n > 0 ? `Password changed. ${n} other ${n === 1 ? "device was" : "devices were"} signed out.` : "Password changed.",
  guest: "Guests have no email or password. Create an account to add them.",
} as const;

export const sessionsCopy = {
  title: "Devices",
  hint: "Where you are signed in",
  thisDevice: "This device",
  unknown: "Unknown device",
  lastSeen: "Active",
  signedInAt: "Signed in",
  signOut: "Sign out",
  signOutOthers: "Sign out all others",
  signedOutOne: "That device is signed out.",
  signedOutMany: (n: number) => (n === 0 ? "No other devices were signed in." : `${n} ${n === 1 ? "device" : "devices"} signed out.`),
  onlyThis: "Only this device is signed in.",
} as const;

export const prefsCopy = {
  title: "Preferences",
  hint: "Defaults for new work",
  privacy: "New generations",
  privacyOptions: { private: "Private", public: "Public" } as Record<string, string>,
  privacyHelp: "Who can see what you make, until you change it.",
  language: "Language",
  theme: "Theme",
  themeOptions: { system: "Match device", dark: "Dark", light: "Light" } as Record<string, string>,
  notices: "Notices",
  noticesLink: "Choose what you hear about",
} as const;

/** Native names, so a member can find their own language. */
export const languageNames: Record<string, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  nl: "Nederlands",
  pl: "Polski",
  tr: "Türkçe",
  ja: "日本語",
  ko: "한국어",
  zh: "中文",
};

export const deleteCopy = {
  title: "Delete account",
  hint: "This cannot be undone",
  body: `This removes your account and everything in it: files, jobs, credits, plan, receipts and invites. Credits are not refunded.`,
  typeLabel: "Type DELETE to confirm",
  word: "DELETE",
  password: "Current password",
  button: "Delete my account",
  deleting: "Deleting…",
} as const;

export const notifyCopy = {
  title: "Notifications",
  hint: "Each switch saves as you flip it",
  groups: { activity: "Your work", account: "Account", social: "People", news: `News from ${brand.name}` } as Record<string, string>,
  locked: "Always on",
  savedOn: (label: string) => `${label}: on.`,
  savedOff: (label: string) => `${label}: off.`,
  inbox: "Open notifications",
} as const;

export const walletCopy = {
  title: "Wallet",
  balance: "Credits",
  left: "left",
  balanceHelp: "Credits pay for every generation. They never expire.",
  plan: "Plan",
  planFree: "Free plan: no monthly credits.",
  renews: (date: string) => `Renews ${date}`,
  ends: (date: string) => `Ends ${date}, then Free`,
  changesTo: (name: string, date: string) => `Changes to ${name} on ${date}`,
  nextGrant: (amount: string, date: string) => `${amount} credits arrive ${date}`,
  perMonth: "credits a month",
  jobsAtOnce: "jobs at once",
  nextCharge: (price: string) => `Next charge ${price}`,
  changePlan: "Change plan",
  seePlans: "See plans",
  cancel: "Cancel plan",
  resume: "Keep my plan",
  packs: "Top-up credits",
  packsHint: "Added at once",
  packCredits: (n: string) => `${n} credits`,
  add: "Add",
  adding: "Adding…",
  added: (n: string) => `${n} credits added.`,
  packsClosed: "Top-ups are not open yet.",
  promo: "Promo code",
  promoPlaceholder: "Enter a code",
  promoApply: "Apply",
  promoDone: (code: string, n: string) => `${code}: ${n} credits added.`,
  usage: "Usage",
  usageHint: "Last 30 days",
  spent: "Spent",
  added30: "Added",
  generations: "Made",
  failed: "Failed",
  noUsage: "Nothing made in the last 30 days.",
  startMaking: "Start making",
  history: "History",
  historyHint: "Credits in and out",
  noHistory: "No credits have moved yet.",
  kinds: { grant: "Gift", topup: "Top-up", hold: "Running", charge: "Spent", refund: "Refund", adjust: "Change" } as Record<string, string>,
  receipts: "Receipts",
  receiptsHint: "Plan charges",
  noReceipts: "No receipts yet. They appear when a plan is charged.",
  demoReceipt: "Demo",
} as const;

export const inviteCopy = {
  title: "Invite friends",
  lead: (n: string) => `Share your link. When a friend creates an account with it, you each get ${n} credits.`,
  link: "Your invite link",
  copy: "Copy",
  copied: "Copied",
  copyFailed: "Copy did not work. Select the link and copy it by hand.",
  code: "Code",
  youGet: "You get",
  theyGet: "They get",
  perInvite: "credits per invite",
  onJoin: "credits when they join",
  sofar: "So far",
  invited: "Friends joined",
  earned: "Credits earned",
  limit: (n: number) => `Paid for up to ${n} invites.`,
  limitReached: "You have reached the invite limit. Friends still get their credits.",
  noneYet: "Nobody has joined with your link yet. Send it to a friend.",
  listNote: "Names of people you invited are kept private.",
  claim: "Have an invite code?",
  claimHint: "From someone else",
  claimPlaceholder: "Their code",
  claimButton: "Claim",
  claimed: (n: string) => `Done. ${n} credits added to you both.`,
  alreadyClaimed: "You already joined with an invite. Thanks for coming.",
  guestClaim: "Create an account to claim an invite code.",
} as const;
