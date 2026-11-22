export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const env = (
    typeof import.meta !== "undefined" ? import.meta.env : undefined
  ) as Record<string, string | undefined> | undefined;
  const useBackend = env?.VITE_USE_BACKEND === "true";
  const oauthPortalUrl = env?.VITE_OAUTH_PORTAL_URL;
  const appId = env?.VITE_APP_ID;

  if (
    typeof window === "undefined" ||
    !useBackend ||
    !oauthPortalUrl ||
    !appId
  ) {
    return "/login";
  }

  try {
    const redirectUri = `${window.location.origin}/api/oauth/callback`;
    const state = btoa(redirectUri);

    const url = new URL(`${oauthPortalUrl}/app-auth`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");

    return url.toString();
  } catch {
    return "/login";
  }
};
