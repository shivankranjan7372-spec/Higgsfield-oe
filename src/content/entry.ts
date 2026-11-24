/**
 * The words of the entry screens: the sign-in window, search, notifications and "What's new".
 * Layout and style come from the design; every word here is ours.
 */
import { brand } from "@/config/brand";

export const loginCopy = {
  join: {
    title: "Create your account",
    headline: "Start making",
    submit: "Create account",
    busy: "Creating account…",
    switchPrompt: "Already have an account?",
    switchLabel: "Log in instead",
  },
  login: {
    title: "Log in",
    headline: "Welcome back",
    submit: "Log in",
    busy: "Logging in…",
    switchPrompt: "New here?",
    switchLabel: "Create an account",
  },
  withWord: { join: "with", login: "to" },
  brandName: brand.name,
  email: "Email",
  password: "Password",
  passwordHintJoin: "Password (8+ characters)",
  showPassword: "Show password",
  hidePassword: "Hide password",
  divider: "or",
  /** Shown to a guest who has already made something. */
  guestKeep: "Creating an account keeps everything you made as a guest.",
  guestLose: "Logging in to another account leaves your guest work behind.",
  /** Shown to everyone else on the join side. */
  joinPerk: "New accounts start with free credits",
  smallPrint: `By continuing, you agree to the ${brand.name} terms and confirm that you are at least 18 years old.`,
  signedInAs: (name: string) => `You are signed in as ${name}.`,
  pageDone: "Continue",
};

export const searchCopy = {
  title: "Search",
  placeholder: "Search models, files and posts",
  close: "Close search",
  clear: "Clear",
  tabsLabel: "Search in",
  recents: "Recent searches",
  recentSubtitle: "Searched before",
  clearRecents: "Clear all",
  removeRecent: (q: string) => `Remove “${q}” from recent searches`,
  popular: "Popular models",
  seeAll: "See all",
  yourFiles: "Your latest files",
  jumpTo: "Jump to",
  commands: "Commands",
  noResults: (q: string) => `Nothing matches “${q}”.`,
  noResultsHint: "Try a shorter word, a model name or a maker.",
  groupEmpty: "No results here.",
  error: "Search is not answering right now.",
  retry: "Try again",
  showAll: (q: string) => `See all results for “${q}”`,
  pageTitle: "Search",
  pageEmpty: "Type a word to look through models, your files, generations, folders and public posts.",
  loadMore: "Show more",
  signedOutNote: "Sign in to search your own files, generations and folders.",
  signIn: "Log in",
  hints: { move: "to move", open: "to open", close: "to close" },
};

/** The tabs of search, in the order the API returns groups. */
export const searchTabs = [
  { id: "all", label: "All" },
  { id: "models", label: "Models" },
  { id: "files", label: "Your files" },
  { id: "generations", label: "Generations" },
  { id: "folders", label: "Folders" },
  { id: "posts", label: "Posts" },
] as const;

export type SearchTab = (typeof searchTabs)[number]["id"];

export const notifyCopy = {
  title: "Notifications",
  intro: "What happened with your work and your account.",
  filtersLabel: "Show",
  filters: [
    { id: "all", label: "All", kinds: null, unread: false },
    { id: "unread", label: "Unread", kinds: null, unread: true },
    { id: "activity", label: "Generations", kinds: "generation_done,generation_failed", unread: false },
    { id: "account", label: "Account", kinds: "credits_low,plan,system", unread: false },
    { id: "social", label: "Social", kinds: "like,comment,follow", unread: false },
    { id: "news", label: "News", kinds: "announcement", unread: false },
  ],
  markAll: "Mark all read",
  markRead: "Mark read",
  markUnread: "Mark unread",
  remove: "Delete",
  open: "Open",
  empty: "Nothing here yet. Notices about your generations and your account will show up here.",
  emptyFiltered: "No notices match this filter.",
  emptyAction: "Make something",
  error: "Notifications did not load.",
  retry: "Try again",
  loadMore: "Show older",
  unreadCount: (n: number) => (n === 1 ? "1 unread" : `${n} unread`),
  live: "Live",
  prefsTitle: "What to tell me about",
  prefsIntro: "Muted kinds are not created at all.",
  locked: "Always on",
  groups: { activity: "Generations", account: "Account", social: "Social", news: "News" } as Record<string, string>,
  signedOutTitle: "Sign in to see your notifications",
  signedOutBody: "When a generation finishes or your credits run low, you will hear about it here.",
  signIn: "Log in",
  join: "Create account",
  whatsNew: "What's new",
};

export const whatsNewCopy = {
  title: "What's new",
  intro: `Changes to ${brand.name}, newest first.`,
  markSeen: "Mark all seen",
  allSeen: "All caught up",
  unseen: (n: number) => (n === 1 ? "1 new" : `${n} new`),
  empty: "No release notes yet.",
  error: "Release notes did not load.",
  retry: "Try again",
  tags: { new: "New", improved: "Improved", fixed: "Fixed" } as Record<string, string>,
  open: "Take a look",
  signedOutNote: "Sign in to keep track of what you have already read.",
};
