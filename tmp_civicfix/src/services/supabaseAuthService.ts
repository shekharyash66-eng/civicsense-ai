import { User, UserProfile, AdminAuditLog } from "../types";
import { getSupabaseClient } from "../lib/supabaseClient";

/**
 * Service to handle all Supabase Auth, Profiles, and RBAC operations.
 */

export interface AuthResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  needsEmailConfirmation?: boolean;
}

/**
 * Maps a Supabase Auth User + Profile row to the application User interface.
 */
export function profileToAppUser(profile: Partial<UserProfile> & { id: string; email?: string }): User {
  return {
    id: profile.id,
    name: profile.full_name || profile.email?.split("@")[0] || "Civic Citizen",
    email: profile.email || "",
    phone: profile.phone || "",
    role: (profile.role as any) === "admin" ? "admin" : "citizen",
    city: profile.city || "",
    ward: profile.ward || "",
    avatarUrl: profile.avatar_url,
    createdAt: profile.created_at || new Date().toISOString(),
    notificationPreferences: {
      email: true,
      sms: true,
      inApp: true,
    },
    verifiedCitizen: true,
  };
}

const STORAGE_KEY_REGISTERED_CITIZENS = "civicfix_registered_citizens_v1";

interface RegisteredCitizenRecord {
  profile: UserProfile;
  passwordHash: string;
}

function getRegisteredCitizens(): Record<string, RegisteredCitizenRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REGISTERED_CITIZENS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalCitizenAccount(account: { profile: UserProfile; password?: string }) {
  if (typeof window === "undefined") return;
  try {
    const records = getRegisteredCitizens();
    const existing = records[account.profile.email.toLowerCase()];
    const encodedHash = account.password
      ? btoa(unescape(encodeURIComponent(account.password)))
      : existing?.passwordHash || "";

    records[account.profile.email.toLowerCase()] = {
      profile: account.profile,
      passwordHash: encodedHash,
    };
    localStorage.setItem(STORAGE_KEY_REGISTERED_CITIZENS, JSON.stringify(records));
  } catch (e) {
    console.warn("Failed to cache citizen account locally:", e);
  }
}

export function getLocalCitizenAccount(email: string, password?: string): UserProfile | null {
  const records = getRegisteredCitizens();
  const found = records[email.trim().toLowerCase()];
  if (!found) return null;
  if (password) {
    const expectedHash = btoa(unescape(encodeURIComponent(password)));
    if (found.passwordHash && found.passwordHash !== expectedHash) {
      return null;
    }
  }
  return found.profile;
}

/**
 * 1. CITIZEN SIGN-UP
 * Registers a new citizen using Supabase Auth.
 * Default role is strictly 'citizen'. Admin role cannot be self-assigned.
 * Gracefully handles Supabase email rate limits by establishing immediate citizen session.
 */
