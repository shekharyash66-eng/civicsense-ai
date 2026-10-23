import { useState, useCallback, useEffect } from "react";
import { ttsService } from "../services/textToSpeechService";

export function useTextToSpeech(defaultLang: string = "en-IN") {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      ttsService.stop();
    };
  }, []);

  const speak = useCallback(
    (text: string, messageId?: string, lang?: string) => {
      if (isSpeaking && speakingMessageId === messageId) {
        ttsService.stop();
        setIsSpeaking(false);
        setSpeakingMessageId(null);
        return;
      }

      ttsService.stop();
      setIsSpeaking(true);
      if (messageId) {
        setSpeakingMessageId(messageId);
      }

      ttsService.speak(text, {
        lang: lang || defaultLang,
        onStart: () => {
          setIsSpeaking(true);
        },
        onEnd: () => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
        },
        onError: () => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
        },
      });
    },
    [defaultLang, isSpeaking, speakingMessageId]
  );

  const stop = useCallback(() => {
    ttsService.stop();
    setIsSpeaking(false);
    setSpeakingMessageId(null);
  }, []);

  return {
    isSupported: ttsService.isSupported(),
    isSpeaking,
    speakingMessageId,
    speak,
    stop,
  };
}
