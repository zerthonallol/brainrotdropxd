<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Brainrot data in src/data/brainrots.ts is generated from Steal a Brainrot wiki categories; `rarityScore` drives `price`, so regenerate rather than hand-edit prices.
- Player state is saved via src/lib/player.functions.ts keyed by Telegram id, verified with Telegram initData HMAC (TELEGRAM_BOT_TOKEN); localStorage is only a fast local backup.
- Owner-only actions (global price overrides, update banner) live in src/lib/owner.functions.ts and are verified server-side via Telegram initData; the owner id is in src/lib/tg-auth.ts.
- Global UI state that memoized cards need (streamer mode, price overrides) lives in src/lib/live.ts as an external store; overrides mutate brainrot objects in place.
- Developer gifts (coins/cases) are queued in `pending_grants` and claimed by the client store, because player state is a client-saved blob the server must not overwrite.
- Live feed shows only real drops from `live_drops`, reported when a brainrot is granted with a source; never reintroduce fake feed items.
- Maintenance mode (`app_settings.maintenance`) hides the app for everyone except the owner id.
