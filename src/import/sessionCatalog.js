const BUNDLED_SESSION_ROOT = `${import.meta.env.BASE_URL}sessions/`;

async function readJson(response) {
  if (!response.ok) throw new Error(`Request failed with status ${response.status}.`);
  return response.json();
}

export async function loadSessionCatalog(fetcher = fetch) {
  try {
    const local = await readJson(await fetcher("/api/sessions"));
    return { origin: "local", sessions: local.sessions || [] };
  } catch {
    const bundled = await readJson(await fetcher(`${BUNDLED_SESSION_ROOT}index.json`));
    return {
      origin: "bundled",
      sessions: (bundled.sessions || []).map((session) => ({
        ...session,
        origin: "bundled",
      })),
    };
  }
}

export function sessionContentUrl(session) {
  if (session.origin === "bundled") {
    return `${BUNDLED_SESSION_ROOT}${encodeURIComponent(session.path)}`;
  }
  return `/api/session?path=${encodeURIComponent(session.path)}`;
}
