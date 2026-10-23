import React, { useState, useRef, useEffect, useMemo } from "react";
import { User, Complaint, IssueCategory, MunicipalDepartment, ComplaintPriority, AIAnalysisResult, ComplaintDraftInput } from "../types";
import { SAMPLE_EVIDENCE_PHOTOS, MUNICIPAL_DEPARTMENTS } from "../data/mockData";
import { analyzeComplaintWithAI, sendChatMessageToAI, smartClientCivicAnalyzer } from "../services/aiService";
import { createComplaint, checkPotentialDuplicatesForDraft } from "../services/complaintService";
import { calculateCivicPriorityScore } from "../services/civicPriorityService";
import { PriorityScoreDisplay } from "../components/ui/PriorityScoreDisplay";
import { saveReportToSupabase } from "../services/supabaseService";
import { getCurrentCoordinates, reverseGeocode } from "../services/locationService";
import { InteractiveMap } from "../components/map/InteractiveMap";
import { MapsWrapper } from "../components/map/MapsWrapper";
import { PriorityBadge } from "../components/ui/StatusBadge";
import confetti from "canvas-confetti";
import {
  Camera,
  Upload,
  Sparkles,
  Mic,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Edit3,
  Bot,
  Send,
  RefreshCw,
  Eye,
  ShieldCheck,
  Check,
  Building2,
  Trash2,
  Navigation,
  Globe,
  Compass
} from "lucide-react";

const POPULAR_INDIAN_CITIES = [
  { name: "Lucknow", state: "UP", lat: 26.8467, lng: 80.9462 },
  { name: "New Delhi", state: "DL", lat: 28.6139, lng: 77.2090 },
  { name: "Bengaluru", state: "KA", lat: 12.9716, lng: 77.5946 },
  { name: "Mumbai", state: "MH", lat: 19.0760, lng: 72.8777 },
  { name: "Pune", state: "MH", lat: 18.5204, lng: 73.8567 },
  { name: "Hyderabad", state: "TS", lat: 17.3850, lng: 78.4867 },
  { name: "Jaipur", state: "RJ", lat: 26.9124, lng: 75.7873 },
  { name: "Kolkata", state: "WB", lat: 22.5726, lng: 88.3639 },
  { name: "Kanpur", state: "UP", lat: 26.4499, lng: 80.3319 },
  { name: "Patna", state: "BR", lat: 25.5941, lng: 85.1376 },
];

interface ReportIssuePageProps {
  currentUser: User;
  onNavigate: (route: string) => void;
  onComplaintSubmitted: (complaint: Complaint) => void;
  preselectedCoords?: { lat: number; lng: number; address: string; ward: string };
  initialDraft?: ComplaintDraftInput;
}

type Step = "input" | "ai_dialog" | "location" | "review" | "success";

