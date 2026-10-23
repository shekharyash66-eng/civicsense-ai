import React, { useState, useRef, useEffect } from "react";
import {
  User,
  Complaint,
  AssistantMessage,
  AssistantAppContext,
  AssistantActionButton,
  ComplaintDraftInput,
  IssueCategory,
  MunicipalDepartment,
  ComplaintPriority,
} from "../../types";
import { civicFixAI, fileToBase64 } from "../../services/civicFixAssistantService";
import {
  SUPPORTED_SPEECH_LANGUAGES,
  DEFAULT_SPEECH_LANGUAGE,
} from "../../services/speechRecognitionService";
import { useSpeechRecognition, VoiceState } from "../../hooks/useSpeechRecognition";
import { useTextToSpeech } from "../../hooks/useTextToSpeech";
import { StatusBadge, PriorityBadge } from "../ui/StatusBadge";
import {
  Bot,
  Send,
  Paperclip,
  Mic,
  MicOff,
  X,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Maximize2,
  Minimize2,
  ExternalLink,
  MapPin,
  CheckCircle,
  Building2,
  AlertTriangle,
  Clock,
  ChevronRight,
  Image as ImageIcon,
  Volume2,
  VolumeX,
  Square,
  Globe,
  Loader2,
} from "lucide-react";

interface CivicFixAssistantChatProps {
  currentUser: User;
  activeRoute: string;
  selectedComplaintId?: string;
  complaints: Complaint[];
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (route: string) => void;
  onStartComplaintDraft: (draft: ComplaintDraftInput) => void;
  onSelectComplaint: (id: string) => void;
}

const INITIAL_PROMPTS = [
  "How do I report an issue?",
  "Track my complaint",
  "What does In Progress mean?",
  "Which department handles potholes?",
  "What can CivicFix do?",
];

