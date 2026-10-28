const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function hostnameOf(host: string) {
  return host.replace(/^\[/, "").split(":")[0].replace(/\]$/, "");
}

function isLocalHost(host: string) {
  return LOCAL_HOSTS.has(hostnameOf(host));
}

/**
 * Origin for links in emails. A public request host wins, so the link matches the
 * site the person is using (for example camilleallen.ideaz.net) even when APP_URL
 * is still a localhost value.
 */
export function choosePublicOrigin(input: {
  forwardedHost?: string | null;
  host?: string | null;
  forwardedProto?: string | null;
  fallback?: string | null;
}) {
  const forwarded = input.forwardedHost?.split(",")[0]?.trim() ?? "";
  const hostHeader = input.host?.split(",")[0]?.trim() ?? "";
  const publicHost = [forwarded, hostHeader].find((value) => value && !isLocalHost(value));
  if (publicHost) {
    const proto = input.forwardedProto?.split(",")[0]?.trim() === "http" ? "http" : "https";
    return `${proto}://${publicHost}`;
  }
  const localHost = [forwarded, hostHeader].find((value) => value && isLocalHost(value));
  if (localHost) {
    const proto = input.forwardedProto?.split(",")[0]?.trim() === "https" ? "https" : "http";
    return `${proto}://${localHost}`;
  }
  return (input.fallback ?? "http://localhost:3000").replace(/\/$/, "");
}
