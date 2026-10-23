import { useState, useEffect, useCallback, useRef } from "react";
import {
  SpeechRecognitionService,
  SpeechError,
  DEFAULT_SPEECH_LANGUAGE,
} from "../services/speechRecognitionService";

export type VoiceState =
  | "idle"
  | "requesting_permission"
  | "listening"
  | "processing"
  | "error";

interface UseSpeechRecognitionOptions {
  defaultLanguage?: string;
  onSessionTranscriptUpdate?: (sessionTranscript: string) => void;
  onError?: (error: SpeechError) => void;
}

export function useSpeechRecognition({
  defaultLanguage = DEFAULT_SPEECH_LANGUAGE,
  onSessionTranscriptUpdate,
  onError,
}: UseSpeechRecognitionOptions = {}) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [error, setError] = useState<SpeechError | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(defaultLanguage);

  const serviceRef = useRef<SpeechRecognitionService | null>(null);
  const onUpdateCallbackRef = useRef(onSessionTranscriptUpdate);
  const onErrorCallbackRef = useRef(onError);

  onUpdateCallbackRef.current = onSessionTranscriptUpdate;
  onErrorCallbackRef.current = onError;

  // Initialize service on mount
  useEffect(() => {
    const service = new SpeechRecognitionService();
    serviceRef.current = service;
    setIsSupported(service.isSupported());
    service.setLanguage(selectedLanguage);

    service.onStart(() => {
      setVoiceState("listening");
      setError(null);
    });

    service.onResult((payload) => {
      setInterimTranscript(payload.interimTranscript || "");

      if (payload.finalTranscript) {
        setTranscript((prev) => {
          const updated = prev
            ? `${prev} ${payload.finalTranscript.trim()}`
            : payload.finalTranscript.trim();
          onUpdateCallbackRef.current?.(updated);
          return updated;
        });
      }
    });

    service.onError((speechErr) => {
      setVoiceState("error");
      setError(speechErr);
      setInterimTranscript("");
      onErrorCallbackRef.current?.(speechErr);
    });

    service.onEnd(() => {
      setVoiceState((current) => (current === "listening" ? "idle" : current));
      setInterimTranscript("");
    });

    return () => {
      service.cleanup();
      serviceRef.current = null;
    };
  }, []);

  // Update language if selectedLanguage changes
  const setLanguage = useCallback((langCode: string) => {
    setSelectedLanguage(langCode);
    serviceRef.current?.setLanguage(langCode);
  }, []);

  // Start listening
  const startListening = useCallback(async () => {
    if (!serviceRef.current) return;
    setError(null);
    setTranscript("");
    setInterimTranscript("");
    setVoiceState("requesting_permission");

    // Pre-check microphone permission with mediaDevices if available
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          // Release immediately; speech recognition will manage its own audio track
          stream.getTracks().forEach((track) => track.stop());
        } catch (permErr: any) {
          if (permErr.name === "NotAllowedError" || permErr.name === "PermissionDeniedError") {
            const deniedError: SpeechError = {
              code: "not-allowed",
              message:
                "Microphone access was denied. Please allow microphone access in your browser settings to use voice input.",
            };
            setError(deniedError);
            setVoiceState("error");
            onErrorCallbackRef.current?.(deniedError);
            return;
          }
        }
      }

      await serviceRef.current.start(selectedLanguage);
    } catch (err: any) {
      setVoiceState("error");
      const speechErr: SpeechError = err.code
        ? err
        : {
            code: "unknown",
            message: "Could not start voice recognition. Please try again.",
          };
      setError(speechErr);
      onErrorCallbackRef.current?.(speechErr);
    }
  }, [selectedLanguage]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (!serviceRef.current) return;
    setVoiceState("processing");
    serviceRef.current.stop();
    setTimeout(() => {
      setVoiceState("idle");
    }, 250);
  }, []);

  // Clear accumulated transcript
  const clearTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  // Reset error
  const clearError = useCallback(() => {
    setError(null);
    if (voiceState === "error") {
      setVoiceState("idle");
    }
  }, [voiceState]);

  return {
    isSupported,
    isListening: voiceState === "listening",
    voiceState,
    transcript,
    interimTranscript,
    error,
    selectedLanguage,
    setLanguage,
    startListening,
    stopListening,
    clearTranscript,
    clearError,
  };
}
