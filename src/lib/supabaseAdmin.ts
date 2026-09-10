import { createClient } from "@supabase/supabase-js";

/** 서버 전용 클라이언트. RLS를 우회하므로 절대 클라이언트에서 import 하지 마세요. */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);
