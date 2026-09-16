import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readSession, SESSION_COOKIE } from "@/lib/auth";

export type AdminRole = "lead" | "sub_lead" | "supporter";

/**
 * 요청한 사람이 허용된 직책인지 서버에서 확인합니다.
 * PIN 이 맞으면 운영장으로 봅니다(직책을 아직 안 정한 초기 상태용).
 */
export async function checkAdmin(
  req: NextRequest,
  pin: string | undefined,
  allow: AdminRole[]
): Promise<{ ok: boolean; role?: AdminRole }> {
  if (pin && pin === process.env.ADMIN_PIN) {
    return { ok: allow.includes("lead"), role: "lead" };
  }

  const session = readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return { ok: false };

  const { data } = await supabaseAdmin
    .from("crew_members")
    .select("role")
    .eq("id", session.id)
    .maybeSingle();

  const role = data?.role as AdminRole | null;
  if (!role || !allow.includes(role)) return { ok: false };
  return { ok: true, role };
}
