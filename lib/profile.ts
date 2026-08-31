import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { sendWelcomeEmailForUser } from "@/lib/email";
import { isE2EAuthBypassEnabled } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/profile";

const E2E_PROFILE: Profile = {
  id: "e2e-profile-id",
  email: "learner@bloquera.dev",
  display_name: "Satoshi Learner",
  avatar_url: "https://images.unsplash.com/photo-1511367461989-f85a21fda167?auto=format&fit=crop&w=200&q=80",
  bio: "Learning Bitcoin one clear step at a time.",
  timezone: "Europe/London",
  created_at: "2025-01-15T10:00:00.000Z",
};

export async function syncProfileForUser(user: User) {
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data: existingProfile, error: lookupError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email ?? null,
        ...(!lookupError && !existingProfile
          ? { welcome_email_eligible_at: new Date().toISOString() }
          : {}),
      },
      { onConflict: "id" },
    )
    .select("id, email, display_name, avatar_url, bio, timezone, created_at")
    .single();

  if (error || !data) {
    return null;
  }

  await sendWelcomeEmailForUser(user);

  return data as Profile;
}

export async function getOrCreateProfile() {
  if (isE2EAuthBypassEnabled()) {
    return E2E_PROFILE;
  }

  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    redirect("/auth/login?next=/profiles");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/profiles");
  }

  const fallbackProfile: Profile = {
    id: user.id,
    email: user.email ?? null,
    display_name: null,
    avatar_url: null,
    bio: null,
    timezone: null,
    created_at: user.created_at,
  };

  const { data: existingProfile, error: selectError } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url, bio, timezone, created_at")
    .eq("id", user.id)
    .single();

  if (!selectError && existingProfile) {
    return existingProfile as Profile;
  }

  const data = await syncProfileForUser(user);

  if (!data) {
    return fallbackProfile;
  }

  return data;
}

export async function getProfileSummary() {
  const profile = await getOrCreateProfile();

  return {
    label: profile.display_name || profile.email || "Profile",
    profile,
  };
}
