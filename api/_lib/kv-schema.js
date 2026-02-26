// KV key patterns and constants

export const TTL = {
  SEEN: 30 * 24 * 3600,        // 30 days
  OPPORTUNITY: 90 * 24 * 3600, // 90 days
  DAILY_INDEX: 90 * 24 * 3600, // 90 days
  DAILY_STATS: 365 * 24 * 3600 // 1 year
};

export const MAX_EXEC_LOG = 200;
export const MAX_NEW_PER_FEED = 30;
export const BATCH_SIZE = 5;

export const APPS = [
  "SCRIPTORIUMIA",
  "VERBADOCSALUD",
  "ANNALYSISMEDIA",
  "VERBADOCPRO",
  "VIDEOCONVERSION",
  "DESCARTADO"
];

export const ENCAJE_LEVELS = ["ALTO", "MEDIO", "BAJO"];

// Key builders
export const keys = {
  seen: (id) => `seen:${id}`,
  opp: (id) => `opp:${id}`,
  idxAll: () => "idx:opps:all",
  idxApp: (app) => `idx:opps:app:${app}`,
  idxEncaje: (level) => `idx:opps:encaje:${level}`,
  idxDay: (date) => `idx:opps:day:${date}`,
  execLog: () => "exec:log",
  execLatest: () => "exec:latest",
  statsDaily: (date) => `stats:daily:${date}`,
  statsSummary: () => "stats:summary",
  configAlerts: () => "config:alerts",
  configFeeds: () => "config:feeds"
};

export function normalizeEncaje(raw) {
  const upper = String(raw).toUpperCase();
  if (upper.includes("ALTO") || upper.includes("HIGH")) return "ALTO";
  if (upper.includes("MEDIO") || upper.includes("MEDIUM") || upper.includes("MODERADO")) return "MEDIO";
  if (upper.includes("BAJO") || upper.includes("LOW")) return "BAJO";
  return "BAJO";
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export const DEFAULT_FEED_URL =
  "https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom";

export const DEFAULT_FEEDS = [
  {
    id: "main",
    name: "Perfil Contratante Completo",
    url: DEFAULT_FEED_URL,
    enabled: true,
    category: "general"
  }
];

export const DEFAULT_ALERTS = {
  enabled: true,
  minEncaje: "BAJO",
  apps: APPS.filter((a) => a !== "DESCARTADO"),
  emailTo: []
};
