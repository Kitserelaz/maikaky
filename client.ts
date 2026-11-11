// Require the necessary discord.js classes
import { Client, DefaultRestOptions, GatewayIntentBits, Events, RESTEvents } from 'discord.js';

// Create a new client instance
const client = new Client({
    intents: [GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildModeration,
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.GuildPresences,
GatewayIntentBits.MessageContent],
    rest: {
      makeRequest: async (url, options) => {
        if (!url.endsWith("/gateway/bot")) return DefaultRestOptions.makeRequest(url, options);

        const startedAt = Date.now();
        console.log("[Discord] Requesting Gateway discovery (GET /gateway/bot).");
        try {
          const response = await DefaultRestOptions.makeRequest(url, options);
          console.log(`[Discord] Gateway discovery responded HTTP ${response.status} after ${Date.now() - startedAt} ms.`);
          if (response.status === 429) {
            const retryAfter = response.headers.get("Retry-After") ?? "missing";
            const scope = response.headers.get("X-RateLimit-Scope") ?? "missing";
            const contentType = response.headers.get("Content-Type") ?? "missing";
            const ray = response.headers.get("CF-Ray") ?? "missing";
            console.warn(`[Discord] Gateway discovery 429: Retry-After=${retryAfter}, scope=${scope}, content-type=${contentType}, CF-Ray=${ray}.`);
          }
          return response;
        } catch (error) {
          const name = error instanceof Error ? error.name : "Unknown error";
          const code = error instanceof Error && "code" in error ? ` (${String(error.code)})` : "";
          console.error(`[Discord] Gateway discovery request failed after ${Date.now() - startedAt} ms: ${name}${code}.`);
          throw error;
        }
      },
    },
  }); // creates a new bot client

client.once(Events.ClientReady, c => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.rest.on(RESTEvents.RateLimited, ({ route, retryAfter }) => {
  if (route === "/gateway/bot") console.warn(`[Discord] Gateway discovery was rate limited. Retrying in ${retryAfter} ms.`);
});
client.on(Events.ShardError, (error, shardId) => {
  const code = "code" in error ? ` (${String(error.code)})` : "";
  console.error(`[Discord] Gateway shard ${shardId} error: ${error.name}${code}.`);
});
client.on(Events.ShardDisconnect, ({ code }, shardId) => {
  console.warn(`[Discord] Gateway shard ${shardId} disconnected (code ${code}).`);
});
client.on(Events.ShardReconnecting, shardId => {
  console.warn(`[Discord] Gateway shard ${shardId} is reconnecting.`);
});
client.on(Events.Debug, message => {
  if (message.includes("Fetched Gateway Information")) console.log("[Discord] Gateway discovery completed.");
});

console.log("Logging in...")
const pendingLogin = setTimeout(() => console.warn("[Discord] Login is still pending after 30 seconds."), 30_000).unref();
try {
  await client.login(process.env.token);
} finally {
  clearTimeout(pendingLogin);
}
console.log("Logged in!")
export default client
