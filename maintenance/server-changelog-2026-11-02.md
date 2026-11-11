# Main server changelog — November 2–10, 2026

Server: **Boudrozata // 🜲 Millennavia 🜲** (`1216816878937313442`).

Covers November 2 at 00:00 through November 10 at 18:35, Vancouver time (UTC−7). Based on **1,890 Discord audit entries**, exported with `bun maintenance/listServerChanges.ts`. Full records, including actors, timestamps, reasons, IDs, and old/new values, are in [server-changes-2026-11-02.json](./server-changes-2026-11-02.json). The live recheck added 123 entries after the first export's November 9 at 22:44 cutoff. Channel-move details below also use Carl-bot's historical logging messages.

Repeated automated changes and temporary setup changes are grouped below. Channel and role names use plain typography for readability. This records changes visible in Discord's audit log; message edits, ordinary messages, and other activity absent from that log are outside its coverage. Audit entry counts are not necessarily counts of individual affected members or messages.

## Channels and server settings

- **Added Openfrontio-Updates and Perks** on November 9. Openfrontio-Updates received its helmet emoji and an **OpenFront.io #📢—announcements** follower webhook.
- **Archived Movies-and-stories** on November 4, moving it from Community Hub through Onboarding (technical) into Archived. **Archived Laws-for-operators** on November 8, moving it out of Laws. Historical logging messages confirm both moves; see the reorder investigation below.
- **Created the Information category** on November 9 at 23:45. Carl-bot logged Other-servers moving there from Community Hub at 23:49. The current channel layout also places Perks, the active Roles-Information channel, and Server-Outline there.
- **Converted VW-News into an announcement channel** on November 9.
- **Updated the server description from version 17.5.2 to 17.6** on November 9.
- **Changed the server tag to MXYZ** on November 4.
- **Updated the Debates topic** to “You can 1v1 someone here” on November 9.
- **Standardized channel names and tree prefixes** for Roles-Information, Europedex, Court, Test, Welsh-Empire-Bulletin, Anything-but-E-Sex, Alliance-flags-drive, Dynomyn, BwBp, Message-Streaks, Other-servers, and Defcon. Other-servers also received a ➕ emoji.
- **Temporarily raised VC 2's user limit from 3 to 4** on November 2; restored it to 3 on November 7.
- Created and deleted a temporary **test** text channel on November 7.
- Recorded **12 channel-reordering entries**: the five from the first export investigated below, plus seven after that export's cutoff.
- Automatic ServerStats channel-name updates are included in the export and the channel-update count below.
- Late November 9 and on November 10, adjusted prefixes on sky-squid-game, Monthly-Tournaments, Elections, Doing-your-dares, Perks, Openfrontio-Updates, and Server-Outline. Standardized the six statistics counters to **✦ All members**, **✦ Members**, **✦ Citizens**, **✦ Prisoners**, **✦ Suspicious Accounts**, and **✦ Bots**. Temporary Bulletin/Operator-Applications name changes were reverted; a temporary NSFW toggle on the Suspicious Accounts counter was also reverted.

