import { kv } from "@vercel/kv";
import { keys, todayStr } from "./_lib/kv-schema.js";

export default async function handler(req, res) {
  try {
    const today = todayStr();

    // Fetch latest execution, summary stats, and recent opportunities in parallel
    const [latestExecRaw, summaryRaw, totalOpps, todayOpps] = await Promise.all([
      kv.get(keys.execLatest()),
      kv.get(keys.statsSummary()),
      kv.zcard(keys.idxAll()),
      kv.zcard(keys.idxDay(today)),
    ]);

    const latestExec = latestExecRaw
      ? typeof latestExecRaw === "string"
        ? JSON.parse(latestExecRaw)
        : latestExecRaw
      : null;

    const summary = summaryRaw
      ? typeof summaryRaw === "string"
        ? JSON.parse(summaryRaw)
        : summaryRaw
      : { totalOpps: 0, totalRuns: 0, totalEmails: 0, opsByApp: {}, opsByEncaje: {} };

    // 5 most recent opportunities
    const recentIds = await kv.zrange(keys.idxAll(), 0, 4, { rev: true });
    let recientes = [];
    if (recentIds && recentIds.length > 0) {
      const oppKeys = recentIds.map((id) => keys.opp(id));
      const oppData = await Promise.all(oppKeys.map((k) => kv.get(k)));
      recientes = oppData
        .filter(Boolean)
        .map((d) => (typeof d === "string" ? JSON.parse(d) : d));
    }

    // Trend: last 7 days
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const count = await kv.zcard(keys.idxDay(dateStr));
      trend.push({ date: dateStr, count: count || 0 });
    }

    // Ratio relevant
    const ratioRelevant =
      summary.totalOpps > 0
        ? Math.round(
            ((summary.totalOpps - (summary.opsByApp?.DESCARTADO || 0)) /
              summary.totalOpps) *
              100
          )
        : 0;

    res.status(200).json({
      status: "Activo",
      totalOpportunities: totalOpps || 0,
      todayOpportunities: todayOpps || 0,
      totalRuns: summary.totalRuns || 0,
      totalEmails: summary.totalEmails || 0,
      ratioRelevant,
      opsByApp: summary.opsByApp || {},
      opsByEncaje: summary.opsByEncaje || {},
      latestExecution: latestExec,
      recientes,
      trend,
    });
  } catch (error) {
    console.error("Error dashboard-data:", error);
    res.status(500).json({
      status: "Error",
      error: error.message,
    });
  }
}
