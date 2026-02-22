import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Display name (username/handle) for a source URL so we show it instead of the full link. */
export function getSourceDisplayName(url: string, type: string): string {
  const u = url?.trim() || "";
  const normalized = u.startsWith("http") ? u : `https://${u}`;
  if (type === "linkedin") {
    const m = normalized.match(/linkedin\.com\/in\/([^/?#]+)/i);
    return m ? m[1] : u;
  }
  if (type === "x") {
    const m = normalized.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)/i);
    return m ? m[1] : u;
  }
  if (type === "youtube") {
    const m = normalized.match(/youtube\.com\/(@[^/?#]+|channel\/[^/?#]+|c\/[^/?#]+|user\/[^/?#]+)/i);
    if (!m) return u;
    const segment = m[1];
    return segment.startsWith("@") ? segment.slice(1) : segment;
  }
  return u;
}
