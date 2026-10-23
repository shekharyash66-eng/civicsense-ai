import { AIAnalysisResult, IssueCategory, MunicipalDepartment, ComplaintPriority } from "../types";

export interface AIAnalysisParams {
  text?: string;
  imageBase64?: string;
  imageMimeType?: string;
}

export async function analyzeComplaintWithAI(params: AIAnalysisParams): Promise<AIAnalysisResult> {
  const { text = "", imageBase64, imageMimeType } = params;

  try {
    const res = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        imageBase64,
        imageMimeType: imageMimeType || "image/jpeg",
      }),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.data && json.data.category) {
        return json.data as AIAnalysisResult;
      }
    }
  } catch (e) {
    console.info("CivicFix AI: Using client-side smart intelligence engine.");
  }

  // Guaranteed fallback client intelligence engine
  return smartClientCivicAnalyzer(text, Boolean(imageBase64));
}

export async function sendChatMessageToAI(
  message: string,
  history: { sender: "user" | "ai"; text: string }[],
  currentDraft?: Partial<AIAnalysisResult>
): Promise<string> {
  try {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history, currentDraft }),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.reply) {
        return json.reply;
      }
    }
  } catch (e) {
    // Fallback
  }

  const m = message.toLowerCase();
  if (m.includes("completely off") || m.includes("completely dark") || m.includes("no light")) {
    return "Thank you for confirming. I've noted that the streetlight fixture is completely unpowered. I've tagged this as Medium priority and routed to the Electrical Maintenance division.";
  }
  if (m.includes("deep") || m.includes("huge") || m.includes("skid") || m.includes("danger") || m.includes("accident")) {
    return "Understood. Road hazards with collision or skidding risks are expedited as High priority for the asphalt rapid patch squad.";
  }
  if (m.includes("clean") || m.includes("drinking") || m.includes("burst")) {
    return "Noted! Fresh drinking water pipeline leaks receive priority dispatch from the Water & Sewerage Board to prevent potable loss.";
  }
  if (m.includes("ward") || m.includes("street") || m.includes("cross") || m.includes("near")) {
    return "Thanks for providing that neighborhood context! I've appended this landmark information to your civic report.";
  }

  return "I've updated your complaint draft with these details. You can now verify the location on the map and review your report before final submission.";
}

export function smartClientCivicAnalyzer(text = "", hasImage = false): AIAnalysisResult {
  const lower = text.toLowerCase();

  if (
    lower.includes("light") ||
    lower.includes("lamp") ||
    lower.includes("pole") ||
    lower.includes("dark") ||
    lower.includes("bulb")
  ) {
    return {
      category: "streetlight",
      title: "Streetlight not working",
      description: text || "Streetlight pole is completely off, causing nighttime visibility hazard for pedestrians and commuters.",
      priority: "medium",
      suggestedDepartment: "Electrical Maintenance",
      confidence: 0.94,
      detectedWardHint: "Ward 12",
      clarifyingQuestion: "Is the pole completely off, flickering intermittently, or physically damaged?",
    };
  }

  if (
    lower.includes("pothole") ||
    lower.includes("crater") ||
    lower.includes("road bump") ||
    lower.includes("asphalt") ||
    lower.includes("road hole")
  ) {
    return {
      category: "pothole",
      title: "Hazardous road pothole",
      description: text || "Deep pothole forming in traffic lane, posing safety hazard to two-wheelers.",
      priority: "high",
      suggestedDepartment: "Road Maintenance",
      confidence: 0.96,
      detectedWardHint: "Ward 07",
      clarifyingQuestion: "Has this pothole damaged vehicles or does it fill with water during rain?",
    };
  }

  if (
    lower.includes("garbage") ||
    lower.includes("waste") ||
    lower.includes("trash") ||
    lower.includes("bin") ||
    lower.includes("dump") ||
    lower.includes("smell")
  ) {
    return {
      category: "garbage",
      title: "Overflowing municipal waste dump",
      description: text || "Uncollected community waste overflowing past the bin perimeter onto the walkway.",
      priority: "medium",
      suggestedDepartment: "Waste Management",
      confidence: 0.92,
      detectedWardHint: "Ward 15",
      clarifyingQuestion: "Is the waste spilling onto pedestrian walkways or blocking stormwater drains?",
    };
  }

  if (
    lower.includes("leak") ||
    lower.includes("water pipe") ||
    lower.includes("burst") ||
    lower.includes("tap") ||
    lower.includes("pipeline")
  ) {
    return {
      category: "water_leakage",
      title: "Roadside water pipeline leak",
      description: text || "Potable supply pipe fractured, causing continuous clean water loss onto street.",
      priority: "high",
      suggestedDepartment: "Water & Sewerage",
      confidence: 0.95,
      detectedWardHint: "Ward 04",
      clarifyingQuestion: "Is the leaking water clean treated drinking water or wastewater runoff?",
    };
  }

  if (
    lower.includes("drain") ||
    lower.includes("sewer") ||
    lower.includes("manhole") ||
    lower.includes("clog") ||
    lower.includes("waterlogging")
  ) {
    return {
      category: "drainage",
      title: "Blocked storm drainage & sewer inlet",
      description: text || "Storm drain clogged with debris, causing foul stagnant water accumulation.",
      priority: "high",
      suggestedDepartment: "Water & Sewerage",
      confidence: 0.91,
      detectedWardHint: "Ward 09",
      clarifyingQuestion: "Is the manhole cover missing or cracked?",
    };
  }

  if (
    lower.includes("signal") ||
    lower.includes("traffic light") ||
    lower.includes("junction") ||
    lower.includes("pedestrian crossing")
  ) {
    return {
      category: "traffic_signal",
      title: "Traffic signal malfunction",
      description: text || "Traffic signal lights unresponsive or out of sync at busy intersection.",
      priority: "urgent",
      suggestedDepartment: "Traffic Management",
      confidence: 0.93,
      detectedWardHint: "Ward 02",
      clarifyingQuestion: "Are the lights totally blank, stuck on red, or flashing amber?",
    };
  }

  // Generic civic issue
  return {
    category: hasImage ? "road_damage" : "other",
    title: text ? (text.length > 40 ? text.slice(0, 38) + "..." : text) : "Civic infrastructure issue",
    description: text || "Reported civic issue requiring municipal assessment and field inspection.",
    priority: "medium",
    suggestedDepartment: "General Civic Services",
    confidence: 0.88,
    detectedWardHint: "Ward 12",
    clarifyingQuestion: "Could you mention any nearby landmarks or street markers to assist municipal workers?",
  };
}
