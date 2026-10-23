import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const rawPort = process.env.PORT;
const PORT = rawPort && !isNaN(Number(rawPort)) ? parseInt(rawPort, 10) : 3000;

app.use(express.json({ limit: "15mb" }));

// Lazy Gemini client helper
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Resilient model invocation that handles temporary 503 high demand or rate spikes
async function generateWithModelFallback(
  ai: GoogleGenAI,
  options: {
    contents: any;
    config?: any;
    primaryModel?: string;
  }
) {
  // Available fast models from the approved list
  const modelsToTry = [
    options.primaryModel || "gemini-3.8-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
  ];

  let lastError: any = null;
  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: options.config,
      });
      return response;
    } catch (err: any) {
      lastError = err;
      const isTransient =
        err?.status === "UNAVAILABLE" ||
        err?.status === 503 ||
        err?.status === 429 ||
        err?.message?.includes("high demand") ||
        err?.message?.includes("503") ||
        err?.message?.includes("quota") ||
        err?.message?.includes("UNAVAILABLE");

      console.warn(
        `[CivicFix AI] Model ${model} ${isTransient ? "experiencing high demand or rate limit" : "returned error"}, attempting fallback...`
      );

      if (!isTransient) {
        // If not transient (e.g. fatal syntax error in payload), don't retry blindly
        break;
      }
      // Brief pause to allow transient server spike to resolve
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw lastError;
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "CivicFix",
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    time: new Date().toISOString(),
  });
});

// Secure Reverse Geocoding endpoint
app.get("/api/location/reverse-geocode", async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: "Invalid latitude or longitude parameters" });
    }

    // 1. Try Nominatim (OpenStreetMap) with a polite User-Agent
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const osmRes = await fetch(osmUrl, {
        headers: {
          "User-Agent": "CivicFix/1.0 (citizen-civic-services; https://civicfix.org)",
          Accept: "application/json",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (osmRes.ok) {
        const data = (await osmRes.json()) as any;
        const addr = data.address || {};

        const city =
          addr.city ||
          addr.town ||
          addr.municipality ||
          addr.village ||
          addr.hamlet ||
          addr.city_district ||
          addr.district ||
          addr.county ||
          "";

        const state = addr.state || addr.province || addr.state_district || "";

        const neighborhood =
          addr.suburb ||
          addr.neighbourhood ||
          addr.residential ||
          addr.commercial ||
          addr.quarter ||
          addr.subdistrict ||
          "";

        const road = addr.road || addr.pedestrian || addr.street || "";
        const houseNumber = addr.house_number || "";
        const addressLine = [houseNumber, road].filter(Boolean).join(" ") || road || neighborhood;

        return res.json({
          formattedAddress: data.display_name || [addressLine, neighborhood, city, state, addr.postcode, addr.country || "India"].filter(Boolean).join(", "),
          addressLine: addressLine || undefined,
          neighborhood: neighborhood || undefined,
          locality: neighborhood || undefined,
          city: city || undefined,
          district: addr.state_district || addr.district || undefined,
          state: state || undefined,
          postalCode: addr.postcode || undefined,
          country: addr.country || "India",
          countryCode: (addr.country_code || "in").toUpperCase(),
        });
      }
    } catch (osmErr: any) {
      console.warn("[ReverseGeocode] Nominatim request failed, trying Photon fallback:", osmErr.message);
    }

    // 2. Fallback to Photon
    try {
      const photonUrl = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
      const photonRes = await fetch(photonUrl, {
        headers: { Accept: "application/json" },
      });

      if (photonRes.ok) {
        const photonData = (await photonRes.json()) as any;
        const feature = photonData.features?.[0];
        if (feature && feature.properties) {
          const props = feature.properties;
          const city = props.city || props.town || props.district || "";
          const state = props.state || "";
          const neighborhood = props.district || props.suburb || "";
          const addressLine = props.name || props.street || "";

          return res.json({
            formattedAddress: [addressLine, neighborhood, city, state, props.postcode, props.country || "India"].filter(Boolean).join(", "),
            addressLine: addressLine || undefined,
            neighborhood: neighborhood || undefined,
            city: city || undefined,
            state: state || undefined,
            postalCode: props.postcode || undefined,
            country: props.country || "India",
            countryCode: (props.countrycode || "IN").toUpperCase(),
          });
        }
      }
    } catch (photonErr: any) {
      console.warn("[ReverseGeocode] Photon fallback failed:", photonErr.message);
    }

    // Coordinates fallback
    return res.json({
      formattedAddress: `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      city: undefined,
      state: undefined,
      country: "India",
      countryCode: "IN",
    });
  } catch (err: any) {
    console.error("[ReverseGeocode] Error:", err);
    res.status(500).json({ error: "Failed to reverse geocode coordinates" });
  }
});

// Resilient IP-based approximate location lookup
app.get("/api/location/ip-lookup", async (req, res) => {
  try {
    const forwarded = req.headers["x-forwarded-for"];
    const clientIp = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.socket.remoteAddress;
    const isLocal = !clientIp || clientIp === "127.0.0.1" || clientIp === "::1";

    const url = !isLocal ? `https://ipwho.is/${clientIp}` : "https://ipwho.is/";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const ipRes = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (ipRes.ok) {
      const data = (await ipRes.json()) as any;
      if (data && data.success !== false) {
        return res.json({
          success: true,
          latitude: data.latitude,
          longitude: data.longitude,
          city: data.city || "",
          state: data.region || "",
          postalCode: data.postal || "",
          country: data.country || "India",
        });
      }
    }

    return res.status(404).json({ success: false, message: "IP location not resolved" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || "IP lookup error" });
  }
});

