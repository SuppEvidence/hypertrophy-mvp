import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/auth/server";
import { ensureProfile } from "@/lib/auth/profile";

export const getAuthenticatedUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
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