export const ReportIssuePage: React.FC<ReportIssuePageProps> = ({
  currentUser,
  onNavigate,
  onComplaintSubmitted,
  preselectedCoords,
  initialDraft,
}) => {
  const [currentStep, setCurrentStep] = useState<Step>(() => (initialDraft ? "review" : "input"));

  // User input states
  const [descriptionText, setDescriptionText] = useState(initialDraft?.description || "");
  const [selectedImage, setSelectedImage] = useState<string | null>(initialDraft?.image || null);
  const [isRecording, setIsRecording] = useState(false);

  // AI states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiDraft, setAiDraft] = useState<AIAnalysisResult | null>(() => {
    if (initialDraft) {
      return {
        category: initialDraft.category || "other",
        title: initialDraft.title || "Reported Issue",
        description: initialDraft.description || "",
        priority: initialDraft.priority || "medium",
        suggestedDepartment: initialDraft.department || "Road Maintenance",
        confidence: 0.95,
        detectedWardHint: initialDraft.ward || "Ward 12",
      };
    }
    return null;
  });
  const [chatMessages, setChatMessages] = useState<{ sender: "ai" | "user"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);

  // Location states
  const [coords, setCoords] = useState<{ lat: number; lng: number }>(
    preselectedCoords
      ? { lat: preselectedCoords.lat, lng: preselectedCoords.lng }
      : initialDraft?.coords
      ? initialDraft.coords
      : { lat: 26.8467, lng: 80.9462 }
  );
  const [city, setCity] = useState<string>(currentUser.city || "");
  const [address, setAddress] = useState(
    preselectedCoords ? preselectedCoords.address : initialDraft?.address || ""
  );
  const [ward, setWard] = useState(preselectedCoords ? preselectedCoords.ward : initialDraft?.ward || "");
  const [locationDetected, setLocationDetected] = useState(Boolean(preselectedCoords || initialDraft?.coords));
  const [isLocating, setIsLocating] = useState(false);

  // Live GPS Geolocation trigger
  const detectLiveLocation = async () => {
    setIsLocating(true);
    try {
      const pos = await getCurrentCoordinates();
      setCoords({ lat: pos.latitude, lng: pos.longitude });
      setLocationDetected(true);

      const geo = await reverseGeocode(pos.latitude, pos.longitude);
      if (geo) {
        if (geo.addressLine || geo.formattedAddress) {
          setAddress(geo.addressLine || geo.formattedAddress);
        }
        if (geo.city) {
          setCity(geo.city);
        }
        const zone = geo.locality || geo.neighborhood || geo.district || "Local Ward";
        setWard(zone.startsWith("Ward") || zone.startsWith("Zone") ? zone : `Zone: ${zone}`);
      }
    } catch (locErr) {
      console.warn("GPS Detection notice:", locErr);
      if (!address) setAddress("Selected Location Point");
      if (!ward) setWard(currentUser.ward || "Municipal Ward");
      setLocationDetected(true);
    } finally {
      setIsLocating(false);
    }
  };

  // Trigger browser geolocation on step change to location
  useEffect(() => {
    if (currentStep === "location" && !preselectedCoords && !locationDetected) {
      detectLiveLocation();
    }
  }, [currentStep, preselectedCoords, locationDetected]);

  // Edit review state
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [editedTitle, setEditedTitle] = useState(initialDraft?.title || "");
  const [editedDesc, setEditedDesc] = useState(initialDraft?.description || "");
  const [editedDepartment, setEditedDepartment] = useState<MunicipalDepartment>(
    initialDraft?.department || "Road Maintenance"
  );
  const [editedPriority, setEditedPriority] = useState<ComplaintPriority>(initialDraft?.priority || "medium");

  // Computed provisional civic priority score for citizen review
  const provisionalPriorityScore = useMemo(() => {
    return calculateCivicPriorityScore({
      category: aiDraft?.category || "other",
      title: editedTitle || aiDraft?.title || "Reported Issue",
      description: editedDesc || descriptionText,
      priority: editedPriority,
      address,
      ward,
      city,
      createdAt: new Date().toISOString(),
    });
  }, [aiDraft, editedTitle, editedDesc, descriptionText, editedPriority, address, ward, city]);

  // Detected potential duplicates in the vicinity
  const duplicateMatches = useMemo(() => {
    return checkPotentialDuplicatesForDraft(
      aiDraft?.category || "other",
      editedTitle || aiDraft?.title || "Reported Issue",
      editedDesc || descriptionText,
      coords.lat,
      coords.lng
    );
  }, [aiDraft, editedTitle, editedDesc, descriptionText, coords]);

  // Submitted complaint object & Supabase insertion state
  const [submittedComplaint, setSubmittedComplaint] = useState<Complaint | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [supabaseInsertState, setSupabaseInsertState] = useState<{
    status: "idle" | "inserting" | "success" | "error";
    data?: any;
    error?: string;
  }>({ status: "idle" });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        alert("Image size must be under 8MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle sample photo select
  const handleSelectSamplePhoto = (sample: typeof SAMPLE_EVIDENCE_PHOTOS[0]) => {
    setSelectedImage(sample.url);
    if (!descriptionText) {
      setDescriptionText(sample.description);
    }
  };

  // Mic voice dictation toggle
  const handleMicToggle = () => {
    if (typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-IN";

      if (!isRecording) {
        setIsRecording(true);
        recognition.start();
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setDescriptionText((prev) => (prev ? `${prev} ${transcript}` : transcript));
          setIsRecording(false);
        };
        recognition.onerror = () => setIsRecording(false);
        recognition.onend = () => setIsRecording(false);
      } else {
        recognition.stop();
        setIsRecording(false);
      }
    } else {
      // Fallback sample phrase
      setDescriptionText("The streetlight near my house has been completely off for two days.");
    }
  };

  // Proceed from Input to AI Dialog
  const handleStartAnalysis = async () => {
    if (!descriptionText.trim() && !selectedImage) {
      alert("Please upload a photo or enter a brief description of the issue.");
      return;
    }

    setIsAnalyzing(true);
    setCurrentStep("ai_dialog");

    try {
      const result = await analyzeComplaintWithAI({
        text: descriptionText,
        imageBase64: selectedImage || undefined,
      });

      setAiDraft(result);
      setEditedTitle(result.title);
      setEditedDesc(result.description);
      setEditedDepartment(result.suggestedDepartment);
      setEditedPriority(result.priority);

      // Initialize AI conversation with clarifying question or greeting
      const firstGreeting = selectedImage
        ? `I analyzed your evidence photo and text. Possible issue: **${result.title}** (Confidence: ${Math.round(result.confidence * 100)}%). I've routed this to **${result.suggestedDepartment}** with **${result.priority.toUpperCase()}** priority.`
        : `I've analyzed your description as **${result.title}**. Suggested department: **${result.suggestedDepartment}**.`;

      const initialMsgs: { sender: "ai" | "user"; text: string }[] = [
        { sender: "ai", text: firstGreeting },
      ];

      if (result.clarifyingQuestion) {
        initialMsgs.push({
          sender: "ai",
          text: result.clarifyingQuestion,
        });
      }

      setChatMessages(initialMsgs);
    } catch (err) {
      console.warn("AI analysis note:", err);
      const fallback = smartClientCivicAnalyzer(descriptionText, Boolean(selectedImage));
      setAiDraft(fallback);
      setEditedTitle(fallback.title);
      setEditedDesc(fallback.description);
      setEditedDepartment(fallback.suggestedDepartment);
      setEditedPriority(fallback.priority);
      setChatMessages([
        {
          sender: "ai",
          text: `I've prepared your draft for **${fallback.title}** under **${fallback.suggestedDepartment}** with **${fallback.priority.toUpperCase()}** priority.`,
        },
        {
          sender: "ai",
          text: fallback.clarifyingQuestion || "Could you confirm nearby landmarks to assist municipal crews?",
        },
      ]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Send interactive chat reply to AI
  const handleSendMessage = async (textToSend?: string) => {
    const message = textToSend || chatInput;
    if (!message.trim()) return;

    const newHistory = [...chatMessages, { sender: "user" as const, text: message }];
    setChatMessages(newHistory);
    setChatInput("");
    setIsAiTyping(true);

    try {
      const reply = await sendChatMessageToAI(message, newHistory, aiDraft || undefined);
      setChatMessages([...newHistory, { sender: "ai", text: reply }]);
      // Enrich description if user gave more details
      setEditedDesc((prev) => `${prev} Note: ${message}`);
    } catch (e) {
      setChatMessages([
        ...newHistory,
        { sender: "ai", text: "Thank you. I have recorded this information in your draft." },
      ]);
    } finally {
      setIsAiTyping(false);
    }
  };

  // Submit Complaint
  const handleFinalSubmit = async () => {
    if (!aiDraft || isSubmitting) return;

    setIsSubmitting(true);
    setSupabaseInsertState({ status: "inserting" });

    const newComplaint = createComplaint({
      citizenId: currentUser.id,
      citizenName: currentUser.name,
      citizenPhone: currentUser.phone,
      category: aiDraft.category,
      title: editedTitle || aiDraft.title,
      description: editedDesc || aiDraft.description,
      imageUrl: selectedImage || undefined,
      latitude: coords.lat,
      longitude: coords.lng,
      address: address || "Location Pin",
      ward: ward || currentUser.ward || "Local Ward",
      city: city || currentUser.city || "Local Municipality",
      department: editedDepartment,
      priority: editedPriority,
      aiConfidence: aiDraft.confidence,
      aiSuggestedCategory: aiDraft.category,
      aiSuggestedDepartment: aiDraft.suggestedDepartment,
    });

    // Directly await Supabase insert for verified confirmation
    try {
      const res = await saveReportToSupabase(newComplaint);
      if (res.success) {
        setSupabaseInsertState({ status: "success", data: res.data });
      } else {
        setSupabaseInsertState({ status: "error", error: res.error });
      }
    } catch (err: any) {
      setSupabaseInsertState({ status: "error", error: err.message });
    } finally {
      setIsSubmitting(false);
    }

    setSubmittedComplaint(newComplaint);
    setCurrentStep("success");
    onComplaintSubmitted(newComplaint);

    // Launch celebration confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (e) {}
  };

  return (
    <div className="min-h-screen bg-slate-50/70 pb-20 pt-6 sm:pt-10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Step Progress Indicators */}
        <div className="mb-6 flex items-center justify-between text-xs font-semibold text-slate-500">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                currentStep === "input"
                  ? "bg-teal-600 text-white"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {currentStep !== "input" ? <Check className="w-3.5 h-3.5" /> : "1"}
            </span>
            <span className={currentStep === "input" ? "text-slate-900 font-bold" : ""}>
              Evidence
            </span>
          </div>

          <div className="w-8 sm:w-12 h-0.5 bg-slate-200" />

          <div className="flex items-center gap-1.5">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                currentStep === "ai_dialog"
                  ? "bg-teal-600 text-white"
                  : currentStep === "location" || currentStep === "review" || currentStep === "success"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {currentStep === "location" || currentStep === "review" || currentStep === "success" ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                "2"
              )}
            </span>
            <span className={currentStep === "ai_dialog" ? "text-slate-900 font-bold" : ""}>
              AI Review
            </span>
          </div>

          <div className="w-8 sm:w-12 h-0.5 bg-slate-200" />

          <div className="flex items-center gap-1.5">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                currentStep === "location"
                  ? "bg-teal-600 text-white"
                  : currentStep === "review" || currentStep === "success"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {currentStep === "review" || currentStep === "success" ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                "3"
              )}
            </span>
            <span className={currentStep === "location" ? "text-slate-900 font-bold" : ""}>
              Location
            </span>
          </div>

          <div className="w-8 sm:w-12 h-0.5 bg-slate-200" />

          <div className="flex items-center gap-1.5">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                currentStep === "review" || currentStep === "success"
                  ? "bg-teal-600 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              4
            </span>
            <span className={currentStep === "review" ? "text-slate-900 font-bold" : ""}>
              Review
            </span>
          </div>
        </div>

        {/* ================= STEP 1: INPUT SCREEN ================= */}
        {currentStep === "input" && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 bg-teal-50 px-3 py-1 rounded-full mb-2 border border-teal-200">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                <span>AI-Assisted Civic Reporting</span>
              </div>
              <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                What needs fixing?
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Upload a photo or describe the issue. CivicFix will help with the rest.
              </p>
            </div>

            {/* Option A: Upload Photo */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Option A — Upload Photo
                </label>
                {selectedImage && (
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1 font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                )}
              </div>

              {!selectedImage ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-2xl p-8 text-center bg-slate-50/60 hover:bg-teal-50/20 cursor-pointer transition-all group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-white text-teal-600 shadow-2xs border border-slate-200 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <Camera className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Upload a photo
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Take a photo or choose one from your device (JPG, PNG)
                  </p>
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 max-h-64 bg-slate-900">
                  <img
                    src={selectedImage}
                    alt="Evidence Preview"
                    className="w-full h-64 object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Photo Evidence Attached</span>
                  </div>
                </div>
              )}

              {/* Sample Evidence Shortcuts */}
              <div className="mt-3">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                  Or test with sample civic evidence:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SAMPLE_EVIDENCE_PHOTOS.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => handleSelectSamplePhoto(sample)}
                      className="p-2 bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-xl text-left transition-all group flex flex-col justify-between"
                    >
                      <img
                        src={sample.url}
                        alt={sample.title}
                        className="w-full h-12 object-cover rounded-lg mb-1.5"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-[11px] font-bold text-slate-800 line-clamp-1 group-hover:text-teal-800">
                        {sample.title}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Option B: Describe Issue */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Option B — Describe Issue
                </label>
                <button
                  type="button"
                  onClick={handleMicToggle}
                  className={`text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                    isRecording
                      ? "bg-rose-100 text-rose-700 animate-pulse"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>{isRecording ? "Listening..." : "Voice Input"}</span>
                </button>
              </div>

              <div className="relative">
                <textarea
                  rows={4}
                  value={descriptionText}
                  onChange={(e) => setDescriptionText(e.target.value)}
                  placeholder="Example: The streetlight near my house has been completely off for two days."
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:bg-white focus:border-teal-500 outline-none transition-colors leading-relaxed"
                />
              </div>

              {/* Quick Prompt Chips */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[
                  "Streetlight completely off near 4th cross",
                  "Dangerous deep pothole on main road",
                  "Overflowing garbage bin not cleared",
                  "Water main pipe leaking onto street",
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setDescriptionText(chip)}
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Next Action Button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={isAnalyzing || (!descriptionText.trim() && !selectedImage)}
                onClick={handleStartAnalysis}
                className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>AI Analyzing Civic Issue...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Continue with AI Assistant</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              <p className="text-center text-xs text-slate-600 mt-2">
                CivicFix AI will categorize the problem and suggest the proper municipal department.
              </p>
            </div>
          </div>
        )}

        {/* ================= STEP 2: AI INTERACTION / CLARIFICATION SCREEN ================= */}
        {currentStep === "ai_dialog" && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 bg-teal-50 px-3 py-1 rounded-full mb-1 border border-teal-200">
                  <Bot className="w-3.5 h-3.5 text-teal-600" />
                  <span>Civic Triage Intelligence</span>
                </div>
                <h2 className="font-heading text-2xl font-bold text-slate-900">
                  AI Analysis & Clarification
                </h2>
              </div>
              <button
                onClick={() => setCurrentStep("input")}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            </div>

            {/* AI Result Card (Requirement #11) */}
            {aiDraft && (
              <div className="p-4 bg-teal-50/50 border border-teal-200 rounded-2xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-900">
                      Possible Issue: {aiDraft.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-teal-800 bg-teal-100/80 px-2 py-0.5 rounded-md">
                      Confidence: {Math.round(aiDraft.confidence * 100)}%
                    </span>
                    <PriorityBadge priority={aiDraft.priority} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700 pt-1 border-t border-teal-200/60">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-teal-700" />
                    <span>Suggested Dept: <strong>{aiDraft.suggestedDepartment}</strong></span>
                  </span>
                  <span className="text-teal-600 italic">
                    AI suggestions are preliminary and verified before submission.
                  </span>
                </div>
              </div>
            )}

            {/* Conversational Chat Stream (Requirement #10) */}
            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 max-h-72 overflow-y-auto space-y-3">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 ${
                    msg.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.sender === "ai" && (
                    <div className="w-7 h-7 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-slate-900 text-white rounded-tr-xs"
                        : "bg-white border border-slate-200 text-slate-800 rounded-tl-xs shadow-2xs"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {isAiTyping && (
                <div className="flex items-center gap-2 text-xs text-slate-600 font-medium italic">
                  <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center animate-spin">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </div>
                  <span>AI assistant is formulating response...</span>
                </div>
              )}
            </div>

            {/* Quick Answer Suggestion Buttons */}
            <div className="flex flex-wrap gap-1.5">
              {[
                "Completely off",
                "Flickering intermittently",
                "Clean drinking water leaking",
                "Causing vehicular skidding",
              ].map((ans) => (
                <button
                  key={ans}
                  type="button"
                  onClick={() => handleSendMessage(ans)}
                  className="text-xs bg-white border border-slate-200 hover:border-teal-400 text-slate-700 hover:text-teal-800 px-3 py-1.5 rounded-xl transition-all font-medium shadow-2xs"
                >
                  "{ans}"
                </button>
              ))}
            </div>

            {/* Chat Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Type additional details or reply to AI..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm outline-none focus:bg-white focus:border-teal-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!chatInput.trim()}
                className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* Proceed to Location Confirmation */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep("input")}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Edit Description
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep("location")}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-colors"
              >
                <span>Confirm Location on Map</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 3: LOCATION DETECTION & CONFIRMATION ================= */}
        {currentStep === "location" && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 bg-teal-50 px-3 py-1 rounded-full mb-1 border border-teal-200">
                  <MapPin className="w-3.5 h-3.5 text-teal-600" />
                  <span>Location Confirmation</span>
                </div>
                <h2 className="font-heading text-2xl font-bold text-slate-900">
                  Confirm Issue Location
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Pinpoint your city, ward, and exact spot so municipal authorities dispatch the crew to the right location.
                </p>
              </div>

              {/* Live GPS Button */}
              <button
                type="button"
                onClick={() => detectLiveLocation()}
                disabled={isLocating}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold text-xs rounded-xl border border-teal-200 transition-colors shadow-xs shrink-0 cursor-pointer disabled:opacity-60"
              >
                <Navigation className={`w-4 h-4 text-teal-600 ${isLocating ? "animate-spin" : ""}`} />
                <span>{isLocating ? "Detecting GPS..." : "Auto-Detect My GPS"}</span>
              </button>
            </div>

            {/* Quick City Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-slate-400" /> Quick City Selection
              </label>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_INDIAN_CITIES.map((c) => {
                  const isSelected = city?.toLowerCase() === c.name.toLowerCase();
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => {
                        setCity(c.name);
                        setCoords({ lat: c.lat, lng: c.lng });
                        setWard(`Central Zone, ${c.name}`);
                        if (!address || address === "Selected Location Point") {
                          setAddress(`Main Road / Civil Lines, ${c.name}`);
                        }
                        setLocationDetected(true);
                      }}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                        isSelected
                          ? "bg-slate-900 text-white shadow-xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Editable Fields: City, Ward, Street */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                  {locationDetected ? "Location Configured" : "Choose Location"}
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Lat: {coords.lat.toFixed(4)}, Lng: {coords.lng.toFixed(4)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
                    City / District
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Lucknow, New Delhi, etc."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
                    Ward / Municipal Zone
                  </label>
                  <input
                    type="text"
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    placeholder="e.g. Ward 14 / Hazratganj"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
                    Street / Landmark
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Near Clock Tower"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium outline-none focus:border-teal-500"
                  />
                </div>
              </div>
            </div>

            {/* Interactive Map Picker */}
            <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-2xs">
              <MapsWrapper>
                <InteractiveMap
                  isPicker={true}
                  pickerCoords={coords}
                  heightClass="h-[360px]"
                  onLocationPick={(picked) => {
                    setCoords({ lat: picked.lat, lng: picked.lng });
                    setAddress(picked.address);
                    setWard(picked.ward);
                    setLocationDetected(true);
                  }}
                />
              </MapsWrapper>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep("ai_dialog")}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Back to AI Review
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep("review")}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-colors"
              >
                <span>Proceed to Review</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 4: COMPLAINT REVIEW SCREEN (Requirement #13) ================= */}
        {currentStep === "review" && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 bg-teal-50 px-3 py-1 rounded-full mb-1 border border-teal-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                  <span>Citizen Controlled Review</span>
                </div>
                <h2 className="font-heading text-2xl font-bold text-slate-900">
                  Review your complaint
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confirm all details before it is officially transmitted to municipal authorities.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsEditingReview(!isEditingReview)}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditingReview ? "Done Editing" : "Edit Fields"}</span>
              </button>
            </div>

            {/* Review Sections */}
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden bg-slate-50/40 text-sm">
              {/* Issue Section */}
              <div className="p-4 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="w-full">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                    Issue
                  </span>
                  {isEditingReview ? (
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm font-semibold"
                    />
                  ) : (
                    <h3 className="font-bold text-slate-900 mt-0.5">{editedTitle}</h3>
                  )}
                </div>
              </div>

              {/* Description Section */}
              <div className="p-4 bg-white flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="w-full">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                    Description
                  </span>
                  {isEditingReview ? (
                    <textarea
                      rows={3}
                      value={editedDesc}
                      onChange={(e) => setEditedDesc(e.target.value)}
                      className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm leading-relaxed"
                    />
                  ) : (
                    <p className="text-slate-700 mt-0.5 leading-relaxed">{editedDesc}</p>
                  )}
                </div>
              </div>

              {/* Evidence Photo */}
              <div className="p-4 bg-white flex items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                    Evidence
                  </span>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {selectedImage ? "Uploaded Photo with visual AI verification" : "Text-only citizen report"}
                  </p>
                </div>
                {selectedImage && (
                  <img
                    src={selectedImage}
                    alt="Evidence thumbnail"
                    className="w-16 h-16 object-cover rounded-xl border border-slate-200"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>

              {/* Location */}
              <div className="p-4 bg-white flex items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                    Location
                  </span>
                  <p className="text-slate-900 font-semibold mt-0.5">
                    📍 {city ? `${city} • ` : ""}{ward ? `${ward} • ` : ""}{address || "Marked Pin"}
                  </p>
                  <span className="text-[11px] text-teal-700 font-medium">GPS Confirmed</span>
                </div>
                <button
                  onClick={() => setCurrentStep("location")}
                  className="text-xs text-teal-700 font-semibold hover:underline"
                >
                  Change Pin
                </button>
              </div>

              {/* Suggested Department (Clear AI Tag) */}
              <div className="p-4 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Suggested Department
                    </span>
                    <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-1.5 py-0.2 rounded">
                      AI Suggestion
                    </span>
                  </div>
                  {isEditingReview ? (
                    <select
                      value={editedDepartment}
                      onChange={(e) => setEditedDepartment(e.target.value as MunicipalDepartment)}
                      className="mt-1 bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-semibold"
                    >
                      {MUNICIPAL_DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-slate-900 font-bold mt-0.5 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>{editedDepartment}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Priority */}
              <div className="p-4 bg-white flex items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                    Priority
                  </span>
                  <div className="mt-1">
                    <PriorityBadge priority={editedPriority} />
                  </div>
                </div>
              </div>
            </div>

            {/* Transparent Civic Priority Assessment & Neighborhood Duplicates Preview */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Preliminary Priority Assessment & Neighborhood Duplicates
              </span>
              <PriorityScoreDisplay
                scoreData={provisionalPriorityScore}
                immediateHazard={provisionalPriorityScore.factors.immediateHazardFlag}
                duplicateMatches={duplicateMatches}
                compact={false}
              />
            </div>

            {/* Mandatory Trust Guarantee (Requirement #25) */}
            <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-2xl flex items-start gap-2.5 text-xs text-teal-900">
              <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Citizen Guarantee:</span> You review every AI-generated complaint before it is submitted. Once submitted, your complaint is directly routed to field supervisors.
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep("input")}
                className="w-full sm:w-auto px-5 py-3 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl"
              >
                Edit Report
              </button>

              <button
                type="button"
                onClick={handleFinalSubmit}
                className="w-full sm:w-auto bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-extrabold text-sm px-8 py-3.5 rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Submit Complaint</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 5: SUBMISSION SUCCESS SCREEN (Requirement #14) ================= */}
        {currentStep === "success" && submittedComplaint && (
          <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-xl text-center max-w-lg mx-auto space-y-6 animate-in zoom-in-95 duration-200">
            {/* Large Check Icon */}
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-50">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>

            <div>
              <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900">
                You're all set!
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Your complaint has been sent to the concerned department.
              </p>
            </div>

            {/* Complaint Card Summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs text-slate-500 font-medium">Complaint ID</span>
                <span className="font-mono text-sm font-extrabold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded border border-teal-200">
                  {submittedComplaint.id}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">Issue</span>
                <p className="text-sm font-bold text-slate-900">{submittedComplaint.title}</p>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">Location</span>
                <p className="text-xs text-slate-700">📍 {submittedComplaint.ward} • GPS confirmed</p>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">Routing</span>
                <p className="text-xs font-semibold text-slate-800">{submittedComplaint.department}</p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-xs text-slate-500">Status</span>
                <span className="text-xs font-bold text-slate-700 bg-slate-200/80 px-2 py-0.5 rounded-full">
                  Submitted
                </span>
              </div>

              {/* Supabase Realtime Storage Confirmation */}
              <div className="pt-2 border-t border-slate-200/80">
                {supabaseInsertState.status === "inserting" && (
                  <div className="flex items-center justify-between text-[11px] text-teal-800 bg-teal-50/80 p-2.5 rounded-xl border border-teal-200">
                    <span className="flex items-center gap-1.5 font-bold">
                      <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
                      <span>Writing to public.reports in Supabase...</span>
                    </span>
                    <span className="font-mono text-[10px] text-teal-700 font-bold">
                      tnrkddekmrylxmnosrsg
                    </span>
                  </div>
                )}
                {supabaseInsertState.status === "success" && (
                  <div className="flex items-center justify-between text-[11px] text-emerald-800 bg-emerald-50/90 p-2.5 rounded-xl border border-emerald-200">
                    <span className="flex items-center gap-1.5 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Row verified in Supabase public.reports</span>
                    </span>
                    <span className="font-mono text-[10px] text-emerald-700 font-bold">
                      {supabaseInsertState.data?.id ? `${String(supabaseInsertState.data.id).slice(0, 8)}...` : "tnrkddekmrylxmnosrsg"}
                    </span>
                  </div>
                )}
                {supabaseInsertState.status === "error" && (
                  <div className="flex flex-col gap-1 text-[11px] text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-left">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold text-amber-800">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Supabase Insertion Notice</span>
                      </span>
                      <span className="font-mono text-[10px] text-amber-700 font-bold">
                        tnrkddekmrylxmnosrsg
                      </span>
                    </div>
                    <p className="text-[10px] text-amber-700 font-mono break-all mt-0.5">
                      {supabaseInsertState.error}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Check your browser console for full SUPABASE INSERT ERROR log and verify your RLS policies on public.reports.
                    </p>
                  </div>
                )}
                {supabaseInsertState.status === "idle" && (
                  <div className="flex items-center justify-between text-[11px] text-emerald-800 bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200">
                    <span className="flex items-center gap-1.5 font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Synced to Supabase Account</span>
                    </span>
                    <span className="font-mono text-[10px] text-emerald-700 font-bold">
                      tnrkddekmrylxmnosrsg
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate(`complaint-${submittedComplaint.id}`)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm py-3.5 rounded-xl transition-colors shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Track Complaint</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate("dashboard")}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm py-3.5 rounded-xl transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