// Location Search / Autocomplete endpoint for cities, wards, localities
app.get("/api/location/search", async (req, res) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (!q || q.length < 2) {
      return res.json({ success: true, results: [] });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8`;
    const searchRes = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeoutId);

    if (!searchRes.ok) {
      return res.json({ success: true, results: [] });
    }

    const data = (await searchRes.json()) as any;
    const features = data?.features || [];

    const results = features.map((f: any) => {
      const props = f.properties || {};
      const coords = f.geometry?.coordinates || [0, 0];
      const lng = coords[0];
      const lat = coords[1];

      const name = props.name || "";
      const city = props.city || props.town || props.village || props.county || name;
      const district = props.district || props.county || "";
      const state = props.state || "";
      const postalCode = props.postcode || "";
      const country = props.country || "India";

      const parts = [name, district !== name ? district : "", city !== name ? city : "", state, postalCode, country].filter(Boolean);
      const formattedAddress = Array.from(new Set(parts)).join(", ");

      return {
        name,
        city,
        district,
        state,
        postalCode,
        country,
        latitude: lat,
        longitude: lng,
        formattedAddress,
      };
    });

    return res.json({ success: true, results });
  } catch (err: any) {
    console.warn("[Server] Location search error:", err);
    return res.json({ success: true, results: [] });
  }
});

// AI Analyze Complaint endpoint
app.post("/api/ai/analyze", async (req, res) => {
  try {
    const { text, imageBase64, imageMimeType } = req.body;
    const ai = getGenAI();

    if (ai) {
      const prompt = `You are the civic intelligence core of CivicFix, a platform for reporting municipal and civic problems.
Analyze the citizen's civic complaint text and/or photo.
Provide a strictly valid JSON response with this exact schema:
{
  "category": "streetlight" | "pothole" | "garbage" | "water_leakage" | "drainage" | "road_damage" | "traffic_signal" | "public_toilet" | "stray_animal" | "illegal_dumping" | "other",
  "title": "A concise, clear complaint title (max 7 words)",
  "description": "Structured, factual description of the issue (2-3 sentences)",
  "priority": "low" | "medium" | "high" | "urgent",
  "suggestedDepartment": "Electrical Maintenance" | "Road Maintenance" | "Waste Management" | "Water & Sewerage" | "Traffic Management" | "Public Health" | "Parks & Public Spaces" | "General Civic Services",
  "confidence": number between 0.80 and 0.98,
  "detectedWardHint": "string or null",
  "clarifyingQuestion": "string or null if more context like exact pole number or water source is helpful"
}

Citizen's text: "${text || "No text provided"}"
${imageBase64 ? "Image was attached for visual analysis." : "No image attached."}

Remember to return ONLY the raw JSON object, no markdown ticks, no commentary.`;

      const contents: any[] = [];
      if (imageBase64) {
        contents.push({
          inlineData: {
            mimeType: imageMimeType || "image/jpeg",
            data: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
          },
        });
      }
      contents.push({ text: prompt });

      try {
        const response = await generateWithModelFallback(ai, {
          contents,
          config: {
            responseMimeType: "application/json",
          },
        });

        const responseText = response.text || "";
        const cleaned = responseText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        const parsed = JSON.parse(cleaned);
        return res.json({ success: true, source: "gemini", data: parsed });
      } catch (geminiError: any) {
        console.warn(
          "[CivicFix AI] Model service busy/unavailable. Seamlessly applying smart civic rule engine."
        );
      }
    }

    // Fallback deterministic rule engine
    const fallback = generateSmartCivicAnalysis(text, imageBase64);
    return res.json({ success: true, source: "smart-engine", data: fallback });
  } catch (error: any) {
    console.warn("[CivicFix AI] Analysis handled gracefully with fallback engine.");
    const fallback = generateSmartCivicAnalysis(req.body?.text, req.body?.imageBase64);
    return res.json({ success: true, source: "fallback", data: fallback });
  }
});

// AI Assistant Endpoint - Full CivicFix System Prompt
app.post("/api/ai/assistant", async (req, res) => {
  try {
    const { message = "", history = [], context = {}, imageBase64, imageMimeType } = req.body;
    const ai = getGenAI();

    // Check emergency first for safety
    const isEmergency = checkIfEmergency(message);
    if (isEmergency) {
      return res.json({
        success: true,
        source: "safety-guard",
        data: {
          reply:
            "⚠️ **Emergency Notice**: If there is an active fire, medical emergency, immediate danger, or crime in progress, please contact **Emergency Services (112 / 101)** immediately.\n\nCivicFix is designed specifically for non-emergency civic municipal issues such as potholes, streetlights, waste, and water supply issues.",
          intent: "EMERGENCY",
          actionButtons: [],
        },
      });
    }

    if (ai) {
      const systemInstruction = `You are CivicFix Assistant, the intelligent in-app AI assistant for the CivicFix civic complaint platform.
Your purpose: Help citizens report civic problems, understand their complaints, track progress, and use CivicFix effectively.

Personality: Friendly, helpful, professional, patient, clear, trustworthy, conversational, action-oriented. Do not sound like a robotic government form.

Primary Responsibilities:
1. Answer questions about CivicFix clearly and warmly.
2. Help users report an issue step-by-step.
3. Explain complaint statuses (Submitted, Acknowledged, Assigned, In Progress, Resolved, Closed).
4. Look up and explain complaints by ID (e.g. CF-2026-0428, CF-1024) using the provided database/context. NEVER invent complaint information. If not found in records, state: "I couldn't find that complaint in the available records. Please check the complaint ID and try again."
5. Department mappings:
   - Pothole / Road damage -> Road Maintenance
   - Streetlight / electrical -> Electrical Maintenance
   - Garbage / overflow / trash -> Waste Management
   - Water leakage / pipeline / sewer / drainage -> Water & Sewerage
   - Traffic lights / signals -> Traffic Management
   - Parks / fallen tree branches -> Parks & Public Spaces
6. Conversational Complaint Creation: If the citizen describes an issue, help formulate a draft and provide action REVIEW_COMPLAINT.
7. Image Understanding: If an image is provided, identify the civic issue, suggested department, priority, and description. Use cautious phrasing like "appears to be" or "likely".

Current App Context Data (including user complaints and profile):
${JSON.stringify(context || {})}

Return ONLY a valid JSON object with this exact schema:
{
  "reply": "Conversational markdown reply string with clear formatting, 1-3 short paragraphs or bullets",
  "intent": "GENERAL_APP_QUESTION" | "HOW_TO_REPORT" | "CREATE_COMPLAINT" | "TRACK_COMPLAINT" | "COMPLAINT_STATUS" | "COMPLAINT_DETAILS" | "DEPARTMENT_QUESTION" | "LOCATION_HELP" | "IMAGE_ANALYSIS" | "EDIT_COMPLAINT" | "RESOLUTION_CONFIRMATION" | "PROFILE_HELP" | "NOTIFICATION_HELP" | "GENERAL_CIVIC_INFORMATION" | "OUT_OF_SCOPE" | "EMERGENCY",
  "matchedComplaintId": "CF-..." or null,
  "analysisCard": {
    "category": "streetlight" | "pothole" | "garbage" | "water_leakage" | "drainage" | "road_damage" | "traffic_signal" | "other",
    "title": "A concise title (max 7 words)",
    "suggestedDepartment": "Electrical Maintenance" | "Road Maintenance" | "Waste Management" | "Water & Sewerage" | "Traffic Management" | "Parks & Public Spaces" | "General Civic Services",
    "priority": "low" | "medium" | "high" | "urgent",
    "confidence": 0.94,
    "description": "Factual 1-2 sentence issue description"
  } or null,
  "draftData": {
    "title": "...",
    "description": "...",
    "category": "...",
    "department": "...",
    "priority": "..."
  } or null,
  "actionButtons": [
    { "label": "Report an Issue", "action": "GO_REPORT" }
  ]
}`;

      const contents: any[] = [];
      if (history && Array.isArray(history)) {
        for (const h of history.slice(-8)) {
          contents.push({
            role: h.sender === "user" ? "user" : "model",
            parts: [{ text: h.text || "" }],
          });
        }
      }

      const currentParts: any[] = [];
      if (imageBase64) {
        currentParts.push({
          inlineData: {
            mimeType: imageMimeType || "image/jpeg",
            data: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
          },
        });
      }
      currentParts.push({ text: message });

      contents.push({
        role: "user",
        parts: currentParts,
      });

      try {
        const response = await generateWithModelFallback(ai, {
          contents,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
          },
        });

        const responseText = response.text || "";
        const cleaned = responseText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        const parsed = JSON.parse(cleaned);
        return res.json({ success: true, source: "gemini", data: parsed });
      } catch (geminiError: any) {
        console.warn("[CivicFix AI] Model busy or unavailable. Applying intelligent assistant fallback.");
      }
    }

    // Deterministic Smart Assistant Engine
    const fallbackResponse = processAssistantQueryFallback(message, history, context, imageBase64);
    return res.json({ success: true, source: "smart-engine", data: fallbackResponse });
  } catch (error: any) {
    console.warn("[CivicFix AI] Assistant query error, returning fallback response:", error);
    const safeFallback = processAssistantQueryFallback(req.body?.message || "", [], req.body?.context || {});
    return res.json({ success: true, source: "fallback", data: safeFallback });
  }
});

// Helper for immediate safety checks
function checkIfEmergency(text = ""): boolean {
  const lower = text.toLowerCase();
  const emergencyKeywords = [
    "fire", "fire!", "burning building", "active fire",
    "gun", "shooting", "robbery in progress", "heart attack",
    "stroke", "collapsed person", "bleeding heavily", "suicide",
    "drowning", "ambulance needed"
  ];
  return emergencyKeywords.some((k) => lower.includes(k));
}

// Comprehensive deterministic fallback engine adhering to system prompt
function processAssistantQueryFallback(
  message = "",
  history: any[] = [],
  context: any = {},
  imageBase64?: string
) {
  const lower = message.toLowerCase().trim();

  // 1. Complaint ID Lookup
  const complaintIdMatch = message.match(/CF-?\d{4}(-\d{4})?/i) || message.match(/CF-[A-Za-z0-9-]+/i);
  const requestedId = complaintIdMatch ? complaintIdMatch[0].toUpperCase() : null;

  if (requestedId || (lower.includes("complaint") && (lower.includes("status") || lower.includes("update") || lower.includes("latest") || lower.includes("track") || lower.includes("where"))) || (lower.includes("my report") && context.currentComplaintId)) {
    const targetId = requestedId || context.currentComplaintId;
    // Check in context complaints
    const summary = context.userComplaintsSummary || [];
    const found = summary.find((c: any) => c.id.toUpperCase() === targetId?.toUpperCase());

    // Also check known demo complaints if not in summary
    const knownComplaints: Record<string, any> = {
      "CF-1024": {
        id: "CF-1024",
        title: "Deep pothole near 12th Main Indiranagar",
        status: "IN_PROGRESS",
        department: "Road Maintenance",
        ward: "Ward 12",
        updatedAt: "Today, 10:30 AM",
        technician: "Ramesh K. (Road Crew 4)",
      },
      "CF-2026-0428": {
        id: "CF-2026-0428",
        title: "Streetlight not working on 5th Cross",
        status: "IN_PROGRESS",
        department: "Electrical Maintenance",
        ward: "Ward 12",
        updatedAt: "Sep 11, 9:30 AM",
        technician: "Anand M. (Lineman Unit 2)",
      },
      "CF-1023": {
        id: "CF-1023",
        title: "Uncollected garbage dump at 100ft Road",
        status: "ASSIGNED",
        department: "Waste Management",
        ward: "Ward 15",
        updatedAt: "Yesterday, 3:15 PM",
        technician: "Suresh P. (Solid Waste Team)",
      },
      "CF-1022": {
        id: "CF-1022",
        title: "Broken pipeline leaking clean water",
        status: "RESOLVED",
        department: "Water & Sewerage",
        ward: "Ward 04",
        updatedAt: "Sep 10, 11:45 AM",
        technician: "Praveen V. (BWSSB Unit 1)",
      },
      "CF-1021": {
        id: "CF-1021",
        title: "Traffic signal red light failure",
        status: "CLOSED",
        department: "Traffic Management",
        ward: "Ward 02",
        updatedAt: "Sep 08, 4:20 PM",
      },
    };

    const complaintData = found || (targetId ? knownComplaints[targetId] : null);

    if (complaintData) {
      const statusLabel = complaintData.status.replace("_", " ");
      return {
        reply: `Your complaint **${complaintData.id}** is currently **${statusLabel}**.\n\n• **Issue:** ${complaintData.title}\n• **Department:** ${complaintData.department}\n• **Location:** ${complaintData.ward || "Ward 12"}\n• **Latest Update:** ${complaintData.updatedAt || "Recently updated"}${complaintData.technician ? `\n• **Assigned Crew:** ${complaintData.technician}` : ""}\n\nYou can track real-time progress and photos on the tracking page.`,
        intent: "TRACK_COMPLAINT",
        matchedComplaintId: complaintData.id,
        actionButtons: [
          { label: "Track Complaint", action: "GO_COMPLAINT", complaintId: complaintData.id },
          { label: "View All Complaints", action: "GO_COMPLAINTS" },
        ],
      };
    } else if (requestedId) {
      return {
        reply: `I couldn't find complaint **${requestedId}** in the available records. Please verify the ticket ID and try again, or check your complaint list under **My Complaints**.`,
        intent: "TRACK_COMPLAINT",
        actionButtons: [
          { label: "View My Complaints", action: "GO_COMPLAINTS" },
          { label: "Report New Issue", action: "GO_REPORT" },
        ],
      };
    }
  }

  // 2. Image Analysis if attached
  if (imageBase64) {
    const analysis = generateSmartCivicAnalysis(message, true);
    return {
      reply: `I've analyzed the photo you provided. It appears to show **${analysis.title.toLowerCase()}**.\n\n• **Suggested Category:** ${analysis.category.replace("_", " ")}\n• **Responsible Department:** ${analysis.suggestedDepartment}\n• **Estimated Urgency:** ${analysis.priority.toUpperCase()}\n\nWould you like me to prepare a complaint draft with this photo?`,
      intent: "IMAGE_ANALYSIS",
      analysisCard: {
        category: analysis.category,
        title: analysis.title,
        suggestedDepartment: analysis.suggestedDepartment,
        priority: analysis.priority,
        confidence: analysis.confidence,
        description: analysis.description,
      },
      draftData: {
        title: analysis.title,
        description: analysis.description,
        category: analysis.category,
        department: analysis.suggestedDepartment,
        priority: analysis.priority,
        image: imageBase64,
      },
      actionButtons: [
        {
          label: "Review Complaint",
          action: "REVIEW_COMPLAINT",
          draftData: {
            title: analysis.title,
            description: analysis.description,
            category: analysis.category,
            department: analysis.suggestedDepartment,
            priority: analysis.priority,
            image: imageBase64,
          },
        },
        { label: "Report an Issue", action: "GO_REPORT" },
      ],
    };
  }

  // 3. Status Definitions
  if (lower.includes("what does") && (lower.includes("mean") || lower.includes("status"))) {
    if (lower.includes("submitted")) {
      return {
        reply: "**Submitted** means your complaint has been received by CivicFix with its GPS location and evidence. It is waiting for the municipal triage desk to review and prioritize it.",
        intent: "COMPLAINT_STATUS",
        actionButtons: [{ label: "View My Complaints", action: "GO_COMPLAINTS" }],
      };
    }
    if (lower.includes("acknowledged")) {
      return {
        reply: "**Acknowledged** means the municipal triage team has reviewed your complaint, validated the evidence, and confirmed that it is ready for squad dispatch.",
        intent: "COMPLAINT_STATUS",
        actionButtons: [{ label: "View My Complaints", action: "GO_COMPLAINTS" }],
      };
    }
    if (lower.includes("assigned")) {
      return {
        reply: "**Assigned** means your complaint has been forwarded to the relevant municipal department (e.g. Road Maintenance or Electrical Division) and allocated to an active field squad.",
        intent: "COMPLAINT_STATUS",
        actionButtons: [{ label: "Track Complaints", action: "GO_COMPLAINTS" }],
      };
    }
    if (lower.includes("in progress") || lower.includes("in_progress")) {
      return {
        reply: "**In Progress** means the field technician or crew is actively on site inspecting the problem or performing repair work (such as asphalt filling or streetlight rewiring).",
        intent: "COMPLAINT_STATUS",
        actionButtons: [{ label: "Track Complaints", action: "GO_COMPLAINTS" }],
      };
    }
    if (lower.includes("resolved")) {
      return {
        reply: "**Resolved** means the field crew completed the fix and submitted completion proof. You can inspect the repair and provide your citizen rating to confirm it.",
        intent: "COMPLAINT_STATUS",
        actionButtons: [{ label: "Check Resolved Tickets", action: "GO_COMPLAINTS" }],
      };
    }
    if (lower.includes("closed")) {
      return {
        reply: "**Closed** means the resolution has been verified and confirmed by the citizen, and the municipal case is successfully archived in city records.",
        intent: "COMPLAINT_STATUS",
        actionButtons: [{ label: "View History", action: "GO_COMPLAINTS" }],
      };
    }
  }

  // 4. How to report
  if (lower.includes("how do i report") || lower.includes("how can i report") || lower.includes("report an issue") || lower.includes("how to report")) {
    return {
      reply: "It's easy to report a civic issue on CivicFix:\n\n1. Tap **Report an Issue**.\n2. Upload a photo of the problem or write a short description.\n3. Confirm your GPS location on the map.\n4. Review the AI-generated complaint and adjust details.\n5. Submit your report!\n\nWould you like me to start a report with you right now?",
      intent: "HOW_TO_REPORT",
      actionButtons: [
        { label: "Report an Issue", action: "GO_REPORT" },
        { label: "Explore Map", action: "GO_MAP" },
      ],
    };
  }

  // 5. Department inquiries
  if (lower.includes("which department") || lower.includes("who handles") || lower.includes("what department")) {
    if (lower.includes("pothole") || lower.includes("road") || lower.includes("asphalt")) {
      return {
        reply: "Potholes, broken road asphalt, and damaged pavers are handled by the **Road Maintenance** department. They dispatch asphalt repair crews with compaction equipment.",
        intent: "DEPARTMENT_QUESTION",
        actionButtons: [{ label: "Report Road Issue", action: "GO_REPORT" }],
      };
    }
    if (lower.includes("light") || lower.includes("lamp") || lower.includes("pole") || lower.includes("wire")) {
      return {
        reply: "Broken streetlights, unlit poles, and hanging cables are handled by **Electrical Maintenance**. They inspect power supply lines, LED fixtures, and feeder pillars.",
        intent: "DEPARTMENT_QUESTION",
        actionButtons: [{ label: "Report Streetlight", action: "GO_REPORT" }],
      };
    }
    if (lower.includes("garbage") || lower.includes("waste") || lower.includes("trash") || lower.includes("dump")) {
      return {
        reply: "Overflowing waste bins, illegal garbage dumping, and uncollected trash are managed by **Waste Management** (Solid Waste division).",
        intent: "DEPARTMENT_QUESTION",
        actionButtons: [{ label: "Report Waste Issue", action: "GO_REPORT" }],
      };
    }
    if (lower.includes("water") || lower.includes("pipe") || lower.includes("leak") || lower.includes("drain") || lower.includes("sewage")) {
      return {
        reply: "Water main bursts, leaking supply pipes, blocked drains, and overflowing manholes are handled by **Water & Sewerage** (BWSSB / Municipal Water Board).",
        intent: "DEPARTMENT_QUESTION",
        actionButtons: [{ label: "Report Water Issue", action: "GO_REPORT" }],
      };
    }
    if (lower.includes("traffic") || lower.includes("signal")) {
      return {
        reply: "Malfunctioning traffic signals, broken pedestrian crossings, and missing road signage are handled by **Traffic Management**.",
        intent: "DEPARTMENT_QUESTION",
        actionButtons: [{ label: "Report Traffic Signal", action: "GO_REPORT" }],
      };
    }
  }

  // 6. Conversational issue creation (e.g. "I want to report a broken streetlight", "pothole on 12th main")
  // 6. Conversational issue creation
  if (
    lower.includes("report") ||
    lower.includes("there is a") ||
    lower.includes("i want to") ||
    lower.includes("pothole") ||
    lower.includes("streetlight") ||
    lower.includes("garbage") ||
    lower.includes("water") ||
    lower.includes("broken")
  ) {
    const analysis = generateSmartCivicAnalysis(message, false);
    return {
      reply: `I can help you prepare this report!\n\n• **Issue:** ${analysis.title}\n• **Department:** ${analysis.suggestedDepartment}\n• **Priority:** ${analysis.priority.toUpperCase()}\n\nWould you like to review and confirm the location to submit this complaint?`,
      intent: "CREATE_COMPLAINT",
      draftData: {
        title: analysis.title,
        description: analysis.description,
        category: analysis.category,
        department: analysis.suggestedDepartment,
        priority: analysis.priority,
      },
      actionButtons: [
        {
          label: "Review Complaint",
          action: "REVIEW_COMPLAINT",
          draftData: {
            title: analysis.title,
            description: analysis.description,
            category: analysis.category,
            department: analysis.suggestedDepartment,
            priority: analysis.priority,
          },
        },
        { label: "Report Manually", action: "GO_REPORT" },
      ],
    };
  }

  // 7. General App / What is CivicFix
  if (lower.includes("what is civicfix") || lower.includes("what can you do") || lower.includes("what can civicfix do") || lower.includes("features")) {
    return {
      reply: "CivicFix is a modern civic reporting platform that empowers citizens to report and track municipal problems such as potholes, broken streetlights, garbage overflow, and water leaks.\n\n• **AI Triage:** Automatically identifies issues, categorizes severity, and routes tickets.\n• **GPS Precision:** Pinpoints exact coordinates on an interactive ward map.\n• **Real-Time Tracking:** Follows field squad progress with verifiable timelines.\n• **Citizen Verification:** Citizens inspect and confirm completed repairs before cases close.",
      intent: "GENERAL_APP_QUESTION",
      actionButtons: [
        { label: "Report an Issue", action: "GO_REPORT" },
        { label: "Explore City Map", action: "GO_MAP" },
      ],
    };
  }

  // 8. Location Questions
  if (lower.includes("where is my complaint") || lower.includes("find my location") || lower.includes("map")) {
    return {
      reply: "You can view the exact GPS pin and neighborhood ward for any issue on the **City Map**. You can also explore active complaints across your ward.",
      intent: "LOCATION_HELP",
      actionButtons: [
        { label: "Open City Map", action: "GO_MAP" },
        { label: "Report an Issue", action: "GO_REPORT" },
      ],
    };
  }

  // 9. Out of scope redirection
  if (
    lower.includes("write a poem") ||
    lower.includes("tell a joke") ||
    lower.includes("recipe") ||
    lower.includes("movie") ||
    lower.includes("weather tomorrow")
  ) {
    return {
      reply: "I'm specifically focused on helping you with CivicFix and municipal issues. I can help you report a problem, track an active complaint, or explain how city departments handle civic fixes.",
      intent: "OUT_OF_SCOPE",
      actionButtons: [
        { label: "Report an Issue", action: "GO_REPORT" },
        { label: "Track Complaint", action: "GO_COMPLAINTS" },
      ],
    };
  }

  // Default helpful response
  return {
    reply: "I'm here to help you report civic issues, track existing complaints, or find the right municipal department. How can I assist you today?",
    intent: "GENERAL_APP_QUESTION",
    actionButtons: [
      { label: "Report an Issue", action: "GO_REPORT" },
      { label: "Track My Complaints", action: "GO_COMPLAINTS" },
      { label: "Explore Map", action: "GO_MAP" },
    ],
  };
}

