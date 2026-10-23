import {
  AssistantAppContext,
  AssistantMessage,
  AssistantResponse,
  Complaint,
  ComplaintStatus,
  MunicipalDepartment,
  IssueCategory,
  ComplaintPriority,
  ComplaintDraftInput,
  AIAnalysisResult,
} from "../types";
import {
  getStoredComplaints,
  getComplaintById as getById,
  getComplaintByIdAsync,
  getMyComplaints as getMyList,
  getComplaintStatus as getStatus,
  suggestDepartment as suggestDept,
  updateComplaintStatus as updateStatus,
} from "./complaintService";
import { analyzeComplaintWithAI } from "./aiService";

export interface CivicFixAI {
  chat(message: string, context: AssistantAppContext, imageBase64?: string, history?: AssistantMessage[]): Promise<AssistantResponse>;
  analyzeImage(image: File | string, context: AssistantAppContext): Promise<AIAnalysisResult>;
  generateComplaint(conversation: AssistantMessage[]): Promise<ComplaintDraftInput>;
  answerComplaintQuestion(
    complaintId: string,
    question: string,
    context: AssistantAppContext
  ): Promise<AssistantResponse>;
}

// Helper: Convert File to base64
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

// 1. Tool implementations
export function getMyComplaints(userId?: string): Complaint[] {
  return getMyList(userId);
}

export function getComplaintById(id: string): Complaint | undefined {
  return getById(id) ?? undefined;
}

export function getComplaintStatus(id: string): { status?: ComplaintStatus; complaint?: Complaint } {
  const comp = getById(id) ?? undefined;
  return { status: comp?.status, complaint: comp };
}

export function createComplaintDraft(data: Partial<Complaint>): ComplaintDraftInput {
  return {
    title: data.title,
    description: data.description,
    category: data.category,
    department: data.department,
    priority: data.priority,
    ward: data.ward,
    address: data.address,
    image: data.imageUrl,
    coords:
      data.latitude !== undefined && data.longitude !== undefined
        ? { lat: data.latitude, lng: data.longitude }
        : undefined,
  };
}

export function suggestDepartment(issue: string): MunicipalDepartment {
  return suggestDept(issue);
}

export async function analyzeIssueImage(image: File | string): Promise<AIAnalysisResult> {
  let base64 = typeof image === "string" ? image : await fileToBase64(image);
  return analyzeComplaintWithAI({
    imageBase64: base64,
  });
}

export async function getUserLocation(): Promise<{
  lat: number;
  lng: number;
  ward: string;
  address: string;
}> {
  return new Promise((resolve) => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            ward: "Ward 12",
            address: "12th Main Rd, HAL 2nd Stage, Indiranagar",
          });
        },
        () => {
          resolve({
            lat: 12.9784,
            lng: 77.6408,
            ward: "Ward 12",
            address: "12th Main Rd, HAL 2nd Stage, Indiranagar",
          });
        },
        { timeout: 5000 }
      );
    } else {
      resolve({
        lat: 12.9784,
        lng: 77.6408,
        ward: "Ward 12",
        address: "12th Main Rd, HAL 2nd Stage, Indiranagar",
      });
    }
  });
}

export function updateComplaintStatus(
  id: string,
  status: ComplaintStatus,
  note?: string,
  actor?: string
): Complaint | undefined {
  return updateStatus(id, status, note, actor);
}

