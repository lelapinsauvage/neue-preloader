# Neue Academy · Preloader prototype (Nebula violet)

The preloader Niccolò and Josh picked (23 Oct 2026). It's a tunnel made of the nebula, read through Neue's waffle glyph (a colour tile with a dark rounded square punched in), in one violet family:
- you travel down it from the first frame;
- when the load finishes, you're pulled in faster and faster;
- the page then opens cell by cell.

Every value is live in the control panel:
- timing, speed, FPS cap and render scale;
- grid and glyph;
- tunnel;
- the near parallax layer;
- the four colour stops;
- the reveal.

**Shortcuts:** H hides the controls, R replays, and Space (or clicking the tunnel, or the Pause button) pauses on the exact frame. While paused, ← → step one frame and the Scrub slider moves through the timeline.

**Sharing:** your settings are saved in the URL. Use "Copy link with these settings" to share a version, or "Copy settings as JSON" to send exact values.

**Structure:** static files only (`index.html`, `style.css`, `main.js`, `assets/`, `fonts/`), with no build step. It uses WebGL2, plus lil-gui from jsDelivr.

**Run it locally:** `python3 -m http.server` in this folder.

**Placeholders:** the load progress is simulated, and "The page underneath" stands in for the hero. Fonts are Geist and Geist Mono (OFL).