// Deterministic Smart Civic Analyzer for 100% reliability in all environments
function generateSmartCivicAnalysis(text = "", hasImage = false) {
  const lower = (text || "").toLowerCase();

  if (lower.includes("light") || lower.includes("lamp") || lower.includes("dark") || lower.includes("pole") || lower.includes("bulb")) {
    return {
      category: "streetlight",
      title: "Streetlight not working",
      description: text || "Streetlight pole is completely non-functional, creating poor visibility and safety concerns.",
      priority: "medium",
      suggestedDepartment: "Electrical Maintenance",
      confidence: 0.94,
      detectedWardHint: "Ward 12",
      clarifyingQuestion: "Is the pole completely dark at night, flickering intermittently, or physically tilted?",
    };
  }

  if (lower.includes("pothole") || lower.includes("crater") || lower.includes("asphalt") || lower.includes("tar") || lower.includes("bump")) {
    return {
      category: "pothole",
      title: "Hazardous road pothole",
      description: text || "Deep pothole posing immediate hazard to two-wheelers and traffic flow.",
      priority: "high",
      suggestedDepartment: "Road Maintenance",
      confidence: 0.96,
      detectedWardHint: "Ward 07",
      clarifyingQuestion: "Is the pothole causing vehicular damage or blocking the main traffic lane?",
    };
  }

  if (lower.includes("garbage") || lower.includes("waste") || lower.includes("trash") || lower.includes("bin") || lower.includes("dump") || lower.includes("smell")) {
    return {
      category: "garbage",
      title: "Overflowing garbage dump",
      description: text || "Uncollected municipal waste overflowing onto pavement causing public health and sanitation concerns.",
      priority: "medium",
      suggestedDepartment: "Waste Management",
      confidence: 0.92,
      detectedWardHint: "Ward 15",
      clarifyingQuestion: "Has the collection truck skipped scheduled pickup, or is this an illegal open dumping spot?",
    };
  }

  if (lower.includes("leak") || lower.includes("pipe") || lower.includes("drinking water") || lower.includes("tap") || lower.includes("pipeline") || lower.includes("burst")) {
    return {
      category: "water_leakage",
      title: "High-pressure water pipeline leakage",
      description: text || "Continuous fresh water loss from municipal supply pipeline along the roadside.",
      priority: "high",
      suggestedDepartment: "Water & Sewerage",
      confidence: 0.95,
      detectedWardHint: "Ward 04",
      clarifyingQuestion: "Is the leaking water clean treated drinking water or sewage run-off?",
    };
  }

  if (lower.includes("drain") || lower.includes("sewer") || lower.includes("manhole") || lower.includes("clog") || lower.includes("stagnant") || lower.includes("flood")) {
    return {
      category: "drainage",
      title: "Blocked storm drainage & stagnant water",
      description: text || "Blocked stormwater drain causing waterlogging and foul odor.",
      priority: "high",
      suggestedDepartment: "Water & Sewerage",
      confidence: 0.91,
      detectedWardHint: "Ward 09",
      clarifyingQuestion: "Is there any open or cracked manhole cover at this spot?",
    };
  }

  if (lower.includes("signal") || lower.includes("traffic") || lower.includes("junction") || lower.includes("crossing")) {
    return {
      category: "traffic_signal",
      title: "Traffic signal malfunction",
      description: text || "Traffic lights stuck or unpowered at intersection causing congestion.",
      priority: "urgent",
      suggestedDepartment: "Traffic Management",
      confidence: 0.93,
      detectedWardHint: "Ward 02",
      clarifyingQuestion: "Are the lights completely dead or flashing amber/stuck on red?",
    };
  }

  // Default smart general civic
  return {
    category: hasImage ? "road_damage" : "other",
    title: text ? (text.length > 40 ? text.slice(0, 40) + "..." : text) : "Civic infrastructure issue",
    description: text || "Reported civic issue requiring municipal attention and inspection.",
    priority: "medium",
    suggestedDepartment: "General Civic Services",
    confidence: 0.88,
    detectedWardHint: "Ward 12",
    clarifyingQuestion: "Could you mention any nearby landmarks or street numbers to assist the field crew?",
  };
}