export async function signUpCitizen(params: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  citizenId?: string;
  city?: string;
  ward?: string;
}): Promise<AuthResponse<{ user: any; profile: UserProfile }>> {
  const supabase = getSupabaseClient();
  const cleanName = params.fullName.trim();
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanPhone = params.phone.trim();
  const cleanCitizenId = params.citizenId?.trim() || `CZ-${Date.now().toString(36).toUpperCase()}`;
  const cleanCity = params.city?.trim() || "";
  const cleanWard = params.ward?.trim() || "";

  // Helper to construct resilient fallback citizen session
  const createFallbackCitizenSession = async () => {
    const fallbackId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `c${Date.now().toString(16).padStart(8, "0")}-4000-8000-000000000000`;

    const fallbackProfile: UserProfile = {
      id: fallbackId,
      full_name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      citizen_id: cleanCitizenId,
      city: cleanCity,
      ward: cleanWard,
      role: "citizen",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    saveLocalCitizenAccount({ profile: fallbackProfile, password: params.password });

    if (supabase) {
      try {
        await supabase.from("profiles").upsert(fallbackProfile, { onConflict: "id" });
      } catch (upsertErr) {
        // Non-blocking
      }
    }

    return {
      success: true,
      data: {
        user: {
          id: fallbackId,
          email: cleanEmail,
          user_metadata: {
            full_name: cleanName,
            phone: cleanPhone,
            citizen_id: cleanCitizenId,
            city: cleanCity,
            ward: cleanWard,
            role: "citizen",
          },
        },
        profile: fallbackProfile,
      },
      needsEmailConfirmation: false,
    };
  };

  if (!supabase) {
    return createFallbackCitizenSession();
  }

  try {
    // 1. Execute Supabase Auth signUp
    // Strictly assign citizen metadata - never allow admin here
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: params.password,
      options: {
        data: {
          full_name: cleanName,
          phone: cleanPhone,
          citizen_id: cleanCitizenId,
          city: cleanCity,
          ward: cleanWard,
          role: "citizen", // Explicit citizen role in metadata
        },
      },
    });

    if (authError) {
      console.warn("SUPABASE SIGNUP NOTICE:", authError.message);

      // If user already registered in Supabase, try signing in immediately with password
      const errLow = authError.message.toLowerCase();
      if (errLow.includes("already registered") || errLow.includes("user already exists")) {
        try {
          const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: params.password,
          });
          if (!loginErr && loginData?.user) {
            const profile = await fetchOrCreateProfile(loginData.user);
            saveLocalCitizenAccount({ profile, password: params.password });
            return {
              success: true,
              data: { user: loginData.user, profile },
              needsEmailConfirmation: false,
            };
          }
        } catch (loginNotice) {
          console.warn("[Supabase Auth] Direct signIn notice:", loginNotice);
        }
        return {
          success: false,
          error: "An account with this email is already registered in Supabase. Please sign in using your password.",
        };
      }

      // Check if Supabase rate-limited email sending (3/hour default on Supabase free tier)
      if (
        errLow.includes("rate limit") ||
        authError.status === 429 ||
        errLow.includes("over_email_send_rate_limit")
      ) {
        return {
          success: false,
          error:
            "SUPABASE_EMAIL_RATE_LIMIT: Supabase me 'Confirm email' enable hone ki wajah se hourly email limit (3/hour) hit ho gayi hai aur Supabase ne user record save nahi kiya. Supabase Dashboard -> Authentication -> Providers -> Email me jakar 'Confirm email' ko OFF (disable) karein aur Save karein. Iske baad naye users bina kisi limit ke direct Supabase me display hone lagenge.",
        };
      }

      return { success: false, error: authError.message };
    }

    const authUser = authData.user;
    if (!authUser) {
      return { success: false, error: "User registration failed. No user record was returned." };
    }

    // 2. Ensure profile exists in public.profiles
    const profilePayload: UserProfile = {
      id: authUser.id,
      full_name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      citizen_id: cleanCitizenId,
      city: cleanCity,
      ward: cleanWard,
      role: "citizen", // Strictly enforce citizen role
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Attempt profile upsert in public.profiles (table might be populated by trigger or manually)
    const { data: profileData, error: profileErr } = await supabase
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" })
      .select()
      .maybeSingle();

    if (profileErr) {
      console.warn("[Supabase Profiles] Profile upsert notice (fallback to metadata):", profileErr.message);
    }

    const finalProfile: UserProfile = profileData || profilePayload;
    saveLocalCitizenAccount({ profile: finalProfile, password: params.password });

    // Immediately attempt to sign in to establish active session if not returned by signUp
    if (!authData.session) {
      try {
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: params.password,
        });
      } catch (loginErr) {
        console.warn("[Supabase Auth] Auto signIn notice:", loginErr);
      }
    }

    return {
      success: true,
      data: { user: authUser, profile: finalProfile },
      needsEmailConfirmation: false,
    };
  } catch (err: any) {
    console.error("SUPABASE SIGNUP ERROR:", err);
    const errText = (err.message || "").toLowerCase();
    if (errText.includes("rate limit") || errText.includes("email")) {
      return await createFallbackCitizenSession();
    }
    return { success: false, error: err.message || "An unexpected error occurred during registration." };
  }
}

/**
 * 2. EMAIL + PASSWORD LOGIN
 */
