
const BOT_TOKEN = process.env.token;

const API_URL =
  "https://discord.com/api/v10/partner-sdk/token/bot";

async function testProvisionalAccount() {
  if (!BOT_TOKEN) {
    console.error("Missing DISCORD_BOT_TOKEN");
    process.exit(1);
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${BOT_TOKEN}`,
    },
    body: JSON.stringify({
      external_user_id: "test_player_001",
      preferred_global_name: "TestPlayer",
    }),
  });

  const data = await response.json();

  console.log("HTTP Status:", response.status);
  console.log("Success:", response.ok);

  // Avoid printing sensitive tokens.
  const safeData = { ...data };
  if (safeData.access_token) {
    safeData.access_token = "[REDACTED]";
  }
  if (safeData.refresh_token) {
    safeData.refresh_token = "[REDACTED]";
  }

  console.log(
    "Response:",
    JSON.stringify(safeData, null, 2)
  );
}

testProvisionalAccount().catch(console.error);
