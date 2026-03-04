import { DOMParser } from "@xmldom/xmldom";
import crypto from "crypto";

/**
 * Extract text content from the first matching element using local name.
 * XML namespaces vary across feed versions, so we match by local tag name.
 */
function getTextByLocalName(parent, localName) {
  const els = parent.getElementsByTagName("*");
  for (let i = 0; i < els.length; i++) {
    if (els[i].localName === localName) {
      return els[i].textContent || "";
    }
  }
  return "";
}

/**
 * Extract all CPV codes from an entry's RequiredCommodityClassification elements.
 * Looks for <cbc:ItemClassificationCode> inside <cac:RequiredCommodityClassification>.
 */
function extractCpvCodes(entry) {
  const codes = [];
  const allElements = entry.getElementsByTagName("*");
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    if (el.localName === "ItemClassificationCode") {
      const uri = el.getAttribute("listURI") || "";
      if (uri.includes("CPV")) {
        const code = (el.textContent || "").trim();
        if (code && /^\d{8}$/.test(code)) {
          codes.push(code);
        }
      }
    }
  }
  return codes;
}

/**
 * Extract budget amount from entry.
 * Looks for EstimatedOverallContractAmount or TotalAmount.
 */
function extractBudget(entry) {
  const allElements = entry.getElementsByTagName("*");
  let estimated = "";
  let total = "";
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    if (el.localName === "EstimatedOverallContractAmount") {
      estimated = (el.textContent || "").trim();
    } else if (el.localName === "TotalAmount" && !total) {
      total = (el.textContent || "").trim();
    }
  }
  const amount = estimated || total;
  if (!amount) return "";
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  return `${num.toLocaleString("es-ES", { minimumFractionDigits: 2 })} EUR`;
}

/**
 * Extract the contracting party name.
 */
function extractOrganism(entry) {
  const allElements = entry.getElementsByTagName("*");
  // Find the first PartyName > Name inside LocatedContractingParty
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    if (el.localName === "LocatedContractingParty") {
      const partyEl = el.getElementsByTagName("*");
      for (let j = 0; j < partyEl.length; j++) {
        if (partyEl[j].localName === "PartyName") {
          const nameEl = partyEl[j].getElementsByTagName("*");
          for (let k = 0; k < nameEl.length; k++) {
            if (nameEl[k].localName === "Name") {
              return (nameEl[k].textContent || "").trim();
            }
          }
        }
      }
      break;
    }
  }
  return "";
}

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

    // Extract structured data from CODICE XML
    const cpvCodes = extractCpvCodes(entry);
    const budget = extractBudget(entry);
    const organism = extractOrganism(entry);

    items.push({ title, summary, link, id, cpvCodes, budget, organism });
  }

  return items;
}

export function entryId(link) {
  return crypto.createHash("sha256").update(link).digest("hex").slice(0, 12);
}
