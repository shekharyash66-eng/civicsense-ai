/**
 * CivicFix Text-to-Speech Service
 * Reads AI responses aloud using browser native SpeechSynthesis API
 * Cleanly strips markdown, asterisks, bullet marks, and UI action tags before voicing.
 */

export function cleanMarkdownForSpeech(text: string): string {
  if (!text) return "";

  let cleaned = text;

  // 1. Remove code blocks
  cleaned = cleaned.replace(/```[\s\S]*?```/g, "");
  cleaned = cleaned.replace(/`([^`]+)`/g, "$1");

  // 2. Remove markdown links [title](url) -> title
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");

  // 3. Remove bold / italics asterisks and underscores
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1");
  cleaned = cleaned.replace(/\*([^*]+)\*/g, "$1");
  cleaned = cleaned.replace(/__([^_]+)__/g, "$1");
  cleaned = cleaned.replace(/_([^_]+)_/g, "$1");

  // 4. Remove headings #, ##, ###
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, "");

  // 5. Replace bullet points • or - with a brief pause / clean punctuation
  cleaned = cleaned.replace(/^\s*[•\-*]\s+/gm, ". ");

  // 6. Remove emojis and special non-speech symbols
  cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "");

  // 7. Compact multiple whitespace / dots
  cleaned = cleaned.replace(/\.{2,}/g, ".");
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}

export interface SpeakOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

export class TextToSpeechService {
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  public isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  public isSpeaking(): boolean {
    if (!this.isSupported()) return false;
    return window.speechSynthesis.speaking;
  }

  public stop() {
    if (!this.isSupported()) return;
    try {
      window.speechSynthesis.cancel();
      this.currentUtterance = null;
    } catch (err) {
      console.warn("[TextToSpeech] Cancel error:", err);
    }
  }

  public pause() {
    if (!this.isSupported()) return;
    window.speechSynthesis.pause();
  }

  public resume() {
    if (!this.isSupported()) return;
    window.speechSynthesis.resume();
  }

  public speak(rawText: string, options: SpeakOptions = {}): boolean {
    if (!this.isSupported()) return false;

    // Cancel any ongoing speech first
    this.stop();

    const spokenText = cleanMarkdownForSpeech(rawText);
    if (!spokenText) return false;

    try {
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.lang = options.lang || "en-IN";
      utterance.rate = options.rate ?? 1.0;
      utterance.pitch = options.pitch ?? 1.0;

      // Select natural voice if available
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const langCode = (options.lang || "en-IN").toLowerCase();
        const preferredVoice =
          voices.find((v) => v.lang.toLowerCase() === langCode) ||
          voices.find((v) => v.lang.toLowerCase().startsWith(langCode.split("-")[0])) ||
          voices.find((v) => v.default);
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
      }

      utterance.onstart = () => {
        options.onStart?.();
      };

      utterance.onend = () => {
        this.currentUtterance = null;
        options.onEnd?.();
      };

      utterance.onerror = (event) => {
        this.currentUtterance = null;
        // Ignore canceled / interrupted speech events
        if (event.error === "canceled" || event.error === "interrupted") {
          return;
        }
        console.warn("[TextToSpeech] Speech error:", event);
        options.onError?.(event);
      };

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (err) {
      console.warn("[TextToSpeech] Failed to speak:", err);
      options.onError?.(err);
      return false;
    }
  }
}

export const ttsService = new TextToSpeechService();
