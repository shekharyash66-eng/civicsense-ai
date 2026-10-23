import { UserLocation, GeocodedLocation, LocationPermissionState } from "../types";

export interface CoordinatesResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  source?: "GPS" | "NETWORK" | "IP";
  ipData?: {
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

export interface LocationError {
  code: "PERMISSION_DENIED" | "POSITION_UNAVAILABLE" | "TIMEOUT" | "NOT_SUPPORTED" | "UNKNOWN";
  message: string;
}

/**
 * Fetch approximate location via IP address as a resilient fallback
 * when device GPS is blocked, unavailable, or times out.
 */
async function fetchIpLocation(): Promise<CoordinatesResult | null> {
  // 1. Try server-side IP lookup endpoint
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const serverRes = await fetch("/api/location/ip-lookup", {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeoutId);

    if (serverRes.ok) {
      const data = await serverRes.json();
      if (data && data.success && data.latitude && data.longitude) {
        return {
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: 2500,
          source: "IP",
          ipData: {
            city: data.city,
            state: data.state,
            postalCode: data.postalCode,
            country: data.country,
          },
        };
      }
    }
  } catch (serverErr) {
    console.warn("[LocationService] Server IP lookup failed, trying direct client lookup:", serverErr);
  }

  // 2. Direct client fallback to ipwho.is
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const directRes = await fetch("https://ipwho.is/", {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeoutId);

    if (directRes.ok) {
      const data = await directRes.json();
      if (data && data.success !== false && data.latitude && data.longitude) {
        return {
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: 2500,
          source: "IP",
          ipData: {
            city: data.city,
            state: data.region,
            postalCode: data.postal,
            country: data.country,
          },
        };
      }
    }
  } catch (directErr) {
    console.warn("[LocationService] Direct IP lookup failed:", directErr);
  }

  return null;
}

/**
 * Helper to wrap navigator.geolocation.getCurrentPosition in a Promise
 */
function getBrowserPosition(options: PositionOptions): Promise<CoordinatesResult> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      return reject({ code: "NOT_SUPPORTED", message: "Geolocation not supported" });
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy || 25,
          source: options.enableHighAccuracy ? "GPS" : "NETWORK",
        });
      },
      (err) => {
        let code: LocationError["code"] = "UNKNOWN";
        let message = "Could not determine location.";
        if (err.code === err.PERMISSION_DENIED) {
          code = "PERMISSION_DENIED";
          message = "Location permission was denied.";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          code = "POSITION_UNAVAILABLE";
          message = "Location information unavailable.";
        } else if (err.code === err.TIMEOUT) {
          code = "TIMEOUT";
          message = "Location request timed out.";
        }
        reject({ code, message });
      },
      options
    );
  });
}

export interface LocationSearchResult {
  name: string;
  city: string;
  district: string;
  state: string;
  postalCode?: string;
  country: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

/**
 * Searches places, wards, cities, and landmarks via forward geocoding
 */
export async function searchLocations(query: string): Promise<LocationSearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const res = await fetch(`/api/location/search?q=${encodeURIComponent(query.trim())}`, {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      return (data.results || []) as LocationSearchResult[];
    }
  } catch (err) {
    console.warn("[LocationService] Search places error:", err);
  }
  return [];
}

/**
 * Retrieves the device's current coordinates with multi-tier resilience:
 * 1. Fast GPS query (high accuracy, 12s timeout to allow browser permission prompt)
 * 2. Network-based browser location (low accuracy, 5s timeout)
 * 3. IP-based location fallback (zero-permission, instant)
 */
