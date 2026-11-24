/** Every word on the Audio page, in one place. */

export type AudioSurface = "speech" | "music";

export const audioTabs: { surface: AudioSurface; label: string }[] = [
  { surface: "speech", label: "Text to Speech" },
  { surface: "music", label: "Music" },
];

export const audioCopy = {
  speech: {
    scriptLabel: "Script",
    scriptHint: "Write exactly what the voice should say. Punctuation sets the pauses.",
    scriptInfo: "Every character is read aloud. The price follows the length of the script.",
    hero: {
      title: "Give any script a voice",
      lead: "Natural speech from your own words, ready to drop into a project",
      cards: [
        { title: "Choose a voice", body: "Pick a model, then a voice, a mood and a pace", art: "audio/speech-voices" },
        { title: "Write and generate", body: "Paste your script, set the details and press Generate", art: "audio/speech-settings" },
      ],
    },
  },
  music: {
    scriptLabel: "Describe the track",
    scriptHint: "Genre, mood, instruments, tempo. Add lyrics in the settings below.",
    scriptInfo: "Say what it should sound like. Turn Instrumental off to add a voice and words.",
    hero: {
      title: "Score your next idea",
      lead: "Describe a sound and get a finished track in under a minute",
      cards: [
        { title: "Describe the sound", body: "Name a genre, a mood and the instruments you hear", art: "audio/music-describe" },
        { title: "Add words or keep it pure", body: "Write your own lyrics, or leave the track instrumental", art: "audio/music-lyrics" },
      ],
    },
  },
  model: "Model",
  batch: "Batch size",
  optional: "Optional",
  advanced: "Advanced settings",
  generate: "Generate",
  history: "History",
  howItWorks: "How it works",
  filters: "Filters",
  filterAll: "Everything",
  filterFavorites: "Favourites",
  filterSpeech: "Speech only",
  filterMusic: "Music only",
  noFavorites: "Nothing marked as a favourite yet.",
  noMatches: "Nothing here for this filter.",
  showAll: "Show everything",
  listLabel: "Your audio",
  queued: "In line",
  running: "Making it",
  failedNote: "Your credits are back in your balance.",
  failedFallback: "This one did not work.",
  tryAgain: "Try it again",
  useAgain: "Use these settings",
  download: "Download",
  favorite: "Add to favourites",
  unfavorite: "Remove from favourites",
  remove: "Remove",
  cancel: "Cancel",
  removeTitle: "Remove this track?",
  removeBody: "The file is deleted for good and cannot come back. Credits spent on it are not returned.",
  removeConfirm: "Remove for good",
  keep: "Keep it",
  play: "Play",
  pause: "Pause",
  seek: "Position",
  noResult: "The model sent nothing back. Your credits for it were returned.",
  guestNote: "You are trying Parallax as a guest. Create an account to keep what you make.",
  visitorNote: "Write a script and press Generate to hear it. Sign in to see your history.",
  createAccount: "Create account",
  signIn: "Sign in",
  dismiss: "Dismiss",
  needAccount: "Create an account to keep going.",
} as const;
