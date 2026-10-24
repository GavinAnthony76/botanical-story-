import type { PlayerState, SessionResponse } from "@botanical-story/shared";
const API = import.meta.env.VITE_API_BASE_URL || "/api";
const TOKEN_KEY = "botanical-story.session.v1";
let token = localStorage.getItem(TOKEN_KEY);
let creatingSession: Promise<void> | null = null;
async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(API + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The nursery could not reach its server.");
  return data as T;
}
async function ensureSession() {
  if (token) return;
  if (!creatingSession) {
    creatingSession = request<SessionResponse>("/session/guest", "POST", {}).then((session) => {
      token = session.token; localStorage.setItem(TOKEN_KEY, token);
    }).finally(() => { creatingSession = null; });
  }
  await creatingSession;
}
export async function loadState(): Promise<PlayerState> {
  await ensureSession();
  try { return await request<PlayerState>("/state"); }
  catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("session")) { token = null; localStorage.removeItem(TOKEN_KEY); return loadState(); }
    throw error;
  }
}
export const buySeed = (speciesId: string, quantity = 1) => request("/seeds/buy", "POST", { speciesId, quantity });
export const plantSeed = (speciesId: string, x: number, y: number) => request("/plants", "POST", { speciesId, x, y });
export const harvestPlant = (plantId: string) => request("/plants/harvest", "POST", { plantId });
export const sellPlant = (speciesId: string, quantity: number) => request("/plants/sell", "POST", { speciesId, quantity, idempotencyKey: crypto.randomUUID() });
export const placeDecoration = (kind: "birdbath" | "bench" | "planter", x: number, y: number) => request("/decorations", "POST", { kind, x, y });
export const finishTutorial = () => request("/tutorial/complete", "POST", {});
