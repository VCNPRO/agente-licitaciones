import { VertexAI } from "@google-cloud/vertexai";
import { DOMParser } from "@xmldom/xmldom";
import nodemailer from "nodemailer";
import { kv } from "@vercel/kv";
import crypto from "crypto";

const FEED_URL =
  "https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom";

const SYSTEM_PROMPT = `Eres un experto clasificador de licitaciones públicas B2B para Mediasolam. Clasifica este contrato en una de estas apps: SCRIPTORIUMIA, VERBADOCSALUD, ANNALYSISMEDIA, VERBADOCPRO, VIDEOCONVERSION, o DESCARTADO. Devuelve SOLO un JSON válido con estas claves: Aplicacion_Mediasolam, Nivel_de_Encaje, Presupuesto_Estimado, Resumen_Ejecutivo, Angulo_de_Venta.`;

function parseAtomFeed(xml) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const entries = doc.getElementsByTagName("entry");
  const items = [];

  for (let i = 0; i < Math.min(entries.length, 150); i++) {
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

function entryId(link) {
  return crypto.createHash("sha256").update(link).digest("hex").slice(0, 12);
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

function buildEmailHtml(oportunidades) {
  const fecha = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const rows = oportunidades
    .map(
      (op) => `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
          <a href="${op.link}" style="color:#2563eb;text-decoration:none;font-weight:600;">${op.titulo}</a>
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
          <span style="background:#dbeafe;color:#1e40af;padding:4px 10px;border-radius:4px;font-size:13px;font-weight:600;">${op.Aplicacion_Mediasolam}</span>
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;">${op.Nivel_de_Encaje}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${op.Presupuesto_Estimado}</td>
      </tr>
      <tr>
        <td colspan="4" style="padding:8px 16px 16px;border-bottom:2px solid #e5e7eb;background:#f9fafb;">
          <p style="margin:0 0 6px;font-size:13px;color:#6b7280;font-weight:600;">Resumen Ejecutivo</p>
          <p style="margin:0 0 10px;font-size:14px;color:#374151;">${op.Resumen_Ejecutivo}</p>
          <p style="margin:0 0 6px;font-size:13px;color:#6b7280;font-weight:600;">Ángulo de Venta</p>
          <p style="margin:0;font-size:14px;color:#374151;">${op.Angulo_de_Venta}</p>
        </td>
      </tr>`
    )
    .join("");

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head><meta charset="UTF-8"></head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:720px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

      <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:32px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;">🚨 Nuevas Licitaciones Detectadas</h1>
        <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">${fecha} · ${oportunidades.length} oportunidad${oportunidades.length > 1 ? "es" : ""}</p>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:12px 16px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Licitación</th>
            <th style="padding:12px 16px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">App</th>
            <th style="padding:12px 16px;text-align:center;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Encaje</th>
            <th style="padding:12px 16px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Presupuesto</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div style="padding:24px;text-align:center;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:12px;color:#9ca3af;">Generado automáticamente por <strong>Agente Licitaciones</strong> · Mediasolam</p>
      </div>
    </div>
  </body>
  </html>`;
}

async function sendEmail(oportunidades) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Agente Licitaciones" <${process.env.SMTP_USER}>`,
    to: process.env.EMAIL_TO,
    subject: "🚨 [Mediasolam] Nuevas Licitaciones Encontradas",
    html: buildEmailHtml(oportunidades),
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
      model: "gemini-2.0-flash",
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

    // --- Clasificación (con deduplicación KV) ---
    const oportunidades = [];
    let skipped = 0;

    for (const item of items) {
      const id = entryId(item.link);
      const seen = await kv.get(`seen:${id}`);
      if (seen) {
        skipped++;
        continue;
      }

      const prompt = buildPrompt(item);

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text =
        response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

      const clasificacion = JSON.parse(text);

      await kv.set(`seen:${id}`, 1, { ex: 30 * 24 * 3600 });

      if (clasificacion.Aplicacion_Mediasolam !== "DESCARTADO") {
        oportunidades.push({
          titulo: item.title,
          link: item.link,
          ...clasificacion,
        });
      }
    }

    // --- Email ---
    if (oportunidades.length > 0) {
      try {
        await sendEmail(oportunidades);
        console.log(`Email enviado con ${oportunidades.length} oportunidades`);
      } catch (emailErr) {
        console.error("Error enviando email:", emailErr.message);
      }
    }

    return res.status(200).json({ success: true, skipped, oportunidades });
  } catch (err) {
    console.error("Error en /api/scout:", err);
    return res.status(500).json({ error: err.message });
  }
}
