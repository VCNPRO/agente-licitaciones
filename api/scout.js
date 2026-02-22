import { VertexAI } from "@google-cloud/vertexai";
import { DOMParser } from "@xmldom/xmldom";

const FEED_URL =
  "https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom";

const SYSTEM_PROMPT = `Eres un experto clasificador de licitaciones públicas B2B para Mediasolam. Clasifica este contrato en una de estas apps: SCRIPTORIUMIA, VERBADOCSALUD, ANNALYSISMEDIA, VERBADOCPRO, VIDEOCONVERSION, o DESCARTADO. Devuelve SOLO un JSON válido con estas claves: Aplicacion_Mediasolam, Nivel_de_Encaje, Presupuesto_Estimado, Resumen_Ejecutivo, Angulo_de_Venta.`;

function parseAtomFeed(xml) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const entries = doc.getElementsByTagName("entry");
  const items = [];

  for (let i = 0; i < Math.min(entries.length, 5); i++) {
    const entry = entries[i];
    const title =
      entry.getElementsByTagName("title")[0]?.textContent || "Sin título";
    const summary =
      entry.getElementsByTagName("summary")[0]?.textContent || "Sin descripción";
    const linkEl = entry.getElementsByTagName("link")[0];
    const link = linkEl?.getAttribute("href") || "";
    const id = entry.getElementsByTagName("id")[0]?.textContent || "";

    items.push({ title, summary, link, id });
  }

  return items;
}

function buildPrompt(item) {
  return `${SYSTEM_PROMPT}\n\nTítulo: ${item.title}\nDescripción: ${item.summary}`;
}

function getVertexClient() {
  const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
  if (!credentialsJson) {
    throw new Error("GOOGLE_CREDENTIALS_JSON no está configurada");
  }

  const credentials = JSON.parse(credentialsJson);

  return new VertexAI({
    project: process.env.GOOGLE_PROJECT_ID,
    location: "europe-west4",
    googleAuthOptions: {
      credentials,
    },
  });
}

export default async function handler(req, res) {
  // --- Auth ---
  const authHeader = req.headers["authorization"];
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expected) {
    return res.status(401).json({ error: "No autorizado" });
  }

  try {
    // --- Vertex AI ---
    const vertexAI = getVertexClient();
    const model = vertexAI.getGenerativeModel({
      model: "gemini-1.5-pro",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    // --- Atom Feed ---
    const feedResponse = await fetch(FEED_URL, {
      headers: {
        Accept: "application/atom+xml",
        "User-Agent": "AgenteLicitaciones/1.0",
      },
    });

    if (!feedResponse.ok) {
      throw new Error(`Feed HTTP ${feedResponse.status}`);
    }

    const xml = await feedResponse.text();
    const items = parseAtomFeed(xml);

    // --- Clasificación ---
    const oportunidades = [];

    for (const item of items) {
      const prompt = buildPrompt(item);

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text =
        response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

      const clasificacion = JSON.parse(text);

      if (clasificacion.Aplicacion_Mediasolam !== "DESCARTADO") {
        oportunidades.push({
          titulo: item.title,
          link: item.link,
          ...clasificacion,
        });
      }
    }

    return res.status(200).json({ success: true, oportunidades });
  } catch (err) {
    console.error("Error en /api/scout:", err);
    return res.status(500).json({ error: err.message });
  }
}
