import { env } from "@/env";
import { Agent, CredentialSession } from "@atproto/api";

export const session = new CredentialSession(new URL("https://bsky.social"));
export const agent = new Agent(session);

async function authenticate() {
  await session.login({
    identifier: env.BSKY_ID,
    password: env.BSKY_PASSWORD,
  });
  console.log("Authenticated as:", session.did);
}

await authenticate();
