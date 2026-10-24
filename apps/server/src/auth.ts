import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
const secret = () => { const value = process.env.SESSION_SECRET; if (!value || value.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters."); return value; };
export function issueToken(playerId: string): string { return jwt.sign({ sub: playerId }, secret(), { expiresIn: "30d", issuer: "botanical-story" }); }
export interface AuthRequest extends Request { playerId?: string }
export function requireSession(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) { res.status(401).json({ error: "Sign in to your nursery session.", code: "SESSION_REQUIRED" }); return; }
  try { const payload = jwt.verify(header.slice(7), secret(), { issuer: "botanical-story" }); if (typeof payload === "string" || !payload.sub) throw new Error("Invalid session"); req.playerId = payload.sub; next(); }
  catch { res.status(401).json({ error: "Your nursery session expired. Start a new guest session.", code: "SESSION_INVALID" }); }
}
