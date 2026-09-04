const SUPABASE_URL = "https://hoawdjclpuxxjphvcamx.supabase.co";
const SUPABASE_KEY =
  "sb_publishable_o6HUBTeQfCL9rWKPYMQ16Q_u8X2FeIM";
const SESSION_KEY = "paste-supabase-session";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function usesSupabase() {
  if (typeof window === "undefined") return false;
  return (
    window.location.hostname.endsWith("github.io") ||
    window.location.search.includes("backend=supabase")
  );
}

async function rpc(name: string, values: Record<string, unknown>) {
  const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });
  const payload = await result.json().catch(() => ({}));
  if (!result.ok)
    throw new Error(
      payload?.message || "Supabase non è ancora stato configurato",
    );
  return payload;
}

export async function pasteFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!usesSupabase()) return fetch(input, init);

  try {
    const method = String(init.method || "GET").toUpperCase();
    const body = init.body ? JSON.parse(String(init.body)) : {};
    const token = localStorage.getItem(SESSION_KEY) || "";

    if (input === "/api/auth" && method === "GET") {
      if (!token)
        return response({
          authenticated: false,
          personName: null,
          role: null,
          people: [],
          captainName: "Luca Bodini",
          captainReady: false,
        });
      const data = await rpc("paste_session", { p_token: token });
      if (!data.authenticated) localStorage.removeItem(SESSION_KEY);
      return response(data, data.status || 200);
    }

    if (input === "/api/auth" && method === "DELETE") {
      if (token) await rpc("paste_logout", { p_token: token });
      localStorage.removeItem(SESSION_KEY);
      return response({ authenticated: false });
    }

    if (input === "/api/auth" && method === "POST") {
      const data =
        body.action === "team-check"
          ? await rpc("paste_check_team", { p_team_code: body.teamCode })
          : await rpc("paste_login", {
              p_team_code: body.teamCode,
              p_person_name: body.personName,
              p_password: body.password || "",
            });
      if (data.token) localStorage.setItem(SESSION_KEY, data.token);
      return response(data, data.status || 200);
    }

    if (input === "/api/state" && method === "GET") {
      const data = await rpc("paste_get_state", { p_token: token });
      return response(data, data.status || 200);
    }

    if (input === "/api/state" && method === "PUT") {
      const data = await rpc("paste_save_state", {
        p_token: token,
        p_data: body.data,
        p_captain_name: body.captainName,
      });
      return response(data, data.status || 200);
    }

    return response({ error: "Operazione non disponibile" }, 404);
  } catch (error) {
    return response(
      {
        error:
          error instanceof Error
            ? error.message
            : "Collegamento a Supabase non riuscito",
      },
      503,
    );
  }
}
