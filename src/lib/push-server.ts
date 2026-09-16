import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

webpush.setVapidDetails(
  "mailto:nround.crew@gmail.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
  process.env.VAPID_PRIVATE_KEY as string
);

export type PushPayload = { title: string; body?: string; url?: string };

/**
 * 알림을 보냅니다.
 * memberIds 를 주면 그 사람들의 기기에만, 없으면 구독한 모두에게 갑니다.
 * 만료된 구독은 정리합니다.
 */
export async function sendPush(payload: PushPayload, memberIds?: string[] | null) {
  let query = supabaseAdmin.from("push_subscriptions").select("endpoint, subscription, member_id");

  if (memberIds) {
    if (memberIds.length === 0) return { sent: 0, failed: 0 };
    query = query.in("member_id", memberIds);
  }

  const { data: subs } = await query;
  const rows = subs ?? [];
  if (rows.length === 0) return { sent: 0, failed: 0 };

  const results = await Promise.allSettled(
    rows.map((row) => webpush.sendNotification(row.subscription, JSON.stringify(payload)))
  );

  const dead = rows
    .filter((_, i) => results[i].status === "rejected")
    .map((row) => row.endpoint);

  if (dead.length > 0) {
    await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", dead);
  }

  return { sent: results.length - dead.length, failed: dead.length };
}
