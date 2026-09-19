function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/** 이 기기의 알림을 끕니다. */
export async function unsubscribeFromPush() {
  if (!("serviceWorker" in navigator)) return;

  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;

  const endpoint = sub.endpoint;

  // 브라우저 쪽 구독을 먼저 해제하고, 서버 기록도 지웁니다.
  await sub.unsubscribe().catch(() => {});
  await fetch("/api/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});
}

/** 이미 켜져 있는 구독을 서버에 다시 등록합니다(누구 기기인지 연결). */
export async function syncPushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if (Notification.permission !== "granted") return false;

  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return false;

  const { detectDevice } = await import("@/lib/device");

  try {
    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...sub.toJSON(), ...detectDevice() }),
    });
    if (!res.ok) return false;

    // 로그인이 풀리면 로그인 화면(HTML)이 돌아오므로 내용까지 확인합니다.
    const data = await res.json().catch(() => null);
    return !!data?.ok;
  } catch {
    return false;
  }
}

export async function subscribeToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error(
      "이 브라우저는 알림을 지원하지 않아요. (카카오톡 인앱 브라우저는 Safari/Chrome으로 열어주세요)"
    );
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("알림 권한이 거부되었어요.");

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  const { detectDevice } = await import("@/lib/device");
  const info = detectDevice();

  const res = await fetch("/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...subscription.toJSON(), ...info }),
  });

  const data = res.ok ? await res.json().catch(() => null) : null;
  if (!data?.ok) {
    throw new Error("알림을 등록하지 못했어요. 로그인 상태를 확인하고 다시 눌러주세요.");
  }

  return subscription;
}
