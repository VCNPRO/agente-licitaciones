import { kv } from "@vercel/kv";
import { keys } from "./_lib/kv-schema.js";

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));

    const total = await kv.llen(keys.execLog());
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    const raw = await kv.lrange(keys.execLog(), start, end);
    const items = (raw || []).map((entry) =>
      typeof entry === "string" ? JSON.parse(entry) : entry
    );

    res.status(200).json({
      items,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    console.error("Error executions:", error);
    res.status(500).json({ error: error.message });
  }
}
