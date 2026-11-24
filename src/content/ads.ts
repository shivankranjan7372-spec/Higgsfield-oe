/**
 * Every word on the Ad Campaigns page (/ads). The layout comes from the design; the words are ours.
 */

export const ads = {
  title: "Ad Campaigns",
  headline: { lit: "Write a script, choose a style", plain: "we make the ad" },
  placeholder: 'Write a script or describe your ad, e.g. "a 15s spot where a sleepy runner finds our coffee"…',
  copyNote: "Starter script from your product details. Edit it before you post.",

  sidebar: {
    home: "Home",
    allMedia: "All media",
    assets: "Assets",
    brands: "Brands",
    products: "Products",
    avatars: "Avatars",
    ads: "Ads",
    drafts: "Drafts",
    noAds: "No ads yet",
    noDrafts: "No drafts yet",
    collapse: "Hide sidebar",
    expand: "Show sidebar",
    open: "Open the ads list",
    sortNewest: "Newest first",
    sortName: "By name",
    newAd: "New ad",
    guest: "You are working as a guest. Create an account to keep your ads.",
    signedOut: "Your ads and drafts show up here once you make one.",
    createAccount: "Create account",
    rename: "Rename",
    duplicate: "Duplicate",
    delete: "Delete",
    openAd: "Open",
    loadError: "Could not load your ads.",
    retry: "Try again",
  },

  chips: {
    add: "More",
    style: "Style",
    product: "Product",
    avatar: "Avatar",
    variations: (n: number) => `×${n}`,
    variationsLabel: "Versions of each style",
    draftScript: "Write a starter script",
    generate: "Make the ad",
    styles: (n: number) => `${n} styles`,
  },

  pickers: {
    styleTitle: "Choose styles",
    styleHint: "Pick one or more. Each style makes its own ad.",
    offline: "Offline",
    productTitle: "Your products",
    noProducts: "No products yet. Add one with a name and a few pictures.",
    newProduct: "New product",
    avatarTitle: "Presenter",
    avatarHint: "A clear photo of one person. Used by talking styles.",
    noAvatars: "No photos yet. Upload one to use as a presenter.",
    upload: "Upload a photo",
    uploading: "Uploading…",
    none: "None",
    perAd: "per ad",
    loading: "Loading…",
  },

  product: {
    title: "New product",
    editTitle: "Edit product",
    name: "Name",
    namePlaceholder: "Ember Candle",
    description: "What it is",
    descriptionPlaceholder: "A soy candle that smells like a campfire",
    benefits: "Key benefits, one per line",
    benefitsPlaceholder: "Burns for 60 hours\nClean soy wax",
    audience: "Who it is for",
    price: "Price",
    link: "Link",
    brand: "Brand",
    noBrand: "No brand",
    pictures: "Pictures",
    addPictures: "Add pictures",
    save: "Save product",
    saving: "Saving…",
  },

  brand: {
    title: "Brands",
    hint: "A brand sets the tone and the words your ads use.",
    name: "Brand name",
    tone: "Tone of voice",
    tonePlaceholder: "Warm and playful",
    use: "Words to use, comma separated",
    avoid: "Words to avoid, comma separated",
    add: "Add brand",
    empty: "No brands yet.",
  },

  productsDialog: { title: "Products", hint: "The things you advertise. Pictures guide every ad." },
  avatarsDialog: { title: "Avatars", hint: "Photos of people who can present your ads." },

  player: {
    idle: "Your ad plays here",
    idleHint: "Pick a product and a style, then press the lime button.",
    previous: "Previous ad",
    next: "Next ad",
    off: "Clear the screen",
    mute: "Sound off",
    unmute: "Sound on",
    inLine: "In line",
    making: "Making your ad",
    failed: "This one did not work.",
    refunded: "Your credits are back in your balance.",
    of: (i: number, n: number) => `${i} of ${n}`,
    badge: "Ad Campaigns",
    win: "Mark as a winner",
    unwin: "No longer a winner",
  },

  actions: {
    variation: "Make a variation",
    download: "Download",
    howItWorks: "How it works",
    draftScript: "Write a script",
  },

  how: {
    title: "How it works",
    steps: [
      { title: "Add a product", body: "Give it a name, a line on what it is and a few pictures. Pictures guide every ad." },
      { title: "Choose a style", body: "Each style is a fixed recipe: a hero shot, a short clip, a talking presenter or a voice spot. Its price is known before you start." },
      { title: "Write the script", body: "Type your own words, or let us write a starter script from your product details. Talking styles read it out." },
      { title: "Make it", body: "Press the lime button. Your ads appear on the screen as they finish. Make a variation of any you like." },
    ],
  },

  trending: { title: "Start from a style", choose: "Use this style", loadError: "Could not load the styles." },

  /** Starter words for a style chosen from the tiles, when the script box is empty. */
  starter: {
    spoken: "Open on the product in someone's hand. They tell a friend why it changed their week, then show it in use. End on the name and one reason to try it.",
    video: "A short clip of the product in its best light. Slow move in, one moment of use, end on the product alone.",
    image: "The product on its own, clean light, room for a headline.",
  },

  errors: {
    needProduct: "Pick a product first.",
    needStyle: "Choose a style first.",
    needPresenter: "This style needs a presenter photo. Pick one under Avatar.",
  },

  untitled: "Untitled ad",
  status: { draft: "Draft", running: "Making", done: "Ready" },
};