export async function getCurrentCoordinates(options?: {
  preferOnlyGps?: boolean;
}): Promise<CoordinatesResult> {
  // Step 1: Try high accuracy GPS with a realistic 12-second timeout (accommodates permission dialog)
  try {
    return await getBrowserPosition({
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 60000,
    });
  } catch (gpsErr: any) {
    console.info("[LocationService] High accuracy GPS failed/timed out, trying network:", gpsErr?.code);
  }

  // Step 2: Try network-based location (works via Wi-Fi/cellular scan)
  try {
    return await getBrowserPosition({
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 300000,
    });
  } catch (netErr: any) {
    console.info("[LocationService] Network geolocation failed/denied:", netErr?.code);
  }

  // If caller only wanted real GPS/device position, throw now without IP fallback
  if (options?.preferOnlyGps) {
    throw {
      code: "POSITION_UNAVAILABLE",
      message: "Device GPS could not pinpoint coordinates. Please ensure location permission is allowed.",
    };
  }

  // Step 3: Resilient IP-based fallback (marks source as IP so UI can alert user if ISP routes elsewhere)
  const ipResult = await fetchIpLocation();
  if (ipResult) {
    return ipResult;
  }

  // If everything completely failed, throw clear error
  const err: LocationError = {
    code: "POSITION_UNAVAILABLE",
    message: "Could not detect location from GPS or network. Please search or select your city.",
  };
  throw err;
}

/**
 * Robust Reverse Geocoding service.
 * First tries the server-side proxy `/api/location/reverse-geocode`.
 * Falls back to public OpenStreetMap/Photon endpoints with client-side normalization.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<GeocodedLocation> {
  try {
    // 1. Primary: CivicFix server endpoint (fast, caching, bypasses CORS, includes API key protection)
    const serverUrl = `/api/location/reverse-geocode?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`;
    const res = await fetch(serverUrl, {
      headers: { Accept: "application/json" },
    });

    if (res.ok) {
      const data = await res.json();
      if (data && (data.city || data.state || data.formattedAddress)) {
        return {
          formattedAddress: data.formattedAddress || "",
          addressLine: data.addressLine || "",
          neighborhood: data.neighborhood || "",
          locality: data.locality || data.neighborhood || "",
          city: data.city || "",
          district: data.district || "",
          state: data.state || "",
          postalCode: data.postalCode || undefined,
          country: data.country || "India",
          countryCode: data.countryCode || "IN",
        };
      }
    }
  } catch (err) {
    console.warn("[LocationService] Server reverse geocode error, attempting client fallback:", err);
  }

  // 2. Client-side fallback to OpenStreetMap Nominatim
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
    const res = await fetch(osmUrl, {
      headers: {
        Accept: "application/json",
      },
    });

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};

      // Robust city extraction logic across diverse municipal naming conventions
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

      // Robust state extraction
      const state = addr.state || addr.province || addr.state_district || "";

      // Neighborhood / locality
      const neighborhood =
        addr.suburb ||
        addr.neighbourhood ||
        addr.residential ||
        addr.commercial ||
        addr.quarter ||
        addr.subdistrict ||
        "";

      // Address line
      const road = addr.road || addr.pedestrian || addr.street || "";
      const houseNumber = addr.house_number || "";
      const addressLine = [houseNumber, road].filter(Boolean).join(" ") || road || neighborhood;

      return {
        formattedAddress:
          data.display_name ||
          [addressLine, neighborhood, city, state, addr.postcode, addr.country || "India"]
            .filter(Boolean)
            .join(", "),
        addressLine: addressLine || undefined,
        neighborhood: neighborhood || undefined,
        locality: neighborhood || undefined,
        city: city || undefined,
        district: addr.state_district || addr.district || undefined,
        state: state || undefined,
        postalCode: addr.postcode || undefined,
        country: addr.country || "India",
        countryCode: (addr.country_code || "in").toUpperCase(),
      };
    }
  } catch (clientErr) {
    console.warn("[LocationService] Nominatim fallback failed:", clientErr);
  }

  // 3. Fallback to basic coordinates if reverse geocode failed
  return {
    formattedAddress: `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`,
    city: undefined,
    state: undefined,
    country: "India",
    countryCode: "IN",
  };
}

/**
 * Detects current user location end-to-end:
 * Coordinates -> Reverse geocoding -> Structured UserLocation
 */
