/** Speech and music models. Prices come from the Treg catalog and are never written here. */
import { opt, select, slider, text, toggle } from "./helpers";
import type { ModelDef, Option } from "./types";

const SCRIPT = { required: true, maxLength: 5000, label: "Script", placeholder: "Type what the voice should say." };

/* -------------------------------------------------------------------------- */
/* MiniMax Speech 2.8                                                          */
/* -------------------------------------------------------------------------- */

/** Voice ids checked against the live API. Labels are our own. */
const MINIMAX_VOICES: Option[] = [
  opt("English_expressive_narrator", "Narrator", { hint: "Expressive, documentary" }),
  opt("English_CaptivatingStoryteller", "Storyteller", { hint: "Warm, unhurried" }),
  opt("English_Trustworth_Man", "Anchor", { hint: "Steady, trustworthy" }),
  opt("English_magnetic_voiced_man", "Baritone", { hint: "Rich, magnetic" }),
  opt("English_ManWithDeepVoice", "Deep", { hint: "Low and resonant" }),
  opt("English_Deep-VoicedGentleman", "Gentleman", { hint: "Deep, formal" }),
  opt("English_Gentle-voiced_man", "Gentle", { hint: "Soft-spoken man" }),
  opt("English_Steadymentor", "Mentor", { hint: "Calm, instructive" }),
  opt("English_Diligent_Man", "Explainer", { hint: "Clear, precise" }),
  opt("English_Aussie_Bloke", "Aussie", { hint: "Relaxed Australian" }),
  opt("English_FriendlyPerson", "Friendly", { hint: "Easygoing, casual" }),
  opt("English_radiant_girl", "Radiant", { hint: "Bright, youthful" }),
  opt("English_Upbeat_Woman", "Upbeat", { hint: "Energetic, promotional" }),
  opt("English_ConfidentWoman", "Confident", { hint: "Assured, direct" }),
  opt("English_compelling_lady1", "Compelling", { hint: "Persuasive, polished" }),
  opt("English_captivating_female1", "Captivating", { hint: "Smooth, engaging" }),
  opt("English_Graceful_Lady", "Graceful", { hint: "Elegant, measured" }),
  opt("English_CalmWoman", "Calm", { hint: "Soothing, even" }),
  opt("English_SereneWoman", "Serene", { hint: "Quiet, meditative" }),
  opt("English_Wiselady", "Wise", { hint: "Mature, thoughtful" }),
  opt("English_PlayfulGirl", "Playful", { hint: "Light, animated" }),
  opt("English_Whispering_girl", "Whisper", { hint: "Close, hushed" }),
];

const EMOTIONS: Option[] = [
  opt("auto", "Auto"),
  opt("calm", "Calm"),
  opt("happy", "Happy"),
  opt("sad", "Sad"),
  opt("angry", "Angry"),
  opt("surprised", "Surprised"),
  opt("fearful", "Fearful"),
  opt("disgusted", "Disgusted"),
];

