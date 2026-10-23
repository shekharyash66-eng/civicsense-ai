import React, { useState, useEffect } from "react";
import { UserLocation } from "../../types";
import {
  detectCurrentLocation,
  createManualLocation,
  formatAccuracy,
  searchLocations,
  LocationSearchResult,
  LocationError,
} from "../../services/locationService";
import {
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Navigation,
  Edit3,
  ShieldCheck,
  Compass,
  ArrowRight,
  RefreshCw,
  Building2,
  Search,
  AlertTriangle,
} from "lucide-react";

export const POPULAR_INDIAN_CITIES = [
  { name: "Lucknow", state: "Uttar Pradesh", lat: 26.8467, lng: 80.9462, pincode: "226001" },
  { name: "New Delhi", state: "Delhi", lat: 28.6139, lng: 77.2090, pincode: "110001" },
  { name: "Noida", state: "Uttar Pradesh", lat: 28.5355, lng: 77.3910, pincode: "201301" },
  { name: "Kanpur", state: "Uttar Pradesh", lat: 26.4499, lng: 80.3319, pincode: "208001" },
  { name: "Varanasi", state: "Uttar Pradesh", lat: 25.3176, lng: 82.9739, pincode: "221001" },
  { name: "Prayagraj", state: "Uttar Pradesh", lat: 25.4358, lng: 81.8463, pincode: "211001" },
  { name: "Agra", state: "Uttar Pradesh", lat: 27.1767, lng: 78.0081, pincode: "282001" },
  { name: "Bengaluru", state: "Karnataka", lat: 12.9716, lng: 77.5946, pincode: "560001" },
  { name: "Mumbai", state: "Maharashtra", lat: 19.0760, lng: 72.8777, pincode: "400001" },
  { name: "Pune", state: "Maharashtra", lat: 18.5204, lng: 73.8567, pincode: "411001" },
  { name: "Jaipur", state: "Rajasthan", lat: 26.9124, lng: 75.7873, pincode: "302001" },
  { name: "Kolkata", state: "West Bengal", lat: 22.5726, lng: 88.3639, pincode: "700001" },
  { name: "Patna", state: "Bihar", lat: 25.5941, lng: 85.1376, pincode: "800001" },
  { name: "Chandigarh", state: "Chandigarh", lat: 30.7333, lng: 76.7794, pincode: "160017" },
  { name: "Hyderabad", state: "Telangana", lat: 17.3850, lng: 78.4867, pincode: "500001" },
  { name: "Hoshiarpur", state: "Punjab", lat: 31.5273, lng: 75.9149, pincode: "146001" },
];

interface LocationPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationConfirmed: (location: UserLocation) => void;
  initialMode?: "prompt" | "manual" | "detect";
  title?: string;
  subtitle?: string;
}