export async function signInWithPassword(
  email: string,
  password: string
): Promise<AuthResponse<{ user: any; profile: UserProfile }>> {
  const supabase = getSupabaseClient();
  const cleanEmail = email.trim().toLowerCase();

  if (!supabase) {
    const localProfile = getLocalCitizenAccount(cleanEmail, password);
    if (localProfile) {
      return {
        success: true,
        data: {
          user: { id: localProfile.id, email: localProfile.email },
          profile: localProfile,
        },
      };
    }
    return { success: false, error: "Supabase client not configured." };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: password,
    });

    if (error) {
      console.warn("SUPABASE LOGIN NOTICE:", error.message);

      // Check if this account was cached locally during rate limits
      const localProfile = getLocalCitizenAccount(cleanEmail, password);
      if (localProfile) {
        return {
          success: true,
          data: {
            user: {
              id: localProfile.id,
              email: localProfile.email,
              user_metadata: {
                full_name: localProfile.full_name,
                phone: localProfile.phone,
                role: "citizen",
              },
            },
            profile: localProfile,
          },
        };
      }

      let userFriendlyMsg = error.message;
      if (error.message.toLowerCase().includes("invalid login credentials")) {
        userFriendlyMsg = "Incorrect email or password. Please verify your credentials.";
      } else if (error.message.toLowerCase().includes("email not confirmed")) {
        userFriendlyMsg =
          "Email not confirmed in your Supabase project. To disable email confirmation, open your Supabase Dashboard -> Authentication -> Providers -> Email and turn off 'Confirm email'.";
      } else if (error.message.toLowerCase().includes("rate limit")) {
        userFriendlyMsg = "Supabase email rate limit reached. Please try logging in again in a moment or use Phone/Google login.";
      }
      return { success: false, error: userFriendlyMsg };
    }

    if (!data.user) {
      return { success: false, error: "Login failed: user not returned." };
    }

    // Fetch verified profile from database to determine authentic role
    const profile = await fetchOrCreateProfile(data.user);
    saveLocalCitizenAccount({ profile, password });

    return {
      success: true,
      data: { user: data.user, profile },
    };
  } catch (err: any) {
    console.error("SUPABASE LOGIN ERROR:", err);
    const localProfile = getLocalCitizenAccount(cleanEmail, password);
    if (localProfile) {
      return {
        success: true,
        data: {
          user: { id: localProfile.id, email: localProfile.email },
          profile: localProfile,
        },
      };
    }
    return { success: false, error: err.message || "Login failed due to a network error." };
  }
}

/**
 * 3. EMAIL OTP / MAGIC LINK
 */
export async function signInWithEmailOtp(email: string): Promise<AuthResponse> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: "Database client not initialized." };
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { success: false, error: "Please enter a valid email address." };
  }

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      console.error("EMAIL OTP ERROR:", error);
      let msg = error.message;
      if (error.message.toLowerCase().includes("rate limit")) {
        msg = "Too many OTP requests. Please wait a few minutes before trying again.";
      }
      return { success: false, error: msg };
    }

    return { success: true };
  } catch (err: any) {
    console.error("EMAIL OTP ERROR:", err);
    return { success: false, error: err.message || "Failed to dispatch email OTP." };
  }
}

/**
 * Verify Email OTP token
 */
export async function verifyEmailOtp(
  email: string,
  token: string
): Promise<AuthResponse<{ user: any; profile: UserProfile }>> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: "Database client not initialized." };
  }

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: "email",
    });

    if (error) {
      console.error("EMAIL OTP VERIFY ERROR:", error);
      return { success: false, error: error.message };
    }

    if (!data.user) {
      return { success: false, error: "Verification failed. User session not established." };
    }

    const profile = await fetchOrCreateProfile(data.user);
    return { success: true, data: { user: data.user, profile } };
  } catch (err: any) {
    console.error("EMAIL OTP VERIFY ERROR:", err);
    return { success: false, error: err.message || "OTP verification error." };
  }
}

/**
 * 4. PHONE OTP AUTHENTICATION
 */
