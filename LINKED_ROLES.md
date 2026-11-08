# Linked Roles

The bot publishes `current_streak`, `longest_streak`, `level`, and `has_required_role` for the server
identified by `streaksGuildId` in `streaksData.ts`. Values are refreshed after
authorization, on startup, and every five minutes. Members who leave that server
have all four values set to zero. A missing Lurkr level is zero; upstream errors
leave the previously published metadata unchanged until the next refresh.
Linked Roles waits only for the saved streak history to load, not for every
channel to finish catching up. Streak values may briefly lag during catch-up;
the regular refresh publishes the updated values.

## Setup

1. Add these variables to the bot's private `.env`:

   ```dotenv
   DISCORD_CLIENT_SECRET=your_application_client_secret
   DISCORD_REDIRECT_URI=https://your-bot.example/oauth/discord/callback
   LURKR_API_KEY=your_lurkr_api_key
   LINKED_ROLES_ENCRYPTION_KEY=your_base64_encoded_32_byte_key
   LINKED_ROLES_TOKEN_MESSAGE_ID=your_encrypted_token_message_id
   ```

   The application ID is taken from the logged-in bot. The existing `token`
   variable must belong to the same application as the client secret.

2. Serve the existing Express server on port 3000 through public HTTPS. Forward
   `/linked-roles` and `/oauth/discord/callback` to it. Avoid logging callback
   query strings, which contain authorization codes.
3. In the Discord Developer Portal, add the exact `DISCORD_REDIRECT_URI` under
   **OAuth2 → Redirects**. Set **Linked Roles Verification URL** to
   `https://your-bot.example/linked-roles`.
4. Restart the bot. Startup registers the four metadata fields with Discord.
5. In **Server Settings → Roles**, create or select a role, open **Links**, add
   this application, and set the desired thresholds. Members connect through
   the server's **Linked Roles** menu and authorize access to their identity and
   application role connection.

For local development, set
`DISCORD_REDIRECT_URI=http://localhost:3000/oauth/discord/callback` in `.env`,
register that exact redirect under **OAuth2 → Redirects**, and start linking at
`http://localhost:3000/linked-roles`. The domain comes from the environment
variable; cookie security follows its HTTP or HTTPS protocol. Use HTTPS for
public deployments.

## Deploy to production

These steps move the existing bot and its connected members to a production
host using the same Discord application and data messages.

1. **Prepare the host.** Use an always-on host with Bun installed and deploy the
   repository, including `bun.lock`. Run from the repository root:

   ```sh
   bun install --frozen-lockfile
   ```

   No build step is needed. The working directory must be writable because
   streak tracking downloads and updates `streaks.json` and `streaks.json.tmp`.
   Allow outbound access to Discord's API, Gateway, attachment CDN, and the
   bot's other services, including Lurkr.

