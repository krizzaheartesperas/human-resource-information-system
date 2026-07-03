import { createServerSupabaseClient } from "@/lib/supabase/server";

const actorSelect = "id, role, department_id";

export type ActorEmployee = {
  id: string;
  role: string | null;
  department_id: string | null;
};

export async function loadActorFromAccessToken(accessToken: string): Promise<{
  supabase: ReturnType<typeof createServerSupabaseClient>;
  actor: ActorEmployee | null;
  error: string | null;
}> {
  const token = accessToken?.trim();
  if (!token) {
    return {
      supabase: createServerSupabaseClient(),
      actor: null,
      error: "Missing session",
    };
  }

  const supabase = createServerSupabaseClient(token);
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  const uid = authData.user?.id;
  if (authErr || !uid) {
    return { supabase, actor: null, error: "Unauthorized" };
  }

  const { data: byUserId, error: err1 } = await supabase
    .from("employees")
    .select(actorSelect)
    .eq("user_id", uid)
    .maybeSingle();

  if (err1) {
    return { supabase, actor: null, error: err1.message };
  }
  if (byUserId) {
    return { supabase, actor: byUserId as ActorEmployee, error: null };
  }

  const { data: byAuthUserId, error: err2 } = await supabase
    .from("employees")
    .select(actorSelect)
    .eq("auth_user_id", uid)
    .maybeSingle();

  if (err2) {
    const msg = (err2.message ?? "").toLowerCase();
    const missingAuthUserIdCol =
      msg.includes("auth_user_id") &&
      (msg.includes("does not exist") || msg.includes("schema cache"));
    if (!missingAuthUserIdCol) {
      return { supabase, actor: null, error: err2.message };
    }
  } else if (byAuthUserId) {
    return { supabase, actor: byAuthUserId as ActorEmployee, error: null };
  }

  return { supabase, actor: null, error: "Employee not linked to this account" };
}
