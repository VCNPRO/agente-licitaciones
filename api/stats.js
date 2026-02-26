import { kv } from "@vercel/kv";
import { keys } from "./_lib/kv-schema.js";

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const period = url.searchParams.get("period") || "7d";

    const days = period === "90d" ? 90 : period === "30d" ? 30 : 7;

    // Build date keys for the period
    const dateKeys = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dateKeys.push(d.toISOString().slice(0, 10));
    }

    // Fetch daily stats in parallel
    const statsRaw = await Promise.all(
      dateKeys.map((date) => kv.get(keys.statsDaily(date)))
    );

    const timeseries = dateKeys.map((date, idx) => {
      const raw = statsRaw[idx];
      const stats = raw
        ? typeof raw === "string"
          ? JSON.parse(raw)
          : raw
        : { total: 0, relevant: 0, byApp: {}, byEncaje: {} };
      return { date, ...stats };
    });

    // Aggregate totals for the period
    const aggregated = {
      total: 0,
      relevant: 0,
      byApp: {},
      byEncaje: {},
    };

    for (const day of timeseries) {
      aggregated.total += day.total || 0;
      aggregated.relevant += day.relevant || 0;
      for (const [app, count] of Object.entries(day.byApp || {})) {
        aggregated.byApp[app] = (aggregated.byApp[app] || 0) + count;
      }
      for (const [enc, count] of Object.entries(day.byEncaje || {})) {
        aggregated.byEncaje[enc] = (aggregated.byEncaje[enc] || 0) + count;
      }
    }

    // Summary stats
    const summaryRaw = await kv.get(keys.statsSummary());
    const summary = summaryRaw
      ? typeof summaryRaw === "string"
        ? JSON.parse(summaryRaw)
        : summaryRaw
      : { totalOpps: 0, totalRuns: 0, totalEmails: 0, opsByApp: {}, opsByEncaje: {} };

    res.status(200).json({
      period,
      days,
      timeseries,
      aggregated,
      summary,
    });
  } catch (error) {
    console.error("Error stats:", error);
    res.status(500).json({ error: error.message });
  }
}
