import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/auth/server";
import { ensureProfile } from "@/lib/auth/profile";

function isInvalidRefreshToken(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const authError = error as {
    code?: string;
    message?: string;
  };

  return (
    authError.code === "refresh_token_not_found" ||
    authError.message?.includes("Invalid Refresh Token") === true ||
    authError.message?.includes("Refresh Token Not Found") === true
  );
}

export const getAuthenticatedUser = cache(async () => {
  const supabase = await createClient();

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      if (isInvalidRefreshToken(error)) return null;
      throw error;
    }

    return user;
  } catch (error) {
    if (isInvalidRefreshToken(error)) return null;
    throw error;
  }
});

export const requireUser = cache(async () => {
  const user = await getAuthenticatedUser();

  if (!user) redirect("/login");

  await ensureProfile(user);

  return user;
});

export async function requireUserId() {
  return (await requireUser()).id;
}
