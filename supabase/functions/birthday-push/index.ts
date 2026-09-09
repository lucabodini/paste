import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type Subscription = { endpoint: string; keys: { p256dh: string; auth: string } };
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type, x-paste-session, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function configureVapid() {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT");
  if (!publicKey || !privateKey || !subject) throw new Error("VAPID non configurato");
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return publicKey;
}

async function authenticatedPerson(request: Request) {
  const token = request.headers.get("x-paste-session") || "";
  if (!token) return null;
  const { data, error } = await supabase.rpc("paste_session", { p_token: token });
  return !error && data?.authenticated ? data.personName as string : null;
}

async function send(subscription: Subscription, payload: Record<string, unknown>) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 60 * 60 * 12 });
    return true;
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410)
      await supabase.from("paste_push_subscriptions").delete().eq("endpoint", subscription.endpoint);
    console.error("Web Push fallita", subscription.endpoint, error);
    return false;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return reply({ error: "Metodo non consentito" }, 405);
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action;
    if (action === "config") return reply({ vapidPublicKey: Deno.env.get("VAPID_PUBLIC_KEY") });

    const isCron = request.headers.get("x-cron-secret") === Deno.env.get("CRON_SECRET");
    if (action === "run") {
      if (!isCron) return reply({ error: "Non autorizzato" }, 401);
      configureVapid();
      const romeDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date());
      const monthDay = romeDate.slice(5);
      const { data: state, error: stateError } = await supabase
        .from("paste_state").select("data").eq("id", 1).single();
      if (stateError) throw stateError;
      const names = ((state.data?.team || []) as unknown[])
        .filter((person): person is unknown[] => Array.isArray(person))
        .filter((person) => typeof person[0] === "string" && typeof person[3] === "string" && person[3].slice(5) === monthDay)
        .map((person) => typeof person[6] === "string" && person[6].trim() ? person[6].trim() : person[0] as string);
      if (!names.length) return reply({ sent: false, reason: "no-birthdays", date: romeDate });

      const { data: subscriptions, error: subscriptionsError } = await supabase
        .from("paste_push_subscriptions").select("endpoint, subscription");
      if (subscriptionsError) throw subscriptionsError;
      if (!subscriptions?.length) return reply({ sent: false, reason: "no-subscriptions", date: romeDate });

      const { error: logError } = await supabase.from("paste_push_deliveries").insert({
        notification_date: romeDate, names,
      });
      if (logError) {
        if (logError.code === "23505") return reply({ sent: false, reason: "already-sent", date: romeDate });
        throw logError;
      }
      const message = names.length === 1
        ? `🎂 Oggi è il compleanno di ${names[0]}!`
        : `🎂 Oggi è il compleanno di ${names.join(", ")}!`;
      const results = await Promise.all(subscriptions.map(({ subscription }) =>
        send(subscription as Subscription, { title: "Compleanno 🎉", body: message, tag: `birthday-${romeDate}` }),
      ));
      await supabase.from("paste_push_deliveries").update({ sent_count: results.filter(Boolean).length })
        .eq("notification_date", romeDate);
      return reply({ sent: true, date: romeDate, sentCount: results.filter(Boolean).length });
    }

    const personName = await authenticatedPerson(request);
    if (!personName) return reply({ error: "Accesso richiesto" }, 401);
    if (action === "subscribe") {
      const subscription = body.subscription as Subscription;
      if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth)
        return reply({ error: "Subscription non valida" }, 400);
      const { error } = await supabase.from("paste_push_subscriptions").upsert({
        endpoint: subscription.endpoint, subscription, person_name: personName, updated_at: new Date().toISOString(),
      }, { onConflict: "endpoint" });
      if (error) throw error;
      return reply({ ok: true });
    }
    if (action === "unsubscribe") {
      await supabase.from("paste_push_subscriptions").delete()
        .eq("endpoint", String(body.endpoint || "")).eq("person_name", personName);
      return reply({ ok: true });
    }
    if (action === "test") {
      configureVapid();
      const { data: row, error } = await supabase.from("paste_push_subscriptions")
        .select("subscription").eq("endpoint", String(body.endpoint || ""))
        .eq("person_name", personName).single();
      if (error || !row) return reply({ error: "Subscription non trovata" }, 404);
      const ok = await send(row.subscription as Subscription, {
        title: "Test notifiche 🎉", body: "Le notifiche di compleanno di Paste sono attive.", tag: "paste-push-test",
      });
      return reply({ ok });
    }
    return reply({ error: "Azione non disponibile" }, 404);
  } catch (error) {
    console.error(error);
    return reply({ error: error instanceof Error ? error.message : "Errore interno" }, 500);
  }
});
