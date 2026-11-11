# Linked roles and the stats endpoint

Remyne owns Discord Linked Roles and stats-role management. Maikaky owns streak
tracking and Lurkr access. The Remyne project's `README.md` contains the cutover
steps and OAuth settings; its `LINKED_ROLES.md` covers role setup and commands.

On the Maikaky host, keep the existing `LURKR_API_KEY`, main bot `token`, and streak
configuration. Set `STATS_API_TOKEN` to a dedicated random secret shared with
Remyne. Expose `GET /internal/stats/:userId` over HTTPS from Maikaky's Express server
on Render's `PORT` (3000 locally). Remyne sends the secret as an
`Authorization: Bearer` header.

The response contains `currentStreak`, `longestStreak`, and `level` for the tracked
server. Streaks come from loaded in-memory history and are calculated on request.
Missing user history gives zero streaks; a Lurkr 404 gives level zero. An unloaded
history or a failed Lurkr request returns 503 so Remyne can retry without publishing
incorrect values.

Remyne also connects to `/internal/stats/events` over WSS with the same bearer
token. Maikaky sends a member ID when a message changes their current or longest
streak. Remyne reconnects after interruptions and keeps its periodic refresh for
missed events, expired streaks, and level changes.