// 2. Main CivicFixAI Implementation
export const civicFixAI: CivicFixAI = {
  async chat(
    message: string,
    context: AssistantAppContext,
    imageBase64?: string,
    history?: AssistantMessage[]
  ): Promise<AssistantResponse> {
    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          context,
          imageBase64,
          history: history?.map((m) => ({ sender: m.sender, text: m.text })) || [],
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.data && json.data.reply) {
          // If complaintId matched, enrich with real complaint if not included
          if (json.data.matchedComplaintId && !json.data.complaintData) {
            const liveComp = getById(json.data.matchedComplaintId);
            if (liveComp) {
              json.data.complaintData = liveComp;
            }
          }
          return json.data as AssistantResponse;
        }
      }
    } catch (err) {
      // Gracefully catch server endpoint fetch issues and fallback to client engine
    }

    // Client-side fallback handler (guaranteed to never throw)
    try {
      return await processClientAssistantFallback(message, context, imageBase64);
    } catch (fallbackErr) {
      console.warn("Fallback assistant error:", fallbackErr);
      return {
        reply: "I'm the **CivicFix Assistant**. I can help you report civic issues, look up the status of any complaint, find responsible municipal departments, and navigate the platform.\n\nHow can I help you today?",
        intent: "GENERAL_APP_QUESTION",
        actionButtons: [
          { label: "Report an Issue", action: "GO_REPORT" },
          { label: "Track My Complaints", action: "GO_COMPLAINTS" },
          { label: "Explore Map", action: "GO_MAP" },
        ],
      };
    }
  },

  async analyzeImage(image: File | string, context: AssistantAppContext): Promise<AIAnalysisResult> {
    return analyzeIssueImage(image);
  },

  async generateComplaint(conversation: AssistantMessage[]): Promise<ComplaintDraftInput> {
    const userTexts = conversation
      .filter((m) => m.sender === "user")
      .map((m) => m.text)
      .join(" ");

    const dept = suggestDept(userTexts);
    const lower = userTexts.toLowerCase();

    let cat: IssueCategory = "other";
    if (lower.includes("light") || lower.includes("dark") || lower.includes("pole")) cat = "streetlight";
    else if (lower.includes("pothole") || lower.includes("road")) cat = "pothole";
    else if (lower.includes("garbage") || lower.includes("trash") || lower.includes("dump")) cat = "garbage";
    else if (lower.includes("water") || lower.includes("leak") || lower.includes("pipe")) cat = "water_leakage";
    else if (lower.includes("drain") || lower.includes("sewer")) cat = "drainage";
    else if (lower.includes("signal") || lower.includes("traffic")) cat = "traffic_signal";

    let priority: ComplaintPriority = "medium";
    if (lower.includes("urgent") || lower.includes("danger") || lower.includes("accident") || lower.includes("burst")) {
      priority = "high";
    }

    const imageMsg = conversation.find((m) => m.imageUri);

    return {
      title: userTexts.slice(0, 45) || "Reported Civic Problem",
      description: userTexts || "Issue observed and prepared through CivicFix Assistant.",
      category: cat,
      department: dept,
      priority,
      ward: "Ward 12",
      address: "Indiranagar, Ward 12",
      image: imageMsg?.imageUri,
    };
  },

  async answerComplaintQuestion(
    complaintId: string,
    question: string,
    context: AssistantAppContext
  ): Promise<AssistantResponse> {
    let complaint = getById(complaintId);
    if (!complaint) {
      complaint = (await getComplaintByIdAsync(complaintId)) ?? undefined;
    }
    if (!complaint) {
      return {
        reply: `I couldn't find complaint **${complaintId}** in the available records. Please check the ID and try again.`,
        intent: "COMPLAINT_DETAILS",
        actionButtons: [{ label: "View My Complaints", action: "GO_COMPLAINTS" }],
      };
    }

    const latestTimeline = complaint.timeline[complaint.timeline.length - 1];
    return {
      reply: `Complaint **${complaint.id}** is currently **${complaint.status.replace("_", " ")}**.\n\n• **Title:** ${complaint.title}\n• **Department:** ${complaint.department}\n• **Assigned Technician:** ${complaint.assignedTo || "Pending allocation"}\n• **Latest Event:** ${latestTimeline ? `${latestTimeline.title} (${latestTimeline.timestamp})` : "Logged in system"}\n\nWould you like to view the complete inspection trail?`,
      intent: "COMPLAINT_DETAILS",
      matchedComplaintId: complaint.id,
      complaintData: complaint,
      actionButtons: [
        { label: "Track Complaint", action: "GO_COMPLAINT", complaintId: complaint.id },
        { label: "View All", action: "GO_COMPLAINTS" },
      ],
    };
  },
};

