import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// 빌드 시점 값이 굳으면 첫 계정을 만들 수 없어, 매번 새로 확인하게 합니다.
export const dynamic = "force-dynamic";

/** 크루원이 한 명도 없는 초기 상태인지 알려줍니다. */
export async function GET() {
  const { count, error } = await supabaseAdmin
    .from("crew_members")
    .select("id", { count: "exact", head: true });

  if (error) return NextResponse.json({ empty: false });
  return NextResponse.json({ empty: (count ?? 0) === 0 });
}
