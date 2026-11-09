import { getStore } from "@netlify/blobs";

const reply = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export default async (req) => {
  const store = getStore("leaderboard");

  // Save a score
  if (req.method === "POST") {
    let b;
    try { b = await req.json(); } catch { return reply({ error: "bad json" }, 400); }

    const id = String(b.id || "");
    const name = String(b.name || "").replace(/[<>]/g, "").trim().slice(0, 16);
    const score = Math.floor(Number(b.score));
    const lvl = Math.floor(Number(b.lvl));
    const clear = Math.floor(Number(b.clear));
    const mode = b.mode === "hard" ? "hard" : "easy";

    if (!/^[0-9a-f]{20}$/.test(id) || !name) return reply({ error: "bad data" }, 400);
    if (!(score >= 0 && score <= 100000)) return reply({ error: "bad score" }, 400);
    if (!(lvl >= 1 && lvl <= 99) || !(clear >= 0 && clear <= 5)) return reply({ error: "bad data" }, 400);

    // keep the player's best score, but always update the name
    const old = await store.get(id, { type: "json" });
    const best = old && old.score > score ? old : { score, lvl, clear, mode };
    await store.setJSON(id, { ...best, name });
    return reply({ ok: true });
  }

  // Get the top 20
  if (req.method === "GET") {
    const me = new URL(req.url).searchParams.get("id");
    const { blobs } = await store.list();
    const rows = await Promise.all(
      blobs.map(async (b) => {
        const v = await store.get(b.key, { type: "json" });
        return v ? { ...v, you: b.key === me } : null;
      })
    );
    const top = rows.filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 20);
    return reply(top);
  }

  return reply({ error: "method not allowed" }, 405);
};

export const config = { path: "/api/leaderboard" };
