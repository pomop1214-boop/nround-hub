export type DeviceKind = "ios" | "android" | "pc";

/** 브라우저가 알려주는 정보로 기기 종류를 추정합니다. */
export function detectDevice(): { device: DeviceKind; browser: string } {
  if (typeof navigator === "undefined") return { device: "pc", browser: "알 수 없음" };

  const ua = navigator.userAgent;

  let device: DeviceKind = "pc";
  if (/iPad|iPhone|iPod/.test(ua)) device = "ios";
  else if (/Android/.test(ua)) device = "android";
  // 아이패드는 데스크톱처럼 보고하는 경우가 있어 터치 지원으로 한 번 더 봅니다.
  else if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) device = "ios";

  let browser = "기타";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/SamsungBrowser/.test(ua)) browser = "삼성인터넷";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/Whale/.test(ua)) browser = "웨일";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua)) browser = "Safari";

  return { device, browser };
}

export function deviceLabel(d: string | null) {
  if (d === "ios") return "아이폰";
  if (d === "android") return "안드로이드";
  if (d === "pc") return "PC";
  return "기기 정보 없음";
}

export function deviceIcon(d: string | null) {
  return d === "pc" ? "💻" : d === "ios" || d === "android" ? "📱" : "•";
}
