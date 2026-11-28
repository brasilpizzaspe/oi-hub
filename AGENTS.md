<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Hero media is always loaded at runtime from `site_images` (slot `hero`: `video_url` + `image_url` as poster) via `fetchStoreImages`; never hardcode a hero video/image — the admin panel must stay the single source.
- Hero video renders inside a 16:9 `aspect-ratio` stage with `object-fit: cover` at native resolution — keeps any uploaded source (up to 4K) undistorted.
- Hero product carousel motion lives in `src/hooks/use-focus-carousel.ts` (spring-driven, writes transforms straight to the DOM each frame); never re-add native scroll/scroll-snap or CSS transform transitions/animations on `.hero-picks .pick` — they fight the per-frame transforms.
- /acompanhar background belts: single rAF loop in `src/routes/acompanhar.tsx` moves `.bp-belt-track` (two identical halves, wraps at half height) — never add CSS animations/transforms to the belts; old `.tracking-ribbon` rules are dead.
- Storefront scroll reveals use `useStoreReveal` with IntersectionObserver rather than CSS view timelines; `useStoreMotion` follows reduced-motion by default and permits an explicit saved visitor override through the ribbon control, keeping desktop/mobile behavior consistent and content visible without JavaScript.