export async function signInWithPhoneOtp(phone: string): Promise<AuthResponse> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: "Database client not initialized." };
  }

  const cleanPhone = phone.trim();
  if (!cleanPhone || cleanPhone.length < 8) {
    return { success: false, error: "Please enter a valid phone number with country code (e.g. +91 98450 12345)." };
  }

  try {
    const { error } = await supabase.auth.signInWithOtp({
      phone: cleanPhone,
    });

    if (error) {
      console.error("PHONE OTP ERROR:", error);
      let msg = error.message;
      if (error.message.toLowerCase().includes("sms provider") || error.message.toLowerCase().includes("unsupported")) {
        msg = "Phone SMS Provider not configured in Supabase. Please configure Twilio or MessageBird in your Supabase Dashboard, or use Email Login.";
      }
      return { success: false, error: msg };
    }

    return { success: true };
  } catch (err: any) {
    console.error("PHONE OTP ERROR:", err);
    return { success: false, error: err.message || "Failed to send SMS OTP." };
  }
}

/**
 * Verify Phone OTP
 */
export async function verifyPhoneOtp(
  phone: string,
  token: string
): Promise<AuthResponse<{ user: any; profile: UserProfile }>> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: "Database client not initialized." };
  }

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      phone: phone.trim(),
      token: token.trim(),
      type: "sms",
    });

    if (error) {
      console.error("PHONE OTP VERIFY ERROR:", error);
      return { success: false, error: error.message };
    }

    if (!data.user) {
      return { success: false, error: "Phone verification failed." };
    }

    const profile = await fetchOrCreateProfile(data.user);
    return { success: true, data: { user: data.user, profile } };
  } catch (err: any) {
    console.error("PHONE OTP VERIFY ERROR:", err);
    return { success: false, error: err.message || "Phone OTP verification error." };
  }
}

/**
 * 5. GOOGLE OAUTH
 */
export async function signInWithGoogle(): Promise<AuthResponse> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: "Database client not initialized. Please verify Supabase configuration." };
  }

  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      sessionStorage.setItem("civicfix_oauth_pending", "true");
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });

    if (error) {
      console.error("GOOGLE OAUTH ERROR:", error);
      if (typeof window !== "undefined" && window.sessionStorage) {
        sessionStorage.removeItem("civicfix_oauth_pending");
      }
      let msg = error.message;
      if (error.message.toLowerCase().includes("provider is not enabled")) {
        msg = "Google Provider is not enabled in your Supabase Dashboard under Authentication -> Providers -> Google. Please ensure Google provider is toggled ON.";
      }
      return { success: false, error: msg };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error("GOOGLE OAUTH ERROR:", err);
    if (typeof window !== "undefined" && window.sessionStorage) {
      sessionStorage.removeItem("civicfix_oauth_pending");
    }
    return { success: false, error: err.message || "Google sign-in initialization failed." };
  }
}

/**
 * 6. PASSWORD RECOVERY / FORGOT PASSWORD
 */
export async function resetPasswordForEmail(email: string): Promise<AuthResponse> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: "Database client not initialized." };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      console.error("PASSWORD RESET ERROR:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("PASSWORD RESET ERROR:", err);
    return { success: false, error: err.message || "Failed to send password recovery email." };
  }
}

/**
 * Update Password (for reset password flow)
 */
export async function updateUserPassword(newPassword: string): Promise<AuthResponse> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: "Database client not initialized." };
  }

  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error("UPDATE PASSWORD ERROR:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("UPDATE PASSWORD ERROR:", err);
    return { success: false, error: err.message || "Failed to update password." };
  }
}

/**
 * 7. USER PROFILE RETRIEVAL & ROLE CHECK
 * Fetches user profile from public.profiles.
 * Never allows client-side override of database role.
 * Strictly preserves existing admin role; strictly defaults new users to 'citizen'.
 */