The [server's published 17.6 update notes](https://discord.com/channels/1216816878937313442/1216817216230785185/1508813400698785792) describe Statbot replacing ServerStats for statistics, identify Perks as the boosting/level-perks channel, and give the stated reason for archiving Movies-and-stories. Those notes also list moving update history to a Google document as future work.

## Investigation of the original five reorder entries

All times are Vancouver time. These are the five entries referenced in the first export. Discord's audit payloads contain a count but no affected channel IDs or positions; historical bot logs identify some of the changes.

| Time | Channel(s) | Evidence and confidence |
| --- | --- | --- |
| November 2, 02:03:33 | Message-Streaks / Other-servers | **Unconfirmed candidate pair.** Seconds after this entry, Other-servers changed its prefix from `╠` to `╚`, and Message-Streaks changed from `╚` to `╠`. This suggests they swapped their relative order, but does not identify which channel was dragged. [Other-servers rename](https://discord.com/channels/1216816878937313442/1216817281607270520/1566739599156314125), [Message-Streaks rename](https://discord.com/channels/1216816878937313442/1216817281607270520/1566739620270575679). |
| November 4, 18:15:57 | Movies-and-stories | **Confirmed category moves.** Carl-bot recorded Community Hub → Onboarding (technical) → Archived in the same batch. The audit count is 3; the two logged category transitions do not identify every operation counted in that entry. [Move log](https://discord.com/channels/1216816878937313442/1216817281607270520/1567709046709026839). |
| November 8, 11:20:30 | Laws-for-operators | **Confirmed category move.** Carl-bot recorded Laws → Archived five seconds later. The nearby Defcon prefix edit followed this move. [Move log](https://discord.com/channels/1216816878937313442/1216817281607270520/1569054041323864284). |
| November 9, 14:21:50 | Openfrontio-Updates | **Likely.** The same actor created this channel in Community Hub 6.7 seconds before the single-count reorder entry. There is no position-change log proving the target. [Creation log](https://discord.com/channels/1216816878937313442/1216817281607270520/1569462024923254835). |
| November 9, 14:28:27 | Perks | **Likely.** The same actor created this channel in Community Hub 8.3 seconds before the single-count reorder entry. There is no position-change log proving the target. [Creation log](https://discord.com/channels/1216816878937313442/1216817281607270520/1569463681840976045). |

Exact old/new positions were not recovered. The server outline is edited in place, and the checked message-edit logs did not preserve an outline snapshot for these moves.

## Roles and integrations

- **Added a Linked Roles section and five stat-role slots** on November 8. At the refreshed export, the slots were named **10🔥21 • Level 24**, **68🔥 • Level 53**, **32🔥 • Level 32**, **Unclaimed 4 - Click to Claim**, and **Locked 5 - Not Available**. Setup included claim/lock name changes, colors, and subsequent streak/level updates.
- **Renamed Mijovian Daily Art Prompts to Maikaky** on November 7; added **Manage Roles** to its role permissions on November 8.
- Created **Test Role**, renamed it to **㏕len**, then **MXYZ**, and adjusted its color.
- Renamed level 26's Iron Aficionado suffix from **Vanished → Ofnine → Some**, and level 27's from **Abused → Often**.
- Added the **Remyne integration** on November 8 and the **Statbot integration and bot** on November 9. Statbot received **Manage Messages** and briefly received **Administrator**, which was removed about 79 seconds later.
- Changed permissions for **five application commands** on November 8, explicitly disabling them for `@everyone`. The audit entries identify command IDs but do not provide their names.
- Recorded **13 role-reordering entries**. These entries do not contain the resulting role positions.
- Removed these roles:
  - November 2: **He/him (legacy)**, **She/her (legacy)**, **Votes of the Day (legacy)**, **Facts of the day: Flynan edition (legacy)**, **The Jury (legacy)**, and **Invincible**.
  - November 7–8: temporary **Testier Role**, **Test Dummy Bot - DO NOT ADD WITHOUT PERMISSION**, **Don't click names with CF**, and **Custom Role | STAFF ONLY**.
  - November 8: **VWOT (archived)** and **ABUC (archived)**.

Staff and bot role assignments, included in the 221 member-role update entries:

- **mythovy** lost Super Operator on November 3 and regained it on November 5.
- **funnygoyim** received Mini Operator and **stillchillrealz** received Super Operator on November 8.
- **ihatezezaks08** and **rossotx6** lost Operator on November 9; **rossotx6** regained it on November 10. **heilmyth** briefly received Operator, then received Super Operator and had Operator removed.
- **Myne** switched from Fun Bots to Utility Bot on November 7. **Statbot** received Moderation bots on November 9; **MPEG-V**, **Statbot**, and **Carl-bot** also received the general Bots role that day.

## Channel permissions

- Recorded **1,115 permission-overwrite entries across 266 channels/categories**: 1,036 additions, 44 updates, and 35 removals.
- **Myne added 958 neutral role overwrites across 250 channels/categories**, plus made **2 updates** removing the MXYZ role's explicit Send Messages grants in City Square and the Lobby. The role was named ㏕len at the time. The neutral additions (`allow: 0`, `deny: 0`) do not themselves grant or deny permission bits.
- **meowyfraa added 62 other neutral overwrites**, covering test/stat roles, Information's initial role entries, and one NQN overwrite. These include the creative/discussion-channel additions.

Substantive permission changes, grouped by channel:

| Channel/category | Changes recorded |
| --- | --- |
| Information | Added View Channel/Read Message History allows and a Send Messages deny for Citizens; posting/thread allows for Mini Operator, Operator, and Head Operator; View Channel denies for An Arrival and Suspicious Account; and a Quarantine restriction added by Wick. |
| Movies-and-stories; Laws-for-operators | Added explicit View Channel/Connect denies for `@everyone`, added those allows for Thy Titan, and removed several prior Citizens, arrival/suspicious-account, and operator-role overwrites. |
| Community Hub; Message-Streaks; Happy-Birthday | Added Create Public Threads and Send Messages in Threads allows for Citizens. Happy-Birthday also gained an explicit Send Messages allow. Community Hub's thread allows were briefly removed and restored. |
| Polls | Citizens gained Send Messages in Threads on November 4; that allow was removed on November 7. |
| Laws | Citizens gained invite/public-thread/private-thread/thread-message allows; their Send Messages deny remained. Removed their Embed Links/Attach Files allows and most explicit denies. Removed `@everyone`'s View Channel allow and most denies. Added a View Channel deny for An Arrival and Suspicious Account, and a View Channel allow for Prisoners. Added a broad NQN bot overwrite and removed three operator-role overwrites. |
| Shortcut | Changed Use External Emojis for `@everyone` from allow to deny. Added View Channel, Send Messages, Manage Messages, and Pin Messages allows for Fun Bots, plus a broad member-specific overwrite for dovemewo. Removed NQN and Myne overwrites. |
| Verify-here; Flynan-Logs; Senate-discussions | Added View Channel/Connect allows for Thy Titan. Removed several prior staff, Citizens, and moderation-bot overwrites from Verify-here/Flynan-Logs; also cleared Flynan-Logs' `@everyone` Read Message History deny. |
| Archived; Daily-Member-Prompts | Removed Thy Titan's explicit View Channel/Connect allows. Removed Myne's member-specific overwrite from Daily-Member-Prompts. |
| Monthly-Tournaments | Cleared `@everyone`'s View Channel/Connect denies. Reduced Citizens' explicit allows to View Channel and Read Message History and cleared their explicit denies. |
| sky-squid-game | Cleared `@everyone`'s View Channel deny, added View Channel/Read Message History allows for Citizens, and removed three member-specific overwrites. |
| Propaganda | Added a Quarantine overwrite denying View Channel, Send Messages, invites, and thread creation/messages. Cleared `@everyone`'s Send Messages deny; its View Channel/Connect denies remained. |
| VIZTV; Normal-Counting | Removed the member-specific overwrites for MGTV24 Web in VIZTV and DillemicSync in Normal-Counting. |
| Normal-Counting; Polls | Added explicit View Channel/Send Messages allows for Test Role, subsequently renamed MXYZ. |
| City Square; Lobby; Community Hub; Testing; Parliament; temporary test channel | Tested View Channel/Send Messages and visibility/history overrides for Test Role/㏕len and Testier Role. MXYZ's overrides in the surviving channels/categories ended neutral; its Community Hub overwrite was removed and re-added neutral. The temporary test channel was deleted. Make it a Quote also temporarily received a City Square overwrite, which was later removed. |

These descriptions concern explicit overwrites. Effective member access also depends on server roles and other applicable overwrites. Exact bitfields and intermediate reversals are retained in the export.

## Onboarding

On November 4:

- Removed **Movies and stories** from the notification-role choices.
- Revised descriptions for **Viewers War**, **Announcements**, **Polls**, and **Updates**. Updates now says “Get pinged when the server gets an update.”
- Changed one onboarding prompt from single-select to multiple-select.

## Emoji and stickers

- Removed emoji **MJV_STFU** on November 3 and **MJV_Myjoism_Dillem_Myjo** on November 9.
- Removed eight stickers on November 4: **You right now Maiko yapping**, **Maiko turning into bird**, **Vizterel x RG "what if I wank"**, **Myjo**, **Absolute Zinema**, **Bruggity**, **Mouth door Speechbubble**, and **Brain IQ: Big brain**.
- Deleted the server sticker **kandiey** and added the server sticker **whatsapp yahu** on November 9.

## Other logged activity

- **45 thread creations, 20 thread updates, and 1 thread deletion**. Updates were **17 unarchives**, a tag update for Animated Flag of Uikhan, and two thread renames. No thread-lock changes were recorded. The deleted thread was **You haven't voted tho 🅱️🅾️ℹ️**.
- **221 member-role update entries**, covering staff/bot assignments above plus level rewards, onboarding/interests, and other member roles.
- **147 member-update entries**: **90 communication-timeout timestamp updates affecting 11 members** (86 by Carl-bot) and **57 nickname changes**. Timeout timestamp changes include expired/reset values, so this is not a count of 90 new active timeouts.
- **2 bans, 1 unban, and 1 kick**.
- **44 message-deletion entries, 6 bulk-deletion entries, and 1 pin**. These counts describe audit entries, not total deleted messages.
- **9 invite creations and 1 invite deletion**. Invite codes remain in the full export rather than this summary.
- **6 AutoMod message-block entries**.

## Audit totals

| Action | Entries |
| --- | ---: |
| Channel create / update / delete / reorder | 4 / 118 / 1 / 12 |
| Permission overwrite create / update / delete | 1,036 / 44 / 35 |
| Role create / update / delete / reorder | 11 / 70 / 12 / 13 |
| Member role update / member update | 221 / 147 |
| Thread create / update / delete | 45 / 20 / 1 |
| Invite create / delete | 9 / 1 |
| Message delete / bulk delete / pin | 44 / 6 / 1 |
| Ban / unban / kick | 2 / 1 / 1 |
| Sticker create / delete; emoji delete | 1 / 9; 2 |
| Onboarding prompt update | 6 |
| Application command permission update | 5 |
| Integration create / bot add / webhook create | 2 / 1 / 1 |
| Server settings update / server tag update | 1 / 1 |
| AutoMod message block | 6 |
| **Total** | **1,890** |

Discord's installed API enum does not name action codes **16**, **33**, and **211**; these are channel reorder, role reorder, and server-tag update respectively. Their original numeric codes and payloads are preserved in the export. Discord retains audit entries for 45 days; see the [audit log reference](https://github.com/discord/discord-api-docs/blob/main/developers/resources/audit-log.mdx). Vancouver uses UTC−7 year-round in this period; see [B.C.'s time change notice](https://www2.gov.bc.ca/gov/content/governments/celebrating-british-columbia/daylight-saving-time).
