/**
 * Municipal Administrator Authentication & Role Verification Service
 * 
 * Single Source of Truth: Supabase public.profiles table (role = 'admin')
 * Deprecated: Legacy localStorage-based single slot bypass.
 */

import { User } from "../types";
import { getSupabaseClient } from "../lib/supabaseClient";
import { signInWithPassword, profileToAppUser, fetchOrCreateProfile } from "./supabaseAuthService";

export interface MasterAdminProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  title: string;
  role: "admin";
  registeredAt: string;
  avatarUrl?: string;
  lastLoginAt?: string;
}

/**
 * Returns whether Supabase admin system is active. Always true.
 */
export function isMasterAdminSlotClaimed(): boolean {
  return true;
}

/**
 * Authenticates admin credentials directly against Supabase Auth & public.profiles
 */
export async function loginMasterAdmin(
  email: string,
  password: string
): Promise<{ success: boolean; admin?: MasterAdminProfile; error?: string }> {
  try {
    const res = await signInWithPassword(email, password);
    if (!res.success || !res.data) {
      return { success: false, error: res.error || "Authentication failed." };
    }

    if (res.data.profile.role !== "admin") {
      return {
        success: false,
        error: "Access Denied: Account role is 'citizen'. Supabase administrator privileges required in public.profiles.",
      };
    }

    const admin: MasterAdminProfile = {
      id: res.data.profile.id,
      name: res.data.profile.full_name,
      email: res.data.profile.email,
      phone: res.data.profile.phone || "",
      department: res.data.profile.ward || "City Administration",
      title: "Municipal Administrator",
      role: "admin",
      registeredAt: res.data.profile.created_at || new Date().toISOString(),
      avatarUrl: res.data.profile.avatar_url,
      lastLoginAt: new Date().toISOString(),
    };

    return { success: true, admin };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to authenticate with Supabase." };
  }
}

/**
 * Ends active session
 */
export function logoutMasterAdmin(): void {
  const supabase = getSupabaseClient();
  if (supabase) {
    supabase.auth.signOut().catch(() => {});
  }
}
