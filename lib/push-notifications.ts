import {
  getPasteSessionToken,
  SUPABASE_KEY,
  SUPABASE_URL,
} from "@/lib/client-api";

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/birthday-push`;
const serviceWorkerScope = () => new URL("./", document.baseURI).pathname;
const serviceWorkerUrl = () => new URL("sw.js", document.baseURI).pathname;

const toUint8Array = (base64Url: string) => {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const value = atob(base64);
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
};

async function callPushFunction(action: string, body: Record<string, unknown> = {}) {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      "x-paste-session": getPasteSessionToken(),
    },
    body: JSON.stringify({ action, ...body }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Operazione notifiche non riuscita");
  return payload;
}

export const isPushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export async function getPushStatus() {
  if (!isPushSupported()) return "unsupported" as const;
  if (Notification.permission === "denied") return "denied" as const;
  const registration = await navigator.serviceWorker.getRegistration(serviceWorkerScope());
  if (!registration) return "disabled" as const;
  return (await registration.pushManager.getSubscription()) ? "enabled" as const : "disabled" as const;
}

export async function enableBirthdayPush() {
  if (!isPushSupported()) throw new Error("Le notifiche push non sono supportate da questo browser");
  if (!getPasteSessionToken()) throw new Error("Accedi prima di attivare le notifiche");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permesso per le notifiche non concesso");

  const registration = await navigator.serviceWorker.register(
    serviceWorkerUrl(),
    { scope: serviceWorkerScope() },
  );
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const config = await callPushFunction("config");
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toUint8Array(config.vapidPublicKey),
    });
  }
  await callPushFunction("subscribe", { subscription: subscription.toJSON() });
}

export async function disableBirthdayPush() {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await callPushFunction("unsubscribe", { endpoint: subscription.endpoint });
    await subscription.unsubscribe();
  }
}

export async function testBirthdayPush() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) throw new Error("Attiva prima le notifiche push");
  await callPushFunction("test", { endpoint: subscription.endpoint });
}
