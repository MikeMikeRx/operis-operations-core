export const REFRESH_COOKIE = "refresh_token";

export function refreshCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd,
    path: "/api/v1/auth",
  };
}
