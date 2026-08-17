export const locales = ["en", "hi"] as const;
export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  en: "English",
  hi: "हिन्दी",
};

// Deliberately a partial i18n rollout, not all ~100+ strings in the app —
// covers the shell (nav, chat list, composer, onboarding, landing page) as
// the architecture proof, matching the MVP-first pattern used everywhere
// else in this build. Expanding coverage is just adding keys here.
const en = {
  nav: {
    chats: "Chats",
    communities: "Communities",
    calls: "Calls",
    discover: "Discover",
    profile: "Profile",
  },
  chatList: {
    title: "Chats",
    searchPlaceholder: "Search people, chats and messages",
    emptyTitle: "Your conversations start here",
    emptyDescription: "Start a chat to see it appear in this list.",
    startNewChat: "Start a new chat",
    noMessagesYet: "No messages yet",
  },
  composer: {
    placeholder: "Message…",
    send: "Send message",
    recordVoice: "Record a voice message",
  },
  chatWindow: {
    selectConversation: "Select a conversation",
    selectConversationDescription: "Pick a chat from the list, or start a new one.",
    online: "Online",
    lastSeen: "Last seen {time}",
  },
  onboarding: {
    title: "Set up your profile",
    description: "Pick a name and username — this is how people will find and recognize you on Samva.",
    displayNameLabel: "Display name",
    usernameLabel: "Username",
    continue: "Continue",
    saving: "Saving…",
  },
  landing: {
    tagline: "Built in India. Connected everywhere.",
    heroTitle: "One place for people, teams and communities.",
    heroDescription:
      "Samva brings chat, calls and communities into a single, calm interface — fast enough for a quick reply, serious enough for real work.",
    getStarted: "Get started",
    openSamva: "Open Samva",
    startConversation: "Start a conversation",
    signIn: "Sign in",
  },
  profile: {
    signOut: "Sign out",
    manageAccount: "Manage account & active sessions",
    enableNotifications: "Enable notifications",
    turnOffNotifications: "Turn off notifications",
    enabling: "Enabling…",
    language: "Language",
    theme: "Theme",
    themeSystem: "System",
  },
};

const hi: Dictionary = {
  nav: {
    chats: "चैट",
    communities: "समुदाय",
    calls: "कॉल",
    discover: "खोजें",
    profile: "प्रोफ़ाइल",
  },
  chatList: {
    title: "चैट",
    searchPlaceholder: "लोग, चैट और संदेश खोजें",
    emptyTitle: "आपकी बातचीत यहाँ से शुरू होती है",
    emptyDescription: "इस सूची में दिखाने के लिए एक चैट शुरू करें।",
    startNewChat: "नई चैट शुरू करें",
    noMessagesYet: "अभी तक कोई संदेश नहीं",
  },
  composer: {
    placeholder: "संदेश…",
    send: "संदेश भेजें",
    recordVoice: "वॉइस संदेश रिकॉर्ड करें",
  },
  chatWindow: {
    selectConversation: "एक बातचीत चुनें",
    selectConversationDescription: "सूची से एक चैट चुनें, या नई शुरू करें।",
    online: "ऑनलाइन",
    lastSeen: "अंतिम बार {time} देखा गया",
  },
  onboarding: {
    title: "अपनी प्रोफ़ाइल सेट करें",
    description: "एक नाम और उपयोगकर्ता नाम चुनें — इसी से लोग आपको Samva पर पहचानेंगे।",
    displayNameLabel: "प्रदर्शित नाम",
    usernameLabel: "उपयोगकर्ता नाम",
    continue: "जारी रखें",
    saving: "सहेजा जा रहा है…",
  },
  landing: {
    tagline: "भारत में निर्मित। हर जगह जुड़ा हुआ।",
    heroTitle: "लोगों, टीमों और समुदायों के लिए एक जगह।",
    heroDescription:
      "Samva चैट, कॉल और समुदायों को एक शांत इंटरफ़ेस में लाता है — त्वरित जवाब के लिए तेज़, असली काम के लिए भी सक्षम।",
    getStarted: "शुरू करें",
    openSamva: "Samva खोलें",
    startConversation: "बातचीत शुरू करें",
    signIn: "साइन इन करें",
  },
  profile: {
    signOut: "साइन आउट करें",
    manageAccount: "खाता और सक्रिय सत्र प्रबंधित करें",
    enableNotifications: "सूचनाएं सक्षम करें",
    turnOffNotifications: "सूचनाएं बंद करें",
    enabling: "सक्षम किया जा रहा है…",
    language: "भाषा",
    theme: "थीम",
    themeSystem: "सिस्टम",
  },
};

export const dictionaries: Record<Locale, typeof en> = { en, hi };

export type Dictionary = typeof en;