export const CivicFixAssistantChat: React.FC<CivicFixAssistantChatProps> = ({
  currentUser,
  activeRoute,
  selectedComplaintId,
  complaints,
  isOpen,
  onClose,
  onNavigate,
  onStartComplaintDraft,
  onSelectComplaint,
}) => {
  const [messages, setMessages] = useState<AssistantMessage[]>(() => [
    {
      id: "welcome-1",
      sender: "ai",
      text: "Hi! I'm the **CivicFix Assistant** 👋\n\nI can help you report civic issues, understand complaint statuses, find the right department, and track your repairs.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoReadVoice, setAutoReadVoice] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const baseInputRef = useRef<string>("");

  // Speech Recognition hook
  const {
    isSupported: isSpeechSupported,
    isListening,
    voiceState,
    interimTranscript,
    error: speechError,
    selectedLanguage,
    setLanguage: setSelectedLanguage,
    startListening,
    stopListening,
    clearError: clearSpeechError,
  } = useSpeechRecognition({
    defaultLanguage: DEFAULT_SPEECH_LANGUAGE,
    onSessionTranscriptUpdate: (sessionText) => {
      const base = baseInputRef.current;
      if (!base || !base.trim()) {
        setInput(sessionText);
      } else {
        setInput(`${base.trim()} ${sessionText.trim()}`);
      }
    },
  });

  // Text-To-Speech hook
  const tts = useTextToSpeech(selectedLanguage);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isTyping, isOpen]);

  // Voice toggle
  const handleVoiceToggle = () => {
    if (!isSpeechSupported) return;
    if (isListening) {
      stopListening();
    } else {
      baseInputRef.current = input;
      clearSpeechError();
      startListening();
    }
  };

  // Build context
  const buildContext = (): AssistantAppContext => {
    return {
      currentPage: activeRoute,
      currentComplaintId: selectedComplaintId,
      currentUser: {
        id: currentUser.id,
        name: currentUser.name,
        city: currentUser.city,
        ward: currentUser.ward,
      },
      userComplaintsSummary: complaints.slice(0, 10).map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        department: c.department,
        ward: c.ward,
        updatedAt: c.updatedAt,
      })),
    };
  };

  // Handle Send
  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText !== undefined ? customText : input).trim();
    const imageToSend = attachedImage;

    if (!textToSend && !imageToSend) return;

    if (isListening) {
      stopListening();
    }

    const userMessage: AssistantMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: textToSend,
      imageUri: imageToSend || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    baseInputRef.current = "";
    setAttachedImage(null);
    setIsTyping(true);

    try {
      const context = buildContext();
      const response = await civicFixAI.chat(textToSend, context, imageToSend || undefined, messages);

      // Check if response references a complaint by ID
      let matchedComplaint: Complaint | undefined = response.complaintData;
      if (!matchedComplaint && response.matchedComplaintId) {
        matchedComplaint = complaints.find(
          (c) => c.id.toLowerCase() === response.matchedComplaintId?.toLowerCase()
        );
      }

      const aiMessage: AssistantMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        intent: response.intent,
        complaintCard: matchedComplaint,
        analysisCard: response.analysisCard,
        actionButtons: response.actionButtons,
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Optional hands-free auto-speak when Voice Mode is enabled
      if (autoReadVoice && tts.isSupported) {
        tts.speak(response.reply, aiMessage.id, selectedLanguage);
      }
    } catch (err) {
      console.warn("CivicFix Assistant chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: "ai",
          text: "I'm having a little trouble processing that right now. You can try again, or continue using CivicFix manually.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          actionButtons: [
            { label: "Report an Issue", action: "GO_REPORT" },
            { label: "Track Complaints", action: "GO_COMPLAINTS" },
          ],
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // Handle Action Button click
  const handleActionButton = (btn: AssistantActionButton) => {
    if (btn.action === "GO_REPORT") {
      onNavigate("report");
      onClose();
    } else if (btn.action === "REVIEW_COMPLAINT" && btn.draftData) {
      onStartComplaintDraft(btn.draftData);
      onNavigate("report");
      onClose();
    } else if (btn.action === "GO_COMPLAINT" && btn.complaintId) {
      onSelectComplaint(btn.complaintId);
      onClose();
    } else if (btn.action === "GO_COMPLAINTS") {
      onNavigate("complaints");
      onClose();
    } else if (btn.action === "GO_MAP") {
      onNavigate("map");
      onClose();
    } else if (btn.action === "GO_DASHBOARD") {
      onNavigate("dashboard");
      onClose();
    } else if (btn.action === "GO_PROFILE") {
      onNavigate("profile");
      onClose();
    } else if (btn.action === "UPLOAD_IMAGE") {
      fileInputRef.current?.click();
    }
  };

  // Handle image attachment
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      alert("Image size must be under 8MB.");
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setAttachedImage(base64);
    } catch (err) {
      console.warn("Failed to read image:", err);
    }
    if (e.target) e.target.value = "";
  };

  // Clear conversation
  const handleResetChat = () => {
    setMessages([
      {
        id: "welcome-reset",
        sender: "ai",
        text: "Hi! I'm the **CivicFix Assistant** 👋\n\nI can help you report civic issues, understand complaint statuses, find the right department, and track your repairs.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed z-50 transition-all duration-300 flex flex-col shadow-2xl overflow-hidden bg-white border border-slate-200/90
        ${
          isExpanded
            ? "inset-4 sm:inset-6 md:inset-x-auto md:right-8 md:bottom-8 md:top-16 md:w-[620px] rounded-2xl"
            : "bottom-0 right-0 w-full h-[92vh] sm:bottom-6 sm:right-6 sm:w-[440px] sm:h-[620px] sm:rounded-2xl rounded-t-2xl"
        }`}
      role="dialog"
      aria-label="CivicFix Assistant"
    >
      {/* 1. Header */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white px-4 py-3.5 flex items-center justify-between border-b border-teal-800/40 select-none">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-slate-950 flex items-center justify-center shadow-md shadow-teal-500/20">
            <Bot className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading font-bold text-sm tracking-tight text-white">
                CivicFix Assistant
              </h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                AI Assistant
              </span>
            </div>
            <p className="text-[11px] text-teal-200/80 font-normal">
              Your guide to reporting civic issues
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-slate-400">
          {/* Language selector toggle */}
          <div className="relative">
            <button
              onClick={() => setShowLanguageMenu(!showLanguageMenu)}
              title={`Voice Language: ${
                SUPPORTED_SPEECH_LANGUAGES.find((l) => l.code === selectedLanguage)?.label ||
                "English (India)"
              }`}
              className="px-2 py-1 text-[11px] font-semibold text-teal-200 hover:text-white bg-white/10 hover:bg-white/15 rounded-lg transition-colors flex items-center gap-1"
            >
              <Globe className="w-3.5 h-3.5 text-teal-400" />
              <span>{selectedLanguage === "hi-IN" ? "हिन्दी" : "EN-IN"}</span>
            </button>

            {showLanguageMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-44 bg-slate-900 border border-teal-800/80 rounded-xl shadow-xl py-1 z-50 text-xs">
                <div className="px-3 py-1.5 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                  Voice Language
                </div>
                {SUPPORTED_SPEECH_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setSelectedLanguage(lang.code);
                      setShowLanguageMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors ${
                      selectedLanguage === lang.code
                        ? "text-teal-300 font-semibold bg-teal-950/60"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span>{lang.label}</span>
                    {selectedLanguage === lang.code && (
                      <CheckCircle className="w-3.5 h-3.5 text-teal-400" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Auto-read response toggle */}
          {tts.isSupported && (
            <button
              onClick={() => {
                const next = !autoReadVoice;
                setAutoReadVoice(next);
                if (!next && tts.isSpeaking) {
                  tts.stop();
                }
              }}
              title={
                autoReadVoice
                  ? "Voice mode: Auto-read responses is ON"
                  : "Voice mode: Click to turn auto-read ON"
              }
              className={`p-1.5 rounded-lg transition-colors ${
                autoReadVoice
                  ? "text-teal-300 bg-teal-800/40 ring-1 ring-teal-500/40"
                  : "hover:text-white hover:bg-white/10 text-slate-400"
              }`}
            >
              {autoReadVoice ? (
                <Volume2 className="w-4 h-4 text-teal-300" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </button>
          )}

          <button
            onClick={handleResetChat}
            title="Start new conversation"
            className="p-1.5 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Collapse window" : "Expand window"}
            className="hidden sm:inline-flex p-1.5 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => {
              if (tts.isSpeaking) tts.stop();
              if (isListening) stopListening();
              onClose();
            }}
            title="Close Assistant"
            className="p-1.5 hover:text-white hover:bg-white/10 rounded-lg transition-colors ml-0.5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2. Conversation Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/70">
        {messages.map((msg) => {
          const isUser = msg.sender === "user";

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-2`}
            >
              {/* Message Bubble */}
              <div
                className={`max-w-[88%] sm:max-w-[82%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                  isUser
                    ? "bg-gradient-to-tr from-teal-700 to-teal-600 text-white rounded-br-none"
                    : "bg-white text-slate-800 border border-slate-200/90 rounded-bl-none"
                }`}
              >
                {/* User attached image preview */}
                {msg.imageUri && (
                  <div className="mb-2 rounded-lg overflow-hidden border border-white/20 max-h-48">
                    <img
                      src={msg.imageUri}
                      alt="Uploaded civic evidence"
                      className="w-full h-auto object-cover"
                    />
                  </div>
                )}

                {/* Text Content */}
                <div className="whitespace-pre-wrap space-y-1">
                  {formatMarkdownSimple(msg.text)}
                </div>

                <div
                  className={`text-[10px] mt-1.5 flex items-center justify-between gap-2 ${
                    isUser ? "text-teal-200 justify-end" : "text-slate-400"
                  }`}
                >
                  {!isUser && tts.isSupported && (
                    <button
                      type="button"
                      onClick={() => tts.speak(msg.text, msg.id, selectedLanguage)}
                      title={
                        tts.isSpeaking && tts.speakingMessageId === msg.id
                          ? "Stop reading response"
                          : "Read response aloud"
                      }
                      aria-label={
                        tts.isSpeaking && tts.speakingMessageId === msg.id
                          ? "Stop reading response"
                          : "Read response aloud"
                      }
                      className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded transition-colors ${
                        tts.isSpeaking && tts.speakingMessageId === msg.id
                          ? "text-teal-700 font-semibold bg-teal-50 ring-1 ring-teal-200"
                          : "text-slate-400 hover:text-teal-700 hover:bg-slate-100"
                      }`}
                    >
                      {tts.isSpeaking && tts.speakingMessageId === msg.id ? (
                        <>
                          <Square className="w-3 h-3 fill-current animate-pulse text-teal-700" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Listen</span>
                        </>
                      )}
                    </button>
                  )}
                  <span>{msg.timestamp}</span>
                </div>
              </div>

              {/* Embedded Live Complaint Card */}
              {msg.complaintCard && (
                <div className="max-w-[90%] w-full bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:border-teal-300 transition-colors">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      {msg.complaintCard.id}
                    </span>
                    <StatusBadge status={msg.complaintCard.status} size="sm" />
                  </div>
                  <h4 className="text-xs font-semibold text-slate-900 line-clamp-1">
                    {msg.complaintCard.title}
                  </h4>
                  <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      {msg.complaintCard.department}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {msg.complaintCard.ward}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      onSelectComplaint(msg.complaintCard!.id);
                      onClose();
                    }}
                    className="mt-2.5 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 py-1.5 rounded-lg border border-teal-200 transition-colors"
                  >
                    <span>Track Complaint Live</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Embedded Image Analysis Card */}
              {msg.analysisCard && (
                <div className="max-w-[90%] w-full bg-slate-900 text-white rounded-xl p-3 shadow-md border border-slate-800">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-300 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800">
                      <Sparkles className="w-3 h-3" /> AI suggestion
                    </span>
                    <PriorityBadge priority={msg.analysisCard.priority} size="sm" />
                  </div>
                  <h4 className="text-xs font-semibold text-white mb-1">
                    {msg.analysisCard.title}
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-relaxed mb-2">
                    {msg.analysisCard.description}
                  </p>
                  <div className="text-[10px] text-slate-400 grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-800">
                    <div>
                      <span className="block text-slate-500">Department</span>
                      <span className="font-medium text-slate-200">{msg.analysisCard.suggestedDepartment}</span>
                    </div>
                    <div>
                      <span className="block text-slate-500">Confidence</span>
                      <span className="font-medium text-teal-400">
                        {Math.round(msg.analysisCard.confidence * 100)}% Match
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {msg.actionButtons && msg.actionButtons.length > 0 && (
                <div className="flex flex-wrap gap-1.5 max-w-[90%] pt-0.5">
                  {msg.actionButtons.map((btn, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleActionButton(btn)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 ${
                        idx === 0
                          ? "bg-teal-700 hover:bg-teal-800 text-white"
                          : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"
                      }`}
                    >
                      <span>{btn.label}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200/90 rounded-2xl rounded-bl-none px-3.5 py-2 w-fit shadow-sm">
            <span className="font-medium">CivicFix Assistant is typing</span>
            <div className="flex items-center gap-1 ml-1">
              <span className="w-1.5 h-1.5 bg-teal-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-teal-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-teal-600 rounded-full animate-bounce" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Starter Prompts (shown when <= 2 messages) */}
      {messages.length <= 2 && (
        <div className="px-4 py-2 bg-slate-100/80 border-t border-slate-200/80 overflow-x-auto whitespace-nowrap scrollbar-none flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-500 mr-1 flex items-center gap-1 shrink-0">
            <Sparkles className="w-3 h-3 text-teal-600" /> Try:
          </span>
          {INITIAL_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(prompt)}
              className="text-[11px] font-medium text-slate-700 bg-white hover:bg-teal-50 hover:text-teal-800 hover:border-teal-300 border border-slate-200 px-2.5 py-1 rounded-full shadow-2xs transition-colors shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Attached image chip */}
      {attachedImage && (
        <div className="px-4 py-2 bg-teal-50/80 border-t border-teal-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src={attachedImage}
              alt="Preview"
              className="w-9 h-9 rounded-lg object-cover border border-teal-200"
            />
            <div>
              <p className="text-xs font-semibold text-teal-900">Photo attached</p>
              <p className="text-[10px] text-teal-700">Civic vision analysis ready</p>
            </div>
          </div>
          <button
            onClick={() => setAttachedImage(null)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Listening State Banner with Sound Waves & Interim Transcript */}
      {isListening && (
        <div
          className="px-4 py-2 bg-gradient-to-r from-teal-50 via-emerald-50 to-teal-50 border-t border-teal-200 flex items-center justify-between gap-2 text-xs transition-all"
          aria-live="polite"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
            <div className="flex items-center gap-1.5 shrink-0 font-medium text-slate-800">
              <span>Listening...</span>
              {/* Subtle 5-bar animated sound wave */}
              <div className="flex items-end gap-0.5 h-3.5 px-0.5" aria-hidden="true">
                <span className="w-1 bg-teal-600 rounded-full h-2 animate-[pulse_0.6s_ease-in-out_infinite]" />
                <span className="w-1 bg-teal-600 rounded-full h-3.5 animate-[pulse_0.6s_ease-in-out_0.15s_infinite]" />
                <span className="w-1 bg-teal-600 rounded-full h-2.5 animate-[pulse_0.6s_ease-in-out_0.3s_infinite]" />
                <span className="w-1 bg-teal-600 rounded-full h-3 animate-[pulse_0.6s_ease-in-out_0.45s_infinite]" />
                <span className="w-1 bg-teal-600 rounded-full h-1.5 animate-[pulse_0.6s_ease-in-out_0.2s_infinite]" />
              </div>
            </div>
            {interimTranscript && (
              <span className="italic text-teal-900 truncate font-normal">
                "{interimTranscript}"
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={stopListening}
            className="text-[11px] font-semibold text-rose-700 bg-rose-100 hover:bg-rose-200 px-2.5 py-1 rounded-lg transition-colors shrink-0 flex items-center gap-1"
          >
            <Square className="w-2.5 h-2.5 fill-current" />
            <span>Done</span>
          </button>
        </div>
      )}

      {/* Speech Error Banner */}
      {speechError && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 flex items-center justify-between text-xs text-amber-900 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="truncate">{speechError.message}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {speechError.code === "not-allowed" && (
              <button
                type="button"
                onClick={handleVoiceToggle}
                className="font-semibold text-teal-800 underline hover:text-teal-950 px-1"
              >
                Try Again
              </button>
            )}
            <button
              type="button"
              onClick={clearSpeechError}
              aria-label="Dismiss error message"
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Input Controls Bar */}
      <div className="p-3 bg-white border-t border-slate-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-1.5"
        >
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
          />

          {/* Text Input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={isListening ? "Listening... speak your issue" : "Ask CivicFix Assistant..."}
            className="flex-1 bg-slate-100 hover:bg-slate-100/80 focus:bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 px-3.5 py-2.5 rounded-xl border border-transparent focus:border-teal-500 focus:outline-none transition-all"
          />

          {/* Attach Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Upload civic photo"
            aria-label="Upload civic photo"
            className="p-2 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded-xl transition-colors shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Voice Mic Button */}
          <button
            type="button"
            onClick={handleVoiceToggle}
            disabled={!isSpeechSupported && voiceState !== "error"}
            title={
              !isSpeechSupported
                ? "Voice input is not supported in this browser. Please use text input or try Chrome, Edge, or Safari."
                : isListening
                ? "Stop listening"
                : voiceState === "requesting_permission"
                ? "Requesting microphone access..."
                : "Use voice"
            }
            aria-label={
              isListening
                ? "Stop voice input"
                : !isSpeechSupported
                ? "Voice input not supported"
                : "Use voice input"
            }
            className={`p-2 rounded-xl transition-all shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center ${
              isListening
                ? "bg-rose-100 text-rose-600 ring-2 ring-rose-300 animate-pulse"
                : voiceState === "requesting_permission"
                ? "bg-teal-50 text-teal-700"
                : !isSpeechSupported
                ? "text-slate-300 cursor-not-allowed"
                : "text-slate-500 hover:text-teal-700 hover:bg-slate-100 active:scale-95"
            }`}
          >
            {voiceState === "requesting_permission" ? (
              <Loader2 className="w-4 h-4 animate-spin text-teal-700" />
            ) : isListening ? (
              <Square className="w-3.5 h-3.5 fill-current text-rose-600" />
            ) : !isSpeechSupported ? (
              <MicOff className="w-4 h-4 text-slate-300" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!input.trim() && !attachedImage}
            aria-label="Send message"
            className="p-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-40 disabled:hover:bg-teal-700 text-white rounded-xl shadow-xs transition-all active:scale-95 shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

// Helper: Format bold and bullet lists in simple markdown
function formatMarkdownSimple(text: string) {
  const lines = text.split("\n");
  return lines.map((line, idx) => {
    let formatted = line;

    // Bullet line
    const isBullet = line.trim().startsWith("•") || line.trim().startsWith("-");
    const cleanLine = isBullet ? line.replace(/^[•\-]\s*/, "") : line;

    // Replace bold **text**
    const parts = cleanLine.split(/(\*\*.*?\*\*)/g);

    const renderedParts = parts.map((part, pIdx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={pIdx} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });

    if (isBullet) {
      return (
        <div key={idx} className="flex items-start gap-1.5 pl-1 my-0.5">
          <span className="text-teal-600 font-bold shrink-0">•</span>
          <span>{renderedParts}</span>
        </div>
      );
    }

    if (!line.trim()) {
      return <div key={idx} className="h-1.5" />;
    }

    return <p key={idx}>{renderedParts}</p>;
  });
}
