import type { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "./supabase.js";

export type CurrentProfile = { id: string; role: "admin" | "staff" | "customer"; status: "pending" | "approved" | "active" | "rejected"; auth_user_id: string | null };
export type AuthenticatedRequest = Request & { profile?: CurrentProfile };

export async function requireSignedInProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Missing bearer token" });
  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !auth.user) return res.status(401).json({ error: "Invalid session" });
  const { data: profile, error } = await supabaseAdmin.from("account_profiles").select("id, role, status, auth_user_id").eq("auth_user_id", auth.user.id).single();
  if (error || !profile) return res.status(403).json({ error: "A NetCafe profile is required" });
  req.profile = profile as CurrentProfile;
  next();
}

export async function requireActiveUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  await requireSignedInProfile(req, res, () => req.profile?.status === "active" ? next() : res.status(403).json({ error: "An active NetCafe profile is required" }));
}

export function requireRole(...roles: CurrentProfile["role"][]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => !req.profile || !roles.includes(req.profile.role) ? res.status(403).json({ error: "Insufficient permissions" }) : next();
}