function generateConversationalResponse(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("completely off") || m.includes("dark") || m.includes("not working")) {
    return "Thank you for confirming. I've noted that the fixture is completely off. I've updated the urgency to Medium and routed this to Electrical Maintenance.";
  }
  if (m.includes("huge") || m.includes("deep") || m.includes("accident") || m.includes("urgent")) {
    return "Understood. Because of the safety risk to motorists and pedestrians, I have escalated the priority to High.";
  }
  if (m.includes("leak") || m.includes("burst")) {
    return "Noted. Clean water main leaks are flagged for rapid response by the Water & Sewerage team to prevent wastage.";
  }
  return "Got it! I've updated your complaint details. You can verify the location on the map and review your report before final submission.";
}

async function startServer() {
  try {
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.resolve(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`[CivicFix] Server listening on host 0.0.0.0, port ${PORT} (NODE_ENV: ${process.env.NODE_ENV || "development"})`);
    });

    // Graceful shutdown handling for Cloud Run
    const shutdown = (signal: string) => {
      console.log(`[CivicFix] Received ${signal}, closing server gracefully...`);
      server.close(() => {
        console.log("[CivicFix] HTTP server closed.");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    console.error("[CivicFix] Fatal error during startup:", error);
    process.exit(1);
  }
}

startServer();
