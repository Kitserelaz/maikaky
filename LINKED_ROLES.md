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
   ALT_TOKEN=your_alt_bot_token
   ALT_CLIENT_SECRET=your_alt_application_client_secret
   ALT_LINKED_ROLES_TOKEN_MESSAGE_ID=your_alt_encrypted_token_message_id
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
   ALT_TOKEN=existing_alt_bot_token
   ALT_CLIENT_SECRET=existing_alt_application_client_secret
   ALT_LINKED_ROLES_TOKEN_MESSAGE_ID=copy_existing_alt_message_id_unchanged
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
   - `/alt/linked-roles`
   - `/alt/oauth/discord/callback`

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

   In the **alt application's** Developer Portal, register
   `https://your-production-domain/alt/oauth/discord/callback` under
   **OAuth2 → Redirects** and set **Linked Roles Verification URL** to
   `https://your-production-domain/alt/linked-roles`. Install the alt in the
   tracked server. The alt uses REST only; the main bot supplies member data.

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

## Alt application: permission requirements

The main application keeps its four requirements. The alt application exposes:

| Requirement | Metadata key | Guild permission |
| --- | --- | --- |
| Has Timeout Members permission | `has_timeout_members_permission` | Moderate Members |
| Has Manage Roles permission | `has_manage_roles_permission` | Manage Roles |

The alt also exposes the integer-equality requirement **Stats role slot ID**
(`stats_role_slot_id`).

Set `ALT_TOKEN`, `ALT_CLIENT_SECRET`, and `ALT_LINKED_ROLES_TOKEN_MESSAGE_ID`.
Both applications' configuration and encrypted token messages are required at
startup. The alt token must belong to a different application, and its message
ID must differ from `LINKED_ROLES_TOKEN_MESSAGE_ID`.

The alt's domain and protocol come from `DISCORD_REDIRECT_URI`; there is no
separate alt redirect setting. Its routes are `/alt/linked-roles` and
`/alt/oauth/discord/callback`. With the current local redirect configuration,
register `http://localhost:3000/alt/oauth/discord/callback` in the alt application's
**OAuth2 → Redirects** and set its **Linked Roles Verification URL** to
`http://localhost:3000/alt/linked-roles`. Use the corresponding HTTPS URLs for
production. Install the alt application in the tracked server so admins can
select it as a Linked Roles provider.

