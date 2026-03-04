import { CPV_MAP } from "./_lib/kv-schema.js";

export default function handler(req, res) {
  // Return the CPV map for frontend display
  const entries = Object.entries(CPV_MAP).map(([code, apps]) => ({ code, apps }));
  res.status(200).json({ cpv: entries, total: entries.length });
}