export async function detectCurrentLocation(options?: {
  preferOnlyGps?: boolean;
}): Promise<UserLocation> {
  const coords = await getCurrentCoordinates(options);
  const geocoded = await reverseGeocode(coords.latitude, coords.longitude);

  const city = geocoded.city || coords.ipData?.city || undefined;
  const state = geocoded.state || coords.ipData?.state || undefined;
  const postalCode = geocoded.postalCode || coords.ipData?.postalCode || undefined;
  const country = geocoded.country || coords.ipData?.country || "India";

  // Build a nice formatted address if geocoded didn't get a full one
  let formattedAddress = geocoded.formattedAddress;
  if (!formattedAddress || formattedAddress.startsWith("Lat:")) {
    const parts = [geocoded.neighborhood || geocoded.addressLine, city, state, postalCode, country].filter(Boolean);
    if (parts.length > 0) {
      formattedAddress = parts.join(", ");
    }
  }

  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
    formattedAddress,
    addressLine: geocoded.addressLine,
    neighborhood: geocoded.neighborhood,
    locality: geocoded.locality,
    city,
    district: geocoded.district,
    state,
    postalCode,
    country,
    countryCode: geocoded.countryCode,
    source: coords.source === "IP" ? "IP" : "GPS",
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Creates a manual location entry when user enters their location manually
 */
export function createManualLocation(data: {
  addressLine?: string;
  neighborhood?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}): UserLocation {
  const parts = [
    data.addressLine,
    data.neighborhood,
    data.city,
    data.state,
    data.postalCode,
    data.country || "India",
  ].filter(Boolean);

  return {
    latitude: data.latitude || 0,
    longitude: data.longitude || 0,
    accuracy: undefined,
    formattedAddress: parts.join(", "),
    addressLine: data.addressLine,
    neighborhood: data.neighborhood,
    city: data.city.trim(),
    state: data.state?.trim(),
    postalCode: data.postalCode?.trim(),
    country: data.country || "India",
    countryCode: "IN",
    source: "MANUAL",
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Formats display location dynamically:
 * 📍 {neighborhood} • {city}, {state}
 * or 📍 {city}, {state}
 * or 📍 {city}
 * Never outputs null, undefined, or N/A
 */
export function formatDisplayLocation(loc?: UserLocation | null): string {
  if (!loc) return "Location not set";

  const city = loc.city?.trim() || "";
  const state = loc.state?.trim() || "";
  const neighborhood = loc.neighborhood?.trim() || loc.addressLine?.trim() || "";

  if (neighborhood && city && state) {
    return `${neighborhood} • ${city}, ${state}`;
  }
  if (neighborhood && city) {
    return `${neighborhood} • ${city}`;
  }
  if (city && state) {
    return `${city}, ${state}`;
  }
  if (city) {
    return city;
  }
  if (state) {
    return state;
  }
  if (loc.formattedAddress) {
    // Truncate if too long
    return loc.formattedAddress.split(",").slice(0, 2).join(",").trim();
  }
  return "Location set";
}

/**
 * Formats accuracy for human display:
 * ±25 m
 */
export function formatAccuracy(accuracy?: number): string {
  if (typeof accuracy !== "number" || isNaN(accuracy)) {
    return "Not available";
  }
  const meters = Math.round(accuracy);
  if (meters > 500) {
    return `Approx. ±${meters} m (Low accuracy)`;
  }
  return `±${meters} m`;
}

/**
 * Formats updatedAt date nicely for the UI
 */
export function formatLocationDate(isoString?: string): string {
  if (!isoString) return "Never";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "Unknown date";
    return d.toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "Unknown date";
  }
}

/**
 * Checks if location is stale (>30 days old)
 */
export function isLocationStale(isoString?: string, daysThreshold = 30): boolean {
  if (!isoString) return true;
  try {
    const updated = new Date(isoString).getTime();
    const now = Date.now();
    const diffDays = (now - updated) / (1000 * 60 * 60 * 24);
    return diffDays > daysThreshold;
  } catch {
    return false;
  }
}
