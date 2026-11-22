const ALLOWED_ORIGIN = "https://kote52793-code.github.io";
const API = "https://apihub.agnes-ai.com";
const MODEL = "agnes-video-2.5-flash";

function cors(origin) {
  const allowed = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origin) }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    if (origin && origin !== ALLOWED_ORIGIN) return json({ error: "Origin not allowed" }, 403, origin);
    if (!env.AGNES_API_KEY) return json({ error: "Cloudflare secret AGNES_API_KEY is not configured" }, 500, origin);
    const key = env.AGNES_API_KEY;

    try {
      if (request.method === "POST" && url.pathname.endsWith("/generate")) {
        const body = await request.json();
        const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
        if (!prompt || prompt.length > 3000) return json({ error: "Prompt must contain 1–3000 characters" }, 400, origin);
        const seconds = Math.max(4, Math.min(12, Number(body.seconds) || 5));
        const aspect = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"].includes(body.aspect_ratio) ? body.aspect_ratio : "16:9";
        const upstream = await fetch(API + "/v1/videos", {
          method: "POST",
          headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
          body: JSON.stringify({ model: MODEL, prompt, mode: "text", seconds: String(seconds), size: "720P", aspect_ratio: aspect, n: 1 })
        });
        const data = await upstream.json().catch(() => ({}));
        return json(data, upstream.status, origin);
      }

      if (request.method === "GET" && url.pathname.endsWith("/status")) {
        const videoId = url.searchParams.get("video_id");
        if (!videoId || videoId.length > 200) return json({ error: "Missing or invalid video_id" }, 400, origin);
        const upstream = await fetch(API + "/agnesapi?video_id=" + encodeURIComponent(videoId) + "&model_name=" + MODEL, {
          headers: { "Authorization": "Bearer " + key }
        });
        const data = await upstream.json().catch(() => ({}));
        return json(data, upstream.status, origin);
      }
      return json({ error: "Use POST /generate or GET /status?video_id=..." }, 404, origin);
    } catch (error) {
      return json({ error: error && error.message ? error.message : "Worker request failed" }, 500, origin);
    }
  }
};
