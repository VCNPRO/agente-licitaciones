import { DOMParser } from "@xmldom/xmldom";
import crypto from "crypto";

export function parseAtomFeed(xml) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const entries = doc.getElementsByTagName("entry");
  const items = [];

  for (let i = 0; i < Math.min(entries.length, 150); i++) {
    const entry = entries[i];
    const title =
      entry.getElementsByTagName("title")[0]?.textContent || "Sin título";
    const summary =
      entry.getElementsByTagName("summary")[0]?.textContent ||
      "Sin descripción";
    const linkEl = entry.getElementsByTagName("link")[0];
    const link = linkEl?.getAttribute("href") || "";
    const id = entry.getElementsByTagName("id")[0]?.textContent || "";

    items.push({ title, summary, link, id });
  }

  return items;
}

export function entryId(link) {
  return crypto.createHash("sha256").update(link).digest("hex").slice(0, 12);
}