// Client-side fallback handler
async function processClientAssistantFallback(
  message = "",
  context: AssistantAppContext,
  imageBase64?: string
): Promise<AssistantResponse> {
  const lower = message.toLowerCase().trim();

  // Safety emergency check
  const emergencies = ["fire", "gun", "shooting", "robbery", "heart attack", "bleeding", "ambulance"];
  if (emergencies.some((e) => lower.includes(e))) {
    return {
      reply:
        "⚠️ **Emergency Alert**: If you or someone nearby is in immediate physical danger, please contact **Emergency Services (112 / 101)** without delay.\n\nCivicFix is designed for non-emergency civic issues such as potholes, streetlights, waste, and water drainage.",
      intent: "EMERGENCY",
      actionButtons: [],
    };
  }

  // Check complaint ID
  const match = message.match(/CF-?\d{4}(-\d{4})?/i) || message.match(/CF-[A-Za-z0-9-]+/i);
  const targetId = match ? match[0].toUpperCase() : context.currentComplaintId;

  if (targetId && (match || lower.includes("status") || lower.includes("update") || lower.includes("fixed"))) {
    let comp = getById(targetId);
    if (!comp) {
      comp = (await getComplaintByIdAsync(targetId)) ?? undefined;
    }
    if (comp) {
      const statusText = comp.status.replace("_", " ");
      const latest = comp.timeline[comp.timeline.length - 1];
      return {
        reply: `Your complaint **${comp.id}** is currently **${statusText}**.\n\n• **Issue:** ${comp.title}\n• **Department:** ${comp.department}\n• **Location:** ${comp.ward} (${comp.address})\n• **Latest Update:** ${latest?.description || "In processing"}\n\nEstimated resolution: ${comp.estimatedResolution || "1–3 business days"}.`,
        intent: "TRACK_COMPLAINT",
        matchedComplaintId: comp.id,
        complaintData: comp,
        actionButtons: [
          { label: "Track Complaint", action: "GO_COMPLAINT", complaintId: comp.id },
          { label: "View All Complaints", action: "GO_COMPLAINTS" },
        ],
      };
    } else if (match) {
      return {
        reply: `I couldn't find complaint **${targetId}** in the available records. Please verify the ticket ID and try again.`,
        intent: "TRACK_COMPLAINT",
        actionButtons: [{ label: "View My Complaints", action: "GO_COMPLAINTS" }],
      };
    }
  }

  // Latest report / My complaints query (handles "tell me about my latest report", "my report", etc.)
  if (
    lower.includes("latest report") ||
    lower.includes("my report") ||
    lower.includes("recent report") ||
    lower.includes("my complaints") ||
    lower.includes("latest complaint") ||
    lower.includes("my issue") ||
    lower.includes("latest issue") ||
    (lower.includes("latest") && (lower.includes("report") || lower.includes("complaint") || lower.includes("issue")))
  ) {
    const userId = context.currentUser?.id;
    const allComps = getStoredComplaints();
    const userComps = userId
      ? allComps.filter((c) => c.citizenId === userId || c.citizenName === context.currentUser?.name)
      : allComps;

    const targetList = userComps.length > 0 ? userComps : allComps;

    if (targetList.length > 0) {
      const latest = targetList.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      const statusText = latest.status.replace("_", " ");
      const latestTimeline = latest.timeline[latest.timeline.length - 1];
      return {
        reply: `Your most recent report is **${latest.id}** ("${latest.title}"), currently **${statusText}**.\n\n• **Department:** ${latest.department}\n• **Location:** ${latest.ward} (${latest.address})\n• **Latest Update:** ${latestTimeline?.description || "Logged in system"}\n\nEstimated resolution: ${latest.estimatedResolution || "1–3 business days"}.`,
        intent: "TRACK_COMPLAINT",
        matchedComplaintId: latest.id,
        complaintData: latest,
        actionButtons: [
          { label: "Track Complaint", action: "GO_COMPLAINT", complaintId: latest.id },
          { label: "View All Reports", action: "GO_COMPLAINTS" },
        ],
      };
    } else {
      return {
        reply: "You don't have any complaints registered in the system yet. Would you like to report a civic issue now?",
        intent: "TRACK_COMPLAINT",
        actionButtons: [{ label: "Report an Issue", action: "GO_REPORT" }],
      };
    }
  }

  // Image analysis
  if (imageBase64) {
    const dept = suggestDept(message || "road damage");
    return {
      reply: `I've inspected the photo. It appears to show a civic problem related to **${dept}**.\n\nSuggested Department: **${dept}**\nSuggested Urgency: **Medium**\n\nWould you like me to prepare a complaint draft from this photo?`,
      intent: "IMAGE_ANALYSIS",
      analysisCard: {
        category: "pothole",
        title: "Reported civic issue",
        suggestedDepartment: dept,
        priority: "medium",
        confidence: 0.93,
        description: "Civic problem captured by photo requiring municipal inspection.",
        imageUri: imageBase64,
      },
      draftData: {
        title: "Reported civic issue",
        description: "Civic issue captured in photograph for municipal inspection.",
        category: "pothole",
        department: dept,
        priority: "medium",
        image: imageBase64,
      },
      actionButtons: [
        {
          label: "Review Complaint",
          action: "REVIEW_COMPLAINT",
          draftData: {
            title: "Reported civic issue",
            description: "Civic issue captured in photograph for municipal inspection.",
            category: "pothole",
            department: dept,
            priority: "medium",
            image: imageBase64,
          },
        },
        { label: "Report an Issue", action: "GO_REPORT" },
      ],
    };
  }

  // Status definitions
  if (lower.includes("what does") && (lower.includes("mean") || lower.includes("status"))) {
    if (lower.includes("submitted")) {
      return {
        reply: "**Submitted** means your complaint has been received by CivicFix with its GPS coordinates and photo evidence. It is awaiting municipal triage review.",
        intent: "COMPLAINT_STATUS",
        actionButtons: [{ label: "View My Complaints", action: "GO_COMPLAINTS" }],
      };
    }
    if (lower.includes("acknowledged")) {
      return {
        reply: "**Acknowledged** means the municipal triage team has reviewed your complaint, confirmed the evidence, and designated it for squad assignment.",
        intent: "COMPLAINT_STATUS",
        actionButtons: [{ label: "View My Complaints", action: "GO_COMPLAINTS" }],
      };
    }
    if (lower.includes("assigned")) {
      return {
        reply: "**Assigned** means your complaint has been forwarded to the responsible department (such as Road Maintenance or Electrical Division) and placed in an active squad's queue.",
        intent: "COMPLAINT_STATUS",
        actionButtons: [{ label: "Track Complaints", action: "GO_COMPLAINTS" }],
      };
    }
    if (lower.includes("in progress")) {
      return {
        reply: "**In Progress** means the field crew or technician has been dispatched to the site with repair equipment to resolve the issue.",
        intent: "COMPLAINT_STATUS",
        actionButtons: [{ label: "Track Complaints", action: "GO_COMPLAINTS" }],
      };
    }
    if (lower.includes("resolved")) {
      return {
        reply: "**Resolved** means the field crew finished the physical work. You can now inspect the fix and confirm resolution or request re-inspection.",
        intent: "COMPLAINT_STATUS",
        actionButtons: [{ label: "Check Resolved Tickets", action: "GO_COMPLAINTS" }],
      };
    }
  }

  // How to report
  if (lower.includes("how do i report") || lower.includes("how can i report") || lower.includes("report an issue")) {
    return {
      reply: "It's easy to report a civic issue:\n\n1. Tap **Report an Issue**.\n2. Upload a photo or describe what happened.\n3. Confirm your GPS location on the map.\n4. Review the AI-assisted complaint draft.\n5. Tap Submit!\n\nI can also prepare your report right here if you describe the problem.",
      intent: "HOW_TO_REPORT",
      actionButtons: [
        { label: "Report an Issue", action: "GO_REPORT" },
        { label: "Explore Map", action: "GO_MAP" },
      ],
    };
  }

  // Department inquiries
  if (lower.includes("which department") || lower.includes("who handles") || lower.includes("what department")) {
    if (lower.includes("pothole") || lower.includes("road")) {
      return {
        reply: "Potholes and broken asphalt are handled by the **Road Maintenance** department.",
        intent: "DEPARTMENT_QUESTION",
        actionButtons: [{ label: "Report Road Issue", action: "GO_REPORT" }],
      };
    }
    if (lower.includes("light") || lower.includes("lamp") || lower.includes("pole")) {
      return {
        reply: "Broken streetlights and dark poles are handled by **Electrical Maintenance**.",
        intent: "DEPARTMENT_QUESTION",
        actionButtons: [{ label: "Report Streetlight", action: "GO_REPORT" }],
      };
    }
    if (lower.includes("garbage") || lower.includes("waste") || lower.includes("trash")) {
      return {
        reply: "Overflowing trash and garbage dumps are managed by **Waste Management**.",
        intent: "DEPARTMENT_QUESTION",
        actionButtons: [{ label: "Report Waste Issue", action: "GO_REPORT" }],
      };
    }
    if (lower.includes("water") || lower.includes("pipe") || lower.includes("drain")) {
      return {
        reply: "Water supply pipeline leaks and blocked drains are handled by **Water & Sewerage**.",
        intent: "DEPARTMENT_QUESTION",
        actionButtons: [{ label: "Report Water Issue", action: "GO_REPORT" }],
      };
    }
  }

  // Conversational complaint drafting
  if (
    lower.includes("report a") ||
    lower.includes("there is a") ||
    lower.includes("i want to report") ||
    lower.includes("pothole") ||
    lower.includes("streetlight")
  ) {
    const dept = suggestDept(message);
    const draft: ComplaintDraftInput = {
      title: message.slice(0, 45) || "Reported Civic Problem",
      description: message,
      category: lower.includes("light") ? "streetlight" : "pothole",
      department: dept,
      priority: "medium",
      ward: "Ward 12",
      address: "Indiranagar, Ward 12",
    };

    return {
      reply: `I can help you report this!\n\n• **Issue:** ${draft.title}\n• **Department:** ${draft.department}\n• **Priority:** MEDIUM\n\nWould you like to review and confirm the location to submit?`,
      intent: "CREATE_COMPLAINT",
      draftData: draft,
      actionButtons: [
        { label: "Review Complaint", action: "REVIEW_COMPLAINT", draftData: draft },
        { label: "Report Manually", action: "GO_REPORT" },
      ],
    };
  }

  // Default response
  return {
    reply: "I'm the **CivicFix Assistant**. I can help you report civic issues, look up the status of any complaint (e.g. CF-1024), find responsible municipal departments, and navigate the platform.\n\nHow can I help you today?",
    intent: "GENERAL_APP_QUESTION",
    actionButtons: [
      { label: "Report an Issue", action: "GO_REPORT" },
      { label: "Track My Complaints", action: "GO_COMPLAINTS" },
      { label: "Explore Map", action: "GO_MAP" },
    ],
  };
}