2. **Transfer configuration privately.** Supply the existing secrets through
   the host's environment settings or a private `.env` in the repository root:

   ```dotenv
   token=existing_discord_bot_token
   DATA_WEBHOOK=existing_streak_storage_webhook_url
   DISCORD_CLIENT_SECRET=existing_application_client_secret
   DISCORD_REDIRECT_URI=https://your-production-domain/oauth/discord/callback
   LURKR_API_KEY=existing_lurkr_api_key
   LINKED_ROLES_ENCRYPTION_KEY=copy_existing_key_unchanged
   LINKED_ROLES_TOKEN_MESSAGE_ID=copy_existing_message_id_unchanged
   ```

   Replace the placeholders with the existing values; only the redirect URL
   needs to change for the new domain. Keep the same bot application, encryption
   key, token-message ID, and data webhook. The encrypted token message already
   exists in Discord, so there is no token file to copy and no new message or key
   to generate. Common Role configuration remains in the non-streak data message.
   Keep a separate private backup of the encryption key.

   If using `.env`, restrict its permissions:

   ```sh
   chmod 600 .env
   ```

   Bun loads `.env` automatically. Check for `.env.production`, `.env.local`, or
   injected environment settings that override the intended values. See
   [Bun's environment-variable documentation](https://bun.sh/docs/runtime/environment-variables).

3. **Set up HTTPS.** Point your production domain at the host and terminate TLS
   at your hosting platform or reverse proxy. Forward requests to the existing
   Express server on port **3000**, preserving the paths and query parameters:

   - `/linked-roles`
   - `/oauth/discord/callback`

   The application currently uses port 3000 directly; setting a `PORT` variable
   does not change it. Keep that backend port private behind the HTTPS endpoint.
   Avoid recording callback query strings in proxy or hosting access logs because
   they contain OAuth authorization codes. HTTPS makes the application use secure
   OAuth state cookies automatically; no domain change in source is needed.

4. **Update Discord.** In the existing application's Developer Portal:

   - Under **OAuth2 → Redirects**, add the exact production
     `DISCORD_REDIRECT_URI`, including `/oauth/discord/callback`.
   - Set **Linked Roles Verification URL** to
     `https://your-production-domain/linked-roles`.
   - Keep the Server Members, Presence, and Message Content privileged intents
     enabled, as requested by `client.ts`.

   The bot needs access to the existing data channel and its message history,
   permission to send messages and attach files, and access to the channels it
   tracks. The token data message must remain authored by this bot. The streak
   webhook must still target the existing data channel. See
   [Discord's Linked Roles setup guide](https://docs.discord.com/developers/tutorials/configuring-app-metadata-for-linked-roles).

5. **Switch to one production process.** Stop the local bot and any maintenance
   process writing the same data before starting production. Configure the host
   to run this command from the repository root and restart it after crashes or
   host reboots:

   ```sh
   bun run index.ts
   ```

   Run exactly one instance: multiple processes can overwrite each other's token,
   configuration, or streak snapshots. Startup loads and decrypts the existing
   token message, registers metadata descriptions and commands, and starts a sync
   of saved connections. Streak data only needs to finish loading its saved
   snapshot before Linked Roles can sync; full channel catch-up runs separately.

6. **Verify the deployment.** Confirm the logs reach the Express listening
   message and do not report token download, decryption, or Linked Roles sync
   errors. The root URL returns `Hello World!`; that only checks the HTTP server,
   not completion of background catch-up or successful stat publication.

   Open the server's **Linked Roles** menu and connect through the production
   domain. Confirm the role requirements show the expected descriptions and
   values. Existing connected members should sync without authorizing again.
   If Common Role has not been configured, run
   `/linked-role-requirement role:@YourRole` with **Manage Server**, then enable
   **Common Role** on the target Linked Role. Check that adding or removing it
   updates the connected member's metadata; the periodic refresh also runs every
   five minutes. The success page attempts to close itself using `window.close()`.

7. **For subsequent releases**, stop the current process, deploy the updated
   source and lockfile, install dependencies with `bun install --frozen-lockfile`,
   and restart the single process. Preserve production secrets and the existing
   Discord messages. An in-progress OAuth attempt is invalidated by a restart;
   the member can start again. If returning to a previous release, use one that
   supports this encrypted token store and preserve the same key and message ID.

## Common Role

In the tracked server, members with **Manage Server** can run
`/linked-role-requirement role:@CommonRole` to select the Common Role. The bot
saves its ID as `linkedRoles.requiredRoleId` in the existing non-streak data
message using `saveData()`.

Enable **Common Role** in the target role's Linked Roles requirements. Its
`has_required_role` value is `1` only when the connected member currently has
the configured role; it is `0` when no Common Role is configured or the member
does not have it. Membership is derived from Discord rather than stored.
Changes to the setting apply within five minutes. Adding or removing the
Common Role from a connected member also triggers a sync.

## Token storage

OAuth access tokens, refresh tokens, and expiry times are stored in a dedicated
bot-authored message in the existing data channel. Its `linked-roles-tokens.enc`
attachment is encrypted with AES-256-GCM, using a fresh 12-byte nonce and a
16-byte authentication tag on each save. The attachment contains the nonce,
authentication tag, and ciphertext, in that order. Plaintext tokens stay in
memory and are never written to disk by the token store.

`LINKED_ROLES_TOKEN_MESSAGE_ID` selects the message.
`LINKED_ROLES_ENCRYPTION_KEY` is a base64-encoded random 32-byte key kept only in
the private `.env`. Keep a private backup of that key; losing it requires members
to reconnect. Never put it in Discord. Missing attachments, failed downloads,
and decryption errors stop loading rather than reset the token store.
Run one bot process against this message to prevent competing writers.

Revoked authorizations are removed from encrypted storage when detected. Members can
disconnect the application in Discord's connection settings. A bot restart
invalidates pending OAuth attempts; members can simply start again.

The registered fields always describe the tracked server, including when an
admin configures this application as a Linked Role requirement in another server.