function minimaxSpeech(id: string, model: string, endpoint: string, name: string, tagline: string, featured: boolean): ModelDef {
  return {
    id,
    kind: "audio",
    name,
    vendor: "MiniMax",
    tagline,
    featured,
    badges: featured ? ["HD"] : ["Fast"],
    status: "available",
    surfaces: ["speech"],
    prompt: SCRIPT,
    slots: [],
    controls: [
      select("voice", "Voice", MINIMAX_VOICES, "English_expressive_narrator", { display: "menu" }),
      select("emotion", "Emotion", EMOTIONS, "auto", { display: "menu" }),
      slider("speed", "Speed", 0.5, 2, 0.1, 1, { unit: "x" }),
      slider("pitch", "Pitch", -12, 12, 1, 0, { advanced: true }),
    ],
    batch: { max: 1, native: false },
    output: "audio",
    eta: 8,
    build({ prompt, values }) {
      const voice: Record<string, unknown> = { voice_id: values.voice, speed: Number(values.speed), vol: 1, pitch: Number(values.pitch ?? 0) };
      if (values.emotion && values.emotion !== "auto") voice.emotion = values.emotion;
      return {
        endpoint,
        body: {
          model,
          text: prompt,
          stream: false,
          output_format: "url",
          voice_setting: voice,
          audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 },
        },
      };
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Gemini TTS                                                                  */
/* -------------------------------------------------------------------------- */

const GEMINI_VOICES = [
  "Kore", "Puck", "Zephyr", "Charon", "Fenrir", "Leda", "Orus", "Aoede", "Callirrhoe", "Autonoe",
  "Enceladus", "Iapetus", "Umbriel", "Algieba", "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar",
  "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi", "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat",
];

function geminiSpeech(id: string, model: string, endpoint: string, name: string, tagline: string): ModelDef {
  return {
    id,
    kind: "audio",
    name,
    vendor: "Google",
    tagline,
    badges: ["Flat price"],
    status: "available",
    surfaces: ["speech"],
    prompt: { ...SCRIPT, maxLength: 3000 },
    slots: [],
    controls: [
      select("voice", "Voice", GEMINI_VOICES, "Kore", { display: "menu" }),
      text("style", "Delivery", 200, { placeholder: "cheerful, slow, like a bedtime story", hint: "A direction for the voice. It is not spoken." }),
    ],
    batch: { max: 1, native: false },
    output: "audio",
    eta: 12,
    build({ prompt, values }) {
      const part: Record<string, unknown> = { text: prompt };
      const style = String(values.style ?? "").trim();
      if (style) part.speechMetadata = { style };
      return {
        endpoint,
        query: { model },
        body: {
          contents: [{ parts: [part] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: values.voice } } },
          },
        },
      };
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Fish Audio                                                                  */
/* -------------------------------------------------------------------------- */

const fishSpeech: ModelDef = {
  id: "fish-s2.1-pro",
  kind: "audio",
  name: "Fish S2.1 Pro",
  vendor: "Fish Audio",
  tagline: "Natural, conversational reads priced by the byte.",
  status: "available",
  surfaces: ["speech"],
  prompt: SCRIPT,
  slots: [],
  controls: [
    slider("speed", "Speed", 0.5, 2, 0.1, 1, { unit: "x" }),
    slider("variation", "Variation", 0, 1, 0.1, 0.7, { hint: "Higher takes more liberties with the read.", advanced: true }),
  ],
  batch: { max: 1, native: false },
  output: "audio",
  eta: 8,
  build({ prompt, values }) {
    return {
      endpoint: "fishaudio.tts.s2-1-pro",
      // Fish Audio picks the voice model from a header, not the body.
      headers: { model: "s2.1-pro" },
      body: {
        text: prompt,
        format: "mp3",
        mp3_bitrate: 128,
        temperature: Number(values.variation ?? 0.7),
        prosody: { speed: Number(values.speed), volume: 0 },
      },
    };
  },
};

/* -------------------------------------------------------------------------- */
/* Music                                                                       */
/* -------------------------------------------------------------------------- */

function lyria(id: string, model: string, endpoint: string, name: string, tagline: string, featured: boolean, eta: number): ModelDef {
  return {
    id,
    kind: "music",
    name,
    vendor: "Google",
    tagline,
    featured,
    badges: ["Flat price"],
    status: "available",
    surfaces: ["music"],
    prompt: { required: true, maxLength: 2000, label: "Describe the track", placeholder: "Genre, mood, instruments, tempo." },
    slots: [],
    controls: [
      toggle("instrumental", "Instrumental", true, { hint: "No vocals." }),
      text("lyrics", "Lyrics", 1500, { placeholder: "Write the words to sing, or leave empty and let the model write them.", when: { instrumental: false } }),
    ],
    batch: { max: 2, native: false },
    output: "audio",
    eta,
    build({ prompt, values }) {
      const lyrics = String(values.lyrics ?? "").trim();
      const brief = values.instrumental
        ? `${prompt}\n\nInstrumental only. No vocals.`
        : lyrics
          ? `${prompt}\n\nLyrics:\n${lyrics}`
          : `${prompt}\n\nWith vocals.`;
      return { endpoint, query: { model }, body: { contents: [{ parts: [{ text: brief }] }] } };
    },
  };
}

export const speechModels: ModelDef[] = [
  minimaxSpeech("minimax-speech-2.8-hd", "speech-2.8-hd", "minimax.voice-gen.speech-2-8-hd", "Speech 2.8 HD", "Studio-quality voices with emotion control.", true),
  minimaxSpeech("minimax-speech-2.8-turbo", "speech-2.8-turbo", "minimax.voice-gen.speech-2-8-turbo", "Speech 2.8 Turbo", "The same voices, faster and cheaper.", false),
  geminiSpeech("gemini-tts", "gemini-3.8-flash-tts", "google-ai.voice-gen.gemini-3-8-flash-tts", "Gemini 3.8 TTS", "Thirty voices you direct in plain words."),
  geminiSpeech("gemini-tts-lite", "gemini-3.8-flash-lite-tts", "google-ai.voice-gen.gemini-3-8-flash-lite-tts", "Gemini 3.8 TTS Lite", "The lighter Gemini voice model."),
  fishSpeech,
];

export const musicModels: ModelDef[] = [
  lyria("lyria-3.5", "lyria-3.5", "google-ai.music-gen.lyria-3-5", "Lyria 3.5", "Full songs with or without vocals.", true, 45),
  lyria("lyria-3-clip", "lyria-3-clip-preview", "google-ai.music-gen.lyria-3-clip", "Lyria 3 Clip", "Short cues and loops at half the price.", false, 25),
];
