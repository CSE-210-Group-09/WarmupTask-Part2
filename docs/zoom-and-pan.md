# Design: zoom and pan (issue #2)

**Story:** As a user, I want to be able to properly view 100+ points.
**Tasks:** add zooming and panning; add a button to reset zoom. (Hiding line points, the third task, shipped in PR #3.)

## What it does

- **Ctrl + scroll** (**⌘ + scroll** on a Mac), or a trackpad pinch, over a chart zooms in or out around the pointer.
- **Drag** inside a zoomed chart to pan.
- **Zoom in / Zoom out** buttons zoom around the center, for keyboard users and mice without a wheel. **Reset zoom** returns to all points.
- A status line reads, for example, "Zoomed 4x: X 38.3 to 75.5, Y 31.6 to 50.4."
- Both charts show the same view. Exports show the current view.
- Importing a file or switching an axis between linear and log resets the view.

## Design decisions

### 1. The view is stored as fractions of each axis, not data values

`view.js` keeps, per axis, the visible part of the full range as `[start, end]` fractions, with `[0, 1]` meaning everything. Drawing maps a value through the existing axis (`createAxis().position`) and then through the view (`viewPosition`).

| Option | Why not chosen / chosen |
|---|---|
| **Fractions of the transformed axis** (chosen) | One code path for linear and log axes: zooming a log axis zooms evenly in log space. `scale.js` stays unchanged and keeps its overflow guards for extreme values. |
| Data-value bounds (`xMin..xMax` of the view) | Needs separate log/linear zoom maths, and differences of extreme values such as ±1.8e308 overflow, which `scale.js` was written to avoid. |
| SVG `viewBox` / CSS transform zoom | Cheapest, but scales the text, stroke widths and point markers with the data, and tick labels would not update. |

### 2. Ctrl/⌘ + wheel zooms; a plain wheel scrolls the page

The page is a long single column with two charts. If a plain wheel zoomed, a user scrolling down the page would be trapped zooming whenever the pointer crossed a chart. Requiring Ctrl/⌘ follows embedded maps. Trackpad pinch arrives as a wheel event with `ctrlKey` set, so pinch zooms without extra code. Alternatives: plain-wheel zoom (traps scrolling), a zoom-mode toggle (an extra step for a common action), drag-a-box zoom (precise but conflicts with drag-to-pan).

### 3. One shared view for both charts

The page describes itself as "one dataset, two views", and the charts share data, color and labels. A shared view keeps them comparable: the same points are visible in both. The alternative, an independent view per chart, would need a reset button per chart and makes the charts disagree about what is shown.

### 4. Both axes zoom together; a constant axis is locked

Zooming both axes keeps scatter plots readable; an X-only zoom would suit long line series but leaves dense vertical clusters overlapping. If every value on an axis is equal, that axis has nothing to zoom into, so it stays at full range (its single tick stays centered).

### 5. Limits: 1x to 1000x, panning stays inside the data

`MIN_SPAN = 0.001` caps magnification at 1000x; beyond that, consecutive floating-point values in typical data stop being distinguishable on screen. Panning and zooming out are clamped to `[0, 1]`, so the user can't lose the data off-screen. Dragging pans from the view at drag start rather than accumulating deltas, so rounding can't drift over a long drag.

### 6. Off-screen points are not drawn; the line is clipped

Only points inside the view get a marker. That keeps zoomed 100+ point charts uncluttered, shortens keyboard tab order, and makes exports match the screen. The line still uses every point (so its slope into and out of the view is right) and is clipped to the plot with an SVG `clipPath`, 1 px wider than the plot so strokes at the outermost points stay whole.

### 7. Tick labels add digits as the view narrows

Labels used 3 significant digits. Zoomed into 1000.0-1000.4, every tick would read "1e+3". `formatTicks` in `scale.js` raises the precision until distinct values get distinct labels. Full-view labels are unchanged.

### 8. Redraw at most once per frame

Wheel and drag fire many events per frame. `scheduleRender` coalesces them with `requestAnimationFrame`. A full SVG redraw of a few hundred points per frame is fast enough; a retained-mode update was not needed.

## Testing

- **Unit (`tests/view.test.cjs`, `tests/scale.test.cjs`):** the zoom anchor stays fixed under the pointer; zoom-out and panning are clamped; the 1000x limit; view position and ratio are inverses; zoomed tick labels stay distinct.
- **Browser (`e2e/view-many-points.spec.js`):** with 150 points: Ctrl + wheel zooms and a plain wheel doesn't; buttons; drag-to-pan moves the axis the right way; dragging does nothing unzoomed; reset restores all 150; labels stay distinct at 1000x; hiding line points still works while zoomed; exports match the zoomed view; import and scale changes reset the view.

## Known limits

- No touch pinch on phones: touch drag pans, but there is no two-finger zoom; the buttons work.
- `touch-action: none` on charts with data means a finger on a chart pans the chart, not the page.