export const LocationPromptModal: React.FC<LocationPromptModalProps> = ({
  isOpen,
  onClose,
  onLocationConfirmed,
  initialMode = "prompt",
  title,
  subtitle,
}) => {
  const [step, setStep] = useState<"prompt" | "detecting" | "confirm" | "error" | "manual">(
    initialMode === "manual" ? "manual" : initialMode === "detect" ? "detecting" : "prompt"
  );
  const [detectedLocation, setDetectedLocation] = useState<UserLocation | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [errorCode, setErrorCode] = useState<string>("");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Manual input form states
  const [manualAddress, setManualAddress] = useState("");
  const [manualNeighborhood, setManualNeighborhood] = useState("");
  const [manualCity, setManualCity] = useState("");
  const [manualState, setManualState] = useState("");
  const [manualPostalCode, setManualPostalCode] = useState("");
  const [manualFormError, setManualFormError] = useState("");

  // Search autocomplete effect
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const handler = setTimeout(async () => {
      try {
        const results = await searchLocations(searchQuery);
        setSearchResults(results);
      } catch (e) {
        console.warn("Search location error:", e);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  const handleStartDetect = async (preferOnlyGps = false) => {
    setStep("detecting");
    setErrorMessage("");
    setErrorCode("");

    try {
      const loc = await detectCurrentLocation({ preferOnlyGps });
      setDetectedLocation(loc);
      setStep("confirm");
    } catch (err: any) {
      const locErr = err as LocationError;
      setErrorCode(locErr?.code || "UNKNOWN");
      setErrorMessage(
        locErr?.message ||
          "Could not detect your exact position. Please search for your city or pick from the list below."
      );
      setStep("error");
    }
  };

  // Sync state whenever modal is opened
  useEffect(() => {
    if (!isOpen) return;

    setErrorMessage("");
    setErrorCode("");
    setDetectedLocation(null);
    setSearchQuery("");
    setSearchResults([]);

    if (initialMode === "detect") {
      handleStartDetect(false);
    } else if (initialMode === "manual") {
      setStep("manual");
    } else {
      setStep("prompt");
    }
  }, [isOpen, initialMode]);

  const handleSelectCityQuick = (cityObj: (typeof POPULAR_INDIAN_CITIES)[0]) => {
    const loc = createManualLocation({
      city: cityObj.name,
      state: cityObj.state,
      neighborhood: `Zone 01 - ${cityObj.name} Central`,
      postalCode: cityObj.pincode,
      latitude: cityObj.lat,
      longitude: cityObj.lng,
    });
    setDetectedLocation(loc);
    setSearchQuery("");
    setSearchResults([]);
    setStep("confirm");
  };

  const handleSelectSearchResult = (item: LocationSearchResult) => {
    const loc = createManualLocation({
      city: item.city || item.name,
      state: item.state,
      neighborhood: item.name,
      addressLine: item.formattedAddress,
      postalCode: item.postalCode,
      latitude: item.latitude,
      longitude: item.longitude,
      country: item.country,
    });
    setDetectedLocation(loc);
    setSearchQuery("");
    setSearchResults([]);
    setStep("confirm");
  };

  if (!isOpen) return null;

  const handleConfirmLocation = () => {
    if (detectedLocation) {
      onLocationConfirmed(detectedLocation);
      onClose();
    }
  };

  const handleSaveManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCity.trim()) {
      setManualFormError("City is required");
      return;
    }

    const loc = createManualLocation({
      addressLine: manualAddress.trim() || undefined,
      neighborhood: manualNeighborhood.trim() || undefined,
      city: manualCity.trim(),
      state: manualState.trim() || undefined,
      postalCode: manualPostalCode.trim() || undefined,
      latitude: detectedLocation?.latitude,
      longitude: detectedLocation?.longitude,
    });

    onLocationConfirmed(loc);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200/90 overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close location dialog"
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* TOP SEARCH BAR (Available in prompt, confirm, and manual modes) */}
        {step !== "detecting" && (
          <div className="mb-5 pb-4 border-b border-slate-100">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-teal-600" />
              <span>Search City, Ward or Locality:</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type your city (e.g. Lucknow, Delhi, Noida, Varanasi)..."
                className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              {isSearching && (
                <Loader2 className="w-4 h-4 text-teal-600 animate-spin absolute right-3 top-3" />
              )}
              {searchQuery && !isSearching && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Live Autocomplete Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="mt-2 bg-white rounded-xl border border-slate-200 shadow-lg divide-y divide-slate-100 max-h-48 overflow-y-auto z-20">
                {searchResults.map((res, idx) => (
                  <button
                    key={`${res.name}-${idx}`}
                    type="button"
                    onClick={() => handleSelectSearchResult(res)}
                    className="w-full text-left p-2.5 hover:bg-teal-50/80 transition-colors flex items-start gap-2 cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{res.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">{res.formattedAddress}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 1: INITIAL PROMPT EXPLANATION */}
        {step === "prompt" && (
          <div className="space-y-5">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-700 border border-teal-200/80 flex items-center justify-center shadow-xs">
                <MapPin className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 id="location-modal-title" className="font-heading text-lg font-bold text-slate-900">
                  {title || "Set your current location"}
                </h3>
                <p className="text-xs text-slate-500">
                  {subtitle || "Pinpoint your city, municipal ward, and address for civic resolution"}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
              <div className="flex items-start gap-2 text-xs text-slate-700">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Your location is only used to direct complaints to your local municipal ward.</span>
              </div>
            </div>

            {/* Quick City Selection */}
            <div>
              <div className="text-[11px] font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-teal-600" />
                <span>Quick Select Popular City:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_INDIAN_CITIES.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => handleSelectCityQuick(c)}
                    className="px-2.5 py-1 text-xs bg-slate-50 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-300 border border-slate-200 rounded-lg font-medium text-slate-700 transition-colors cursor-pointer"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => handleStartDetect(false)}
                className="w-full sm:flex-1 bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 text-white font-bold text-xs sm:text-sm px-4 py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Navigation className="w-4 h-4" />
                <span>Auto-Detect My GPS</span>
              </button>

              <button
                type="button"
                onClick={() => setStep("manual")}
                className="w-full sm:w-auto px-4 py-3 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Type Manually</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: DETECTING STATE */}
        {step === "detecting" && (
          <div className="py-6 text-center space-y-5" aria-live="polite">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-teal-100 animate-ping opacity-75" />
              <div className="relative w-14 h-14 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-lg">
                <Compass className="w-7 h-7 animate-spin" style={{ animationDuration: "2.5s" }} />
              </div>
            </div>

            <div>
              <h3 className="font-heading text-lg font-bold text-slate-900">
                Detecting your device coordinates...
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                If your browser shows a popup asking to access your location, tap <strong>Allow</strong>.
              </p>
            </div>

            <div className="w-48 h-1.5 bg-slate-100 rounded-full mx-auto overflow-hidden">
              <div className="h-full bg-teal-500 rounded-full animate-pulse w-3/4" />
            </div>

            {/* Quick Skip to City while detecting */}
            <div className="pt-3 border-t border-slate-100 text-left">
              <div className="text-[11px] font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-teal-600" />
                <span>Don't want to wait? Pick your city directly:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_INDIAN_CITIES.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => handleSelectCityQuick(c)}
                    className="px-2.5 py-1 text-xs bg-slate-50 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-300 border border-slate-200 rounded-lg font-medium text-slate-700 transition-colors cursor-pointer"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep("manual")}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Enter Manually</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CONFIRMATION DIALOG */}
        {step === "confirm" && detectedLocation && (
          <div className="space-y-4" aria-live="polite">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-heading text-base sm:text-lg font-bold text-slate-900">
                    Location Detected
                  </h3>
                  <p className="text-xs text-slate-500">
                    Review and verify your city details before saving
                  </p>
                </div>
              </div>
            </div>

            {/* If detected via IP/Cellular network, show clear advice banner */}
            {detectedLocation.source === "IP" && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Internet Network / ISP Location</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Your cellular or Wi-Fi provider routes through a regional gateway in{" "}
                  <strong>{detectedLocation.city || "Punjab / Delhi hub"}</strong>. If this is not where you live, please pick your city below or search above.
                </p>
              </div>
            )}

            {/* Detected Details Card */}
            <div className="p-4 bg-slate-50/90 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-sm text-slate-900">
                    {detectedLocation.neighborhood || detectedLocation.city || "Detected Area"}
                  </div>
                  <div className="text-xs font-semibold text-slate-700">
                    {[detectedLocation.city, detectedLocation.state, detectedLocation.country]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                  {detectedLocation.formattedAddress && (
                    <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                      {detectedLocation.formattedAddress}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-200/80 text-[11px]">
                <div>
                  <span className="text-slate-400 block font-medium">PIN Code</span>
                  <span className="font-semibold text-slate-800">
                    {detectedLocation.postalCode || "Not available"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Source</span>
                  <span className="font-semibold text-slate-800">
                    {detectedLocation.source === "GPS"
                      ? "Device GPS"
                      : detectedLocation.source === "IP"
                      ? "Internet ISP Gateway"
                      : "Manual / City Pick"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Switch if City is wrong */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-semibold text-slate-600 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-teal-600" />
                  <span>Not your city? Click your real city:</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {POPULAR_INDIAN_CITIES.map((c) => {
                  const isCurrent = detectedLocation.city?.toLowerCase() === c.name.toLowerCase();
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => handleSelectCityQuick(c)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                        isCurrent
                          ? "bg-teal-700 text-white shadow-xs"
                          : "bg-slate-50 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-300 border border-slate-200 text-slate-700"
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmLocation}
                className="w-full sm:flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm px-5 py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Save to Profile</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setManualCity(detectedLocation.city || "");
                  setManualState(detectedLocation.state || "");
                  setManualNeighborhood(detectedLocation.neighborhood || "");
                  setManualAddress(detectedLocation.addressLine || "");
                  setManualPostalCode(detectedLocation.postalCode || "");
                  setStep("manual");
                }}
                className="w-full sm:w-auto px-4 py-3 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Edit Details
              </button>

              <button
                type="button"
                onClick={() => handleStartDetect(true)}
                title="Force exact device GPS satellite lock"
                className="w-full sm:w-auto px-3.5 py-3 text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Retry Device GPS</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: ERROR / FALLBACK STATE */}
        {step === "error" && (
          <div className="space-y-4" aria-live="polite">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="font-heading text-lg font-bold text-slate-900">
                  {errorCode === "PERMISSION_DENIED"
                    ? "Location Permission Denied"
                    : "Coordinates Unavailable"}
                </h3>
                <p className="text-xs text-slate-500">
                  Select your city below or search above to set your location.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 space-y-1.5">
              <p>{errorMessage}</p>
              {errorCode === "PERMISSION_DENIED" && (
                <p className="text-[11px] text-slate-500">
                  To allow device GPS, click the lock/tune icon in your browser URL bar and change Location to <strong>Allow</strong>.
                </p>
              )}
            </div>

            {/* Quick City Selection */}
            <div>
              <div className="text-[11px] font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-teal-600" />
                <span>Select your city directly:</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {POPULAR_INDIAN_CITIES.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => handleSelectCityQuick(c)}
                    className="px-2.5 py-1 text-xs bg-slate-50 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-300 border border-slate-200 rounded-lg font-medium text-slate-700 transition-colors cursor-pointer"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleStartDetect(true)}
                className="w-full sm:flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-4 py-3 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Device GPS</span>
              </button>

              <button
                type="button"
                onClick={() => setStep("manual")}
                className="w-full sm:flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-3 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Enter Manually</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: MANUAL ENTRY FORM */}
        {step === "manual" && (
          <form onSubmit={handleSaveManual} className="space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Edit3 className="w-4 h-4 text-teal-600" />
                <h3 className="font-heading text-base sm:text-lg font-bold text-slate-900">
                  Enter Location Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => handleStartDetect(false)}
                className="text-xs text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Navigation className="w-3 h-3" />
                <span>Use GPS instead</span>
              </button>
            </div>

            {/* Quick Fill Cities */}
            <div>
              <div className="text-[10px] text-slate-500 font-medium mb-1">
                Quick Fill Major City:
              </div>
              <div className="flex flex-wrap gap-1">
                {POPULAR_INDIAN_CITIES.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => {
                      setManualCity(c.name);
                      setManualState(c.state);
                      if (!manualNeighborhood) {
                        setManualNeighborhood(`Zone 01 - ${c.name} Central`);
                      }
                      if (!manualPostalCode && c.pincode) {
                        setManualPostalCode(c.pincode);
                      }
                      setManualFormError("");
                    }}
                    className="px-2 py-0.5 text-[11px] bg-slate-50 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-300 border border-slate-200 rounded-md text-slate-700 transition-colors cursor-pointer"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {manualFormError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl">
                {manualFormError}
              </div>
            )}

            <div className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    City <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={manualCity}
                    onChange={(e) => {
                      setManualCity(e.target.value);
                      setManualFormError("");
                    }}
                    placeholder="e.g. Lucknow, New Delhi, Varanasi"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    State / Region
                  </label>
                  <input
                    type="text"
                    value={manualState}
                    onChange={(e) => setManualState(e.target.value)}
                    placeholder="e.g. Uttar Pradesh, Delhi"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Neighborhood / Locality / Ward
                  </label>
                  <input
                    type="text"
                    value={manualNeighborhood}
                    onChange={(e) => setManualNeighborhood(e.target.value)}
                    placeholder="e.g. Hazratganj, Civil Lines, Ward 12"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    PIN / Postal Code
                  </label>
                  <input
                    type="text"
                    value={manualPostalCode}
                    onChange={(e) => setManualPostalCode(e.target.value)}
                    placeholder="e.g. 226001, 110001"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Street Address (Optional)
                </label>
                <input
                  type="text"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="e.g. MG Road, Near City Clock Tower"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-teal-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-md transition-all cursor-pointer"
              >
                Save Location
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