For this installation, the alt application is `1569073773158858822` and its
verified encrypted message is `1569079146800353320`; the message ID has been
saved privately in `.env`. The metadata fields are registered on startup and its
local verification URL is configured. Finish the account setup by adding the callback URL in
the [alt application's OAuth2 settings](https://discord.com/developers/applications/1569073773158858822/oauth2)
and [installing the alt in the tracked server](https://discord.com/oauth2/authorize?client_id=1569073773158858822&scope=bot&permissions=0&guild_id=1216816878937313442&disable_guild_select=true).

Each member authorizes the alt separately from the main application. The two
applications have separate OAuth state, cookies, refresh tokens, REST clients,
and update queues. Existing main connections do not need to reconnect.

The permission values use effective guild permissions: Administrator and the
server owner satisfy both checks. They indicate permission possession rather
than whether an action can be taken against a particular member or role.
Members outside the tracked server receive `0` for both fields. Failed API
requests retain previously published values until a successful sync.

Alt syncs run at startup, after authorization, and every five minutes. Member
role changes, joining/leaving, role permission edits/deletions, and ownership
changes also queue updates through the main bot's existing Gateway connection.
Alt syncing does not wait for streak data or call Lurkr.

## Stats role slots

1. Restart the bot to register **Stats role slot ID** and the admin command.
2. Create or select a Linked Role. In its requirements, choose the alt application
   and enable **Stats role slot ID**, with its value set to `1`.
3. Run `/stats-role slot slot:1 role:@YourRole` with **Manage Server** in the
   tracked server. The main bot needs **Manage Roles** and a role above that role.
4. Repeat for slots `2`, `3`, and so on, setting each role's requirement to its
   matching number. The bot cannot read or configure these requirements, so the
   command records the mapping you supply.

Run `/stats-role setup` with **Manage Server** to replace every configured stats
role's channel overwrite with empty allow and deny permissions. This applies to
existing nonempty overwrites and missing overwrites; already-empty overwrites
are skipped without an update request. The command reports the skipped count.
All needed stats role changes for a channel are sent in one update, preserving
the other role and member overwrites. Fully configured channels receive no update.
It targets categories and channels that were not synced to their category when setup began;
synced children inherit their category's changes. Other roles' overwrites are
not edited. The bot needs permission to manage overwrites in the target channels.
The command reports successful and failed overwrites, logs each channel result,
and keeps running if an individual channel update fails. It does not shut down the bot.

Connected members initially publish slot `1`. The first processed claim reserves
that slot for the claimant, saves the ownership, and renames the role using their
current streak, longest streak, and Lurkr level: `8🔥21 • Level 23`. When current
and longest streaks match, the name shortens to `8🔥 • Level 23`.
Its owner continues publishing `1`; unassigned members advance
to `2`. Later claims follow the same pattern. A member can own only one slot.
Members outside the tracked server publish `0`.

Set unused role names with `/stats-role config unclaimed_format:{status} Role {slot}`.
This format applies only to available slots. Configure unavailable slots
independently with `/stats-role config locked_format:🔒 Slot {slot}`.
`{status}` expands to `Unclaimed` or `Locked` for the respective format;
`{slot}` expands to the slot number. Both placeholders are optional. The default
for each format is `{status} Role {slot}`, and resulting names must fit Discord's
100-character limit. The available format is saved as `statsRoleNaming.nameFormat`
and the locked format as `statsRoleNaming.lockedNameFormat` in the non-streak
data message. Changing one does not change the other.

Set claimed role names separately with
`/stats-role config claimed_format:{streak} • Level {level}`. This is the default
claimed format. `{streak}` produces `8🔥21` or `8🔥` when the two streaks match;
`{current}`, `{longest}`, and `{level}` insert their numeric values individually.
The claimed format is saved as `statsRoleNaming.claimedNameFormat` in the same
data message. All format options are optional and can be provided together.
Omitting an option leaves its saved format unchanged; omitting all makes no
configuration changes. Names update after configuration and claims, and during
startup and periodic reconciliation.

Set available and locked role colors independently with
`/stats-role config unclaimed_color:#808080 locked_color:#303030`. Each color is
six hexadecimal digits, with an optional `#` prefix. Both options are optional;
omitting one keeps its saved value. Colors are saved as
`statsRoleNaming.unclaimedColor` and `statsRoleNaming.lockedColor` in the same
data message. If a color has not been configured, that state's existing role
color is preserved. Unused role name and color changes use a single edit and are
skipped when already correct. Claimed roles still inherit their owner's highest
role colors.

Claimed stats roles also copy their owner's highest role colors, including
gradient colors when present. Name and color changes are combined into one edit
and skipped when both already match. Colors refresh on claim and during the
five-minute reconciliation cycle.

Unclaimed stats roles appear above claimed ones in ascending slot order. A newly
claimed role moves below all other stats roles, preserving the order of previous
claims. Releasing a slot returns it to ascending order among the unclaimed roles.
Reordering uses a single batch request when changes are needed and keeps stats
roles in their existing hierarchy positions so unrelated roles are not reordered.
Position update failures are logged and retried during periodic reconciliation.

Simultaneous claim events are processed through a single queue. If another
member also receives an already claimed role, the bot attempts to remove it and
publishes that member's assigned or next available slot. There can be temporary
overlap while these requests complete. Failed renames or removals are logged and
retried every five minutes; Discord permissions or API restrictions must be
resolved if removal continues failing.

Mappings and ownership are stored in `statsRoleSlots` in the non-streak data
message. When the recorded owner loses the role, the bot clears and saves the
ownership, restores the configured Unclaimed/Locked name, and refreshes slot
metadata. Removing a competing claimant's role does not release the slot.
Reconciliation also releases slots whose owners are still in the server but no
longer hold their roles, covering missed events. Reservations survive restarts,
OAuth disconnection, and server departures; absence from the server alone does
not release a slot. Claimed slots cannot be remapped to another role.
The bot reconciles existing holders on startup and every five minutes. Claims
missed while offline are resolved in the order members are observed during
reconciliation, since Discord does not provide role acquisition timestamps.
If the next number has no configured role yet, members keep that slot value
until an admin sets up its role.

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

The alt uses its own main-bot-authored message selected by
`ALT_LINKED_ROLES_TOKEN_MESSAGE_ID`, in the same data channel and encrypted with
the same `LINKED_ROLES_ENCRYPTION_KEY`. Its attachment has the same filename and
format but contains only alt OAuth tokens. Both messages are accessed through
the main bot, so the alt does not need access to the data channel. Preserve both
message IDs and the encryption key when deploying; do not recreate the stores
on startup or overwrite the main message when configuring the alt.

Revoked authorizations are removed from encrypted storage when detected. Members can
disconnect the application in Discord's connection settings. A bot restart
invalidates pending OAuth attempts; members can simply start again.

The registered fields always describe the tracked server, including when an
admin configures this application as a Linked Role requirement in another server.
