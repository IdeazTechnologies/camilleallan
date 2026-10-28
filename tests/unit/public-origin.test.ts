import { choosePublicOrigin } from "@/lib/public-origin";
import { describe, expect, it } from "vitest";

describe("choosePublicOrigin", () => {
  it("uses the public host the person opened, even when APP_URL is localhost", () => {
    expect(
      choosePublicOrigin({
        forwardedHost: "camilleallen.ideaz.net",
        host: "camilleallen.ideaz.net",
        forwardedProto: "https",
        fallback: "http://localhost:3000",
      }),
    ).toBe("https://camilleallen.ideaz.net");
  });

  it("defaults a public host to https when the proto header is missing", () => {
    expect(
      choosePublicOrigin({
        host: "camilleallen.ideaz.net",
        fallback: "http://localhost:3000",
      }),
    ).toBe("https://camilleallen.ideaz.net");
  });

  it("keeps a local request on its own host and port", () => {
    expect(
      choosePublicOrigin({
        host: "localhost:3300",
        forwardedProto: "http",
        fallback: "http://localhost:3000",
      }),
    ).toBe("http://localhost:3300");
  });

  it("ignores a localhost host when a public forwarded host is present", () => {
    expect(
      choosePublicOrigin({
        forwardedHost: "camilleallen.ideaz.net",
        host: "localhost:3000",
        forwardedProto: "https",
        fallback: "http://localhost:3000",
      }),
    ).toBe("https://camilleallen.ideaz.net");
  });

  it("falls back when there is no request host", () => {
    expect(choosePublicOrigin({ fallback: "https://camilleallen.com/" })).toBe("https://camilleallen.com");
  });
});
