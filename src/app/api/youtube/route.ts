import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 곡 제목으로 유튜브 최고 조회수를 찾아 대중성 등급을 매깁니다.
 * YOUTUBE_API_KEY 가 없으면 조용히 건너뜁니다(사용자가 직접 고르면 됨).
 */
export async function POST(req: NextRequest) {
  const { title, artist } = await req.json();
  const q = [title, artist].filter(Boolean).join(" ").trim();

  if (!q) return NextResponse.json({ error: "곡 제목이 필요해요." }, { status: 400 });

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return NextResponse.json({ skipped: true, reason: "no_key" });
  }

  try {
    const searchUrl =
      "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=viewCount&maxResults=5&q=" +
      encodeURIComponent(q) +
      "&key=" +
      key;
    const sres = await fetch(searchUrl);
    const sdata = await sres.json();
    if (!sres.ok) throw new Error(sdata?.error?.message ?? "search failed");

    const ids: string[] = (sdata.items ?? [])
      .map((i: { id?: { videoId?: string } }) => i.id?.videoId)
      .filter(Boolean);
    if (ids.length === 0) return NextResponse.json({ skipped: true, reason: "not_found" });

    const statsUrl =
      "https://www.googleapis.com/youtube/v3/videos?part=statistics&id=" + ids.join(",") + "&key=" + key;
    const vres = await fetch(statsUrl);
    const vdata = await vres.json();
    if (!vres.ok) throw new Error(vdata?.error?.message ?? "stats failed");

    const views = Math.max(
      0,
      ...(vdata.items ?? []).map((i: { statistics?: { viewCount?: string } }) =>
        Number(i.statistics?.viewCount ?? 0)
      )
    );

    return NextResponse.json({ views });
  } catch {
    return NextResponse.json({ skipped: true, reason: "error" });
  }
}