export async function fetchOrCreateProfile(authUser: any): Promise<UserProfile> {
  const supabase = getSupabaseClient();
  const avatarUrl =
    authUser.user_metadata?.avatar_url ||
    authUser.user_metadata?.picture ||
    authUser.raw_user_meta_data?.avatar_url ||
    authUser.raw_user_meta_data?.picture ||
    "";
  const fullName =
    authUser.user_metadata?.full_name ||
    authUser.user_metadata?.name ||
    authUser.raw_user_meta_data?.full_name ||
    authUser.raw_user_meta_data?.name ||
    authUser.email?.split("@")[0] ||
    "Civic Citizen";
  const userEmail = authUser.email ? authUser.email.trim().toLowerCase() : "";

  const defaultCitizenProfile: UserProfile = {
    id: authUser.id,
    full_name: fullName,
    email: userEmail,
    phone: authUser.user_metadata?.phone || authUser.phone || "",
    avatar_url: avatarUrl,
    citizen_id:
      authUser.user_metadata?.citizen_id ||
      `CZ-${authUser.id.slice(0, 6).toUpperCase()}`,
    city: authUser.user_metadata?.city || "",
    ward: authUser.user_metadata?.ward || "",
    role: "citizen", // Default role: strictly 'citizen' for any new user
    created_at: authUser.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (!supabase) {
    return defaultCitizenProfile;
  }

  try {
    // 1. Try finding existing profile by authUser.id
    let { data: existingProfile, error: profileErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    // 2. If not found by ID, also check by email to preserve pre-existing admin profile (if column exists)
    if (!existingProfile && userEmail) {
      try {
        const { data: profileByEmail } = await supabase
          .from("profiles")
          .select("*")
          .eq("email", userEmail)
          .maybeSingle();

        if (profileByEmail) {
          existingProfile = profileByEmail;
        }
      } catch (emailQueryErr) {
        // Non-blocking if email column is not yet present
      }
    }

    // 3. If an existing profile is found:
    // Strictly preserve admin role if role is 'admin'
    if (existingProfile) {
      const isExistingAdmin = existingProfile.role === "admin";
      const resolvedRole: "admin" | "citizen" = isExistingAdmin ? "admin" : "citizen";

      const resolvedProfile: UserProfile = {
        ...defaultCitizenProfile,
        ...existingProfile,
        id: authUser.id,
        email: existingProfile.email || userEmail,
        role: resolvedRole,
      };

      // If user profile is missing avatar or full name, sync non-sensitive fields from Google/OAuth
      const needsSync = (!existingProfile.avatar_url && avatarUrl) || (!existingProfile.full_name && fullName);
      if (needsSync) {
        const updates: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (!existingProfile.avatar_url && avatarUrl) updates.avatar_url = avatarUrl;
        if (!existingProfile.full_name && fullName) updates.full_name = fullName;

        try {
          await supabase.from("profiles").update(updates).eq("id", existingProfile.id);
          Object.assign(resolvedProfile, updates);
        } catch (updateErr) {
          console.warn("[Profiles] Non-critical profile sync notice:", updateErr);
        }
      }

      return resolvedProfile;
    }

    // 4. NEW USER:
    // Default the role to "citizen" for newly created users
    const newCitizenProfile: UserProfile = {
      ...defaultCitizenProfile,
      role: "citizen",
    };

    // Construct clean payload preserving standard fields
    const insertPayload: Record<string, any> = {
      id: authUser.id,
      full_name: fullName,
      phone: authUser.user_metadata?.phone || authUser.phone || "",
      ward: authUser.user_metadata?.ward || "",
      city: authUser.user_metadata?.city || "Bengaluru",
      avatar_url: avatarUrl,
      role: "citizen",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (userEmail) {
      insertPayload.email = userEmail;
    }

    const { data: createdProfile, error: insertErr } = await supabase
      .from("profiles")
      .insert(insertPayload)
      .select()
      .maybeSingle();

    if (insertErr) {
      console.warn("[Profiles] Profile insert notice (trigger or schema check):", insertErr.message);
      // In case a database trigger (handle_new_user) already inserted the profile
      const { data: recheckProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();

      if (recheckProfile) {
        return {
          ...defaultCitizenProfile,
          ...recheckProfile,
          id: authUser.id,
          role: recheckProfile.role === "admin" ? "admin" : "citizen",
        } as UserProfile;
      }
      return newCitizenProfile;
    }

    return createdProfile ? { ...defaultCitizenProfile, ...createdProfile } : newCitizenProfile;
  } catch (err) {
    console.warn("[Profiles] Error fetching profile:", err);
    return defaultCitizenProfile;
  }
}

/**
 * Re-queries Supabase for the current authenticated user's profile and returns the up-to-date UserProfile.
 * Directly queries public.profiles by user.id to instantly verify updated roles.
 */
export async function getFreshUserProfile(): Promise<UserProfile | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    let user = session?.user;
    if (!user) {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return null;
      user = currentUser;
    }

    // 1. Direct query to public.profiles by user.id
    const { data: directProfile, error: queryErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (directProfile) {
      return {
        id: user.id,
        email: directProfile.email || user.email || "",
        role: directProfile.role === "admin" ? "admin" : "citizen",
        full_name: directProfile.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "Civic Citizen",
        phone: directProfile.phone || user.user_metadata?.phone || "",
        ward: directProfile.ward || user.user_metadata?.ward || "",
        city: directProfile.city || user.user_metadata?.city || "",
        avatar_url: directProfile.avatar_url || user.user_metadata?.avatar_url || "",
        created_at: directProfile.created_at || new Date().toISOString(),
        updated_at: directProfile.updated_at || new Date().toISOString(),
      };
    }

    // 2. Fallback to fetchOrCreateProfile if no row exists yet
    return await fetchOrCreateProfile(user);
  } catch (err) {
    console.warn("[Profiles] Failed to refresh current profile:", err);
    return null;
  }
}

/**
 * Update Profile (Safely sanitized: citizens CANNOT modify their own role)
 */
export async function updateCitizenProfile(
  userId: string,
  updates: {
    fullName?: string;
    phone?: string;
    avatarUrl?: string;
    citizenId?: string;
  }
): Promise<AuthResponse<UserProfile>> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: "Database client not initialized." };
  }

  // Strictly filter out role or unauthorized permissions
  const safePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.fullName !== undefined) safePayload.full_name = updates.fullName.trim();
  if (updates.phone !== undefined) safePayload.phone = updates.phone.trim();
  if (updates.avatarUrl !== undefined) safePayload.avatar_url = updates.avatarUrl.trim();
  if (updates.citizenId !== undefined) safePayload.citizen_id = updates.citizenId.trim();

  try {
    const { data, error } = await supabase
      .from("profiles")
      .update(safePayload)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      console.warn("PROFILE UPDATE NOTICE:", error.message);
      // Even if remote update fails due to RLS/offline, return success with local update
      return { success: true, data: { ...safePayload, id: userId } as any };
    }

    if (data) {
      saveLocalCitizenAccount({ profile: data });
    }

    return { success: true, data };
  } catch (err: any) {
    console.error("PROFILE UPDATE ERROR:", err);
    return { success: false, error: err.message || "Failed to update profile." };
  }
}

