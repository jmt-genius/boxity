export interface BatchEvent {
  id: string;
  actor: string;
  role: string;
  timestamp: string;
  note: string;
  image?: string;
  hash: string;
  ledgerRef: string;
}

export interface Batch {
  id: string;
  productName: string;
  sku?: string;
  origin: string;
  createdAt: string;
  baselineImage: string;
  events: BatchEvent[];
}

export type QrPayload = {
  batchId?: string;
  actor?: string;
  role?: string;
  note?: string;
  image?: string;
};

// Generate fake SHA256-like hash
export const generateHash = (_input: string): string => {
  const chars = "0123456789abcdef";
  let hash = "";
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * 16)];
  }
  return hash;
};

// Generate fake ledger reference
export const generateLedgerRef = (): string => {
  const chars = "0123456789ABCDEF";
  let ref = "0x";
  for (let i = 0; i < 40; i++) {
    ref += chars[Math.floor(Math.random() * 16)];
  }
  return ref;
};

export const DEMO_BATCHES: Batch[] = [
  // ... keep your existing demo batches unchanged ...
  // (omitted here for brevity)
];

// LocalStorage management
const STORAGE_KEY = "boxity-batches";

export const loadBatches = (): Batch[] => {
  const stored =
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  if (stored) {
    try {
      return JSON.parse(stored) as Batch[];
    } catch {
      return [...DEMO_BATCHES];
    }
  }
  return [...DEMO_BATCHES];
};

export const saveBatches = (batches: Batch[]): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
  }
};

export const resetDemoData = (): void => {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
};

/** Accepts:
 * 1) JSON: {"batchId":"CHT-001-ABC","actor":"FastLogistics","role":"3PL"}
 * 2) KV: BATCH=CHT-001-ABC;ACTOR=Fast;ROLE=3PL;NOTE=hello
 * 3) Plain: CHT-001-ABC
 */
export const parseQrPayload = (text: string): QrPayload => {
  const out: QrPayload = {};
  const trimmed = (text || "").trim();
  if (!trimmed) return out;

  // JSON first
  try {
    const obj = JSON.parse(trimmed) as Record<string, unknown>;
    if (obj && typeof obj === "object") {
      return {
        batchId:
          (obj["batchId"] as string) ??
          (obj["batch"] as string) ??
          (obj["id"] as string) ??
          undefined,
        actor: (obj["actor"] as string) ?? undefined,
        role: (obj["role"] as string) ?? undefined,
        note: (obj["note"] as string) ?? undefined,
        image: (obj["image"] as string) ?? undefined,
      };
    }
  } catch {
    // not JSON, continue
  }

  // key=value
  if (trimmed.includes("=")) {
    const parts = trimmed.split(/[;,\n]+/).map((p) => p.trim());
    for (const p of parts) {
      const [kRaw, vRaw] = p.split("=");
      if (!kRaw || !vRaw) continue;
      const k = kRaw.toLowerCase();
      const v = vRaw.trim();
      if (k.includes("batch")) out.batchId = v;
      else if (k === "actor") out.actor = v;
      else if (k === "role") out.role = v;
      else if (k === "note") out.note = v;
      else if (k === "image" || k === "img") out.image = v;
      else if (k === "id") out.batchId = v;
    }
    return out;
  }

  // plain batch id (very loose)
  if (/^[A-Z0-9-]+$/i.test(trimmed)) {
    out.batchId = trimmed;
    return out;
  }

  return out;
};

export const findBatchById = (batches: Batch[], id: string): Batch | undefined =>
  batches.find((b) => b.id === id);
