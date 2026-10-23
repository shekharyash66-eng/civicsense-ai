/**
 * CivicFix Speech Recognition Service
 * Wraps the browser's native SpeechRecognition (or webkitSpeechRecognition) API
 * with clean event handling, robust error mapping, and language selection.
 */

export interface SpeechRecognitionResultPayload {
  finalTranscript: string;
  interimTranscript: string;
  rawText: string;
  isFinal: boolean;
}

export interface SpeechLanguageOption {
  code: string;
  label: string;
  nativeLabel: string;
}

export const SUPPORTED_SPEECH_LANGUAGES: SpeechLanguageOption[] = [
  { code: "en-IN", label: "English (India)", nativeLabel: "English (India)" },
  { code: "hi-IN", label: "Hindi (India)", nativeLabel: "हिन्दी" },
  { code: "en-US", label: "English (US)", nativeLabel: "English (US)" },
  { code: "en-GB", label: "English (UK)", nativeLabel: "English (UK)" },
];

export const DEFAULT_SPEECH_LANGUAGE = "en-IN";

export type SpeechErrorCode =
  | "not-allowed"
  | "service-not-allowed"
  | "no-speech"
  | "audio-capture"
  | "network"
  | "aborted"
  | "language-not-supported"
  | "unsupported-browser"
  | "unknown";

export interface SpeechError {
  code: SpeechErrorCode;
  message: string;
  rawError?: any;
}

export function mapSpeechError(errCode: string): SpeechError {
  switch (errCode) {
    case "not-allowed":
      return {
        code: "not-allowed",
        message:
          "Microphone access was denied. Please allow microphone access in your browser settings to use voice input.",
      };
    case "service-not-allowed":
      return {
        code: "service-not-allowed",
        message:
          "Speech recognition service is not permitted by your browser or network settings.",
      };
    case "no-speech":
      return {
        code: "no-speech",
        message: "I didn't hear anything. Please try speaking again.",
      };
    case "audio-capture":
      return {
        code: "audio-capture",
        message:
          "I couldn't access your microphone. Please check your microphone connection and try again.",
      };
    case "network":
      return {
        code: "network",
        message:
          "Voice recognition is temporarily unavailable due to a network issue. Please try again or use text input.",
      };
    case "aborted":
      return {
        code: "aborted",
        message: "Voice input was stopped.",
      };
    case "language-not-supported":
      return {
        code: "language-not-supported",
        message: "The selected language is not supported by your browser voice engine.",
      };
    default:
      return {
        code: "unknown",
        message: "An unexpected voice recognition error occurred. Please try again.",
      };
  }
}

export class SpeechRecognitionService {
  private recognition: any = null;
  private isListening: boolean = false;
  private currentLanguage: string = DEFAULT_SPEECH_LANGUAGE;

  private onStartCallback: (() => void) | null = null;
  private onResultCallback: ((payload: SpeechRecognitionResultPayload) => void) | null = null;
  private onErrorCallback: ((error: SpeechError) => void) | null = null;
  private onEndCallback: (() => void) | null = null;

  constructor() {
    this.initRecognition();
  }

  public isSupported(): boolean {
    if (typeof window === "undefined") return false;
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  private initRecognition() {
    if (!this.isSupported()) return;
    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.currentLanguage;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.onStartCallback?.();
      };

      this.recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcriptChunk = result[0]?.transcript || "";
          if (result.isFinal) {
            final += transcriptChunk;
          } else {
            interim += transcriptChunk;
          }
        }

        const isFinal = Boolean(final && !interim);

        this.onResultCallback?.({
          finalTranscript: final,
          interimTranscript: interim,
          rawText: (final + " " + interim).trim(),
          isFinal,
        });
      };

      this.recognition.onerror = (event: any) => {
        const errorDetails = mapSpeechError(event.error);
        // Ignore silent abort errors initiated by user stop
        if (event.error === "aborted") {
          this.isListening = false;
          return;
        }
        this.isListening = false;
        this.onErrorCallback?.({ ...errorDetails, rawError: event });
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.onEndCallback?.();
      };
    } catch (err) {
      console.warn("[SpeechRecognition] Initialization failed:", err);
    }
  }

  public setLanguage(langCode: string) {
    this.currentLanguage = langCode;
    if (this.recognition) {
      this.recognition.lang = langCode;
    }
  }

  public getLanguage(): string {
    return this.currentLanguage;
  }

  public start(lang?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isSupported()) {
        const err: SpeechError = {
          code: "unsupported-browser",
          message:
            "Voice input isn't supported in this browser. Please use text input or try Google Chrome, Edge, or Safari.",
        };
        this.onErrorCallback?.(err);
        return reject(err);
      }

      if (lang) {
        this.setLanguage(lang);
      }

      try {
        if (!this.recognition) {
          this.initRecognition();
        }

        if (this.isListening) {
          this.stop();
        }

        this.recognition.start();
        resolve();
      } catch (err: any) {
        // Recognition might already be active or permission denied
        if (err.name === "InvalidStateError") {
          // Already started, safely ignore
          resolve();
          return;
        }
        const mapped = mapSpeechError(err.name || "unknown");
        this.onErrorCallback?.(mapped);
        reject(mapped);
      }
    });
  }

  public stop() {
    if (!this.recognition) return;
    try {
      this.isListening = false;
      this.recognition.stop();
    } catch (err) {
      console.warn("[SpeechRecognition] Stop error:", err);
    }
  }

  public abort() {
    if (!this.recognition) return;
    try {
      this.isListening = false;
      this.recognition.abort();
    } catch (err) {
      console.warn("[SpeechRecognition] Abort error:", err);
    }
  }

  public getListeningState(): boolean {
    return this.isListening;
  }

  public onStart(callback: () => void) {
    this.onStartCallback = callback;
  }

  public onResult(callback: (payload: SpeechRecognitionResultPayload) => void) {
    this.onResultCallback = callback;
  }

  public onError(callback: (error: SpeechError) => void) {
    this.onErrorCallback = callback;
  }

  public onEnd(callback: () => void) {
    this.onEndCallback = callback;
  }

  public cleanup() {
    this.abort();
    this.onStartCallback = null;
    this.onResultCallback = null;
    this.onErrorCallback = null;
    this.onEndCallback = null;
  }
}

export const speechService = new SpeechRecognitionService();