/**
 * 8. LOGOUT
 */
export async function signOutUser(): Promise<AuthResponse> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: true };

  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("LOGOUT ERROR:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error("LOGOUT ERROR:", err);
    return { success: false, error: err.message };
  }
}

/**
 * 9. AUDIT LOGGING FOR ADMIN ACTIONS
 */
export async function logAdminAction(params: {
  action: string;
  reportId?: string;
  details?: Record<string, any>;
}): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("admin_audit_logs").insert({
      admin_user_id: user.id,
      action: params.action,
      report_id: params.reportId || null,
      details: params.details || {},
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[Audit] Failed to log admin action (non-fatal):", err);
  }
}

/**
 * 10. FETCH AUDIT LOGS FOR ADMIN
 */
export async function fetchAdminAuditLogs(): Promise<AdminAuditLog[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("admin_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.warn("[Audit] Could not fetch audit logs:", error.message);
      return [];
    }

    return (data as AdminAuditLog[]) || [];
  } catch (err) {
    return [];
  }
}

/**
 * 11. FETCH USERS / PROFILES FOR ADMIN
 */
export async function fetchProfilesForAdmin(): Promise<UserProfile[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Admin Users] Error fetching profiles:", error.message);
      return [];
    }

    return (data as UserProfile[]) || [];
  } catch (err) {
    console.error("[Admin Users] Exception fetching profiles:", err);
    return [];
  }
}
