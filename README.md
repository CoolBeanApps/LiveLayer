# LiveLayer Sports Overlay

LiveLayer is a Chrome and Brave extension that puts transparent, movable ESPN and Kalshi information over webpage video.

## Version 0.8.0 highlights

- Visible overlays are enabled on one browser tab at a time
- Separate Widgets, Links, and Widget Editor pages
- Direct ESPN, Kalshi market or sports-event, and Kalshi portfolio link fields
- Granular ESPN score, game, team, and player-stat widgets
- Every ESPN team and player statistic returned for the selected game can become its own widget
- Every visible Kalshi position or order can become its own widget
- Broadcast-style player or position cards with a large current value, smaller target, unit, detail line, and progress bar
- Table-row mode for Kalshi positions and orders, with optional headers
- Live widget preview while editing
- Editable heading, font family, font size, text color, accent color, text opacity, background opacity, width, height, alignment, shadow, and custom CSS declarations
- Transparent, soft-card, square-stat, score-bug, block, and market-chart visual styles
- Matching 160 × 160, 320 × 160, 320 × 320, and 480 × 160 block sizes
- Refresh choices from 0.5 seconds through 120 seconds
- Drag positioning plus width and proportional scale handles
- Newly enabled widgets immediately open in arrange mode with a visible box, resize handles, edit control, and top-right delete button
- A faint 32-pixel placement grid and automatic right-or-below placement keep newly enabled widgets from covering existing widgets when screen space is available
- Optional targets on numeric score, ESPN team-stat, player-stat, Kalshi market, and Kalshi position widgets
- Progress bars show the live value, target, completion percentage, and a full accent-color state at 100%
- Transparent top-layer fullscreen support
- Global appearance settings directly in the pinned extension popup
- Multiple ESPN games, Kalshi markets, and Kalshi account-page sources
- Source dropdown with an All sources view and one widget page per saved source
- Per-widget solid, target-spectrum, and target-threshold number coloring
- Widget settings save immediately while you edit, with no Save widget button
- Named layouts for restoring widget visibility, placement, size, targets, and appearance
- Optional ESPN player numbers and animated numeric changes
- Kalshi sports-event links split into independent widgets for every returned market and stat
- Live stock-style Kalshi price charts that rise and fall from the moment tracking begins
- Separate player tiles for every ESPN athlete in every available stat category
- Multiple passers, receivers, rushers, or defenders can remain on screen at the same time
- A connected Kalshi portfolio automatically creates and arranges one editable widget per visible bet
- Player props are automatically matched to connected ESPN players, stat categories, units, and targets when the wording is clear
- Saved `/portfolio` links continue working when Kalshi redirects to positions, orders, or another account subpage

## Install in Brave or Chrome

1. Unzip `LiveLayer-Sports-Overlay.zip`.
2. Confirm that `manifest.json` is directly inside the extracted folder.
3. Open `brave://extensions` or `chrome://extensions`.
4. Turn on **Developer mode**.
5. Choose **Load unpacked**.
6. Select the extracted folder containing `manifest.json`.
7. Reload any already-open webpage where you want to use the extension.

## Enable one tab

1. Open the webpage or video tab where LiveLayer should appear.
2. Open the extension popup.
3. Turn on **Enable on this tab only**, or choose **Open overlay controls**.

Enabling a new tab disables the previously enabled tab. Your saved links, widgets, and layouts remain available when you move LiveLayer to another tab.

## Add source links

1. Open LiveLayer with the **LL** button.
2. Choose **Links**, immediately to the left of **Full screen**.
3. Choose **Add ESPN game**, **Add Kalshi market or game**, or **Add Kalshi portfolio**.
4. Give the source a short display name, paste the link, then check and save it.
5. Repeat for every game or market you want to follow.

For a Kalshi account page, paste the portfolio URL and save it. LiveLayer opens the page automatically when it is not already connected. Log in if needed and leave that page open. LiveLayer can only use account information visibly rendered in that open tab.

## Choose widgets

The Widgets page is the default page. Its source dropdown has **All sources** plus a separate page for each saved game or market. Changing that dropdown only filters the controls. It does not hide overlays already enabled from other sources.

Click a widget tile to show or hide it. Use the gear on the tile to open its dedicated editor.

ESPN widgets include scores, clock, records, current drive, last play, win probability, passing yards, rushing yards, total yards, first downs, turnovers, sacks, third-down efficiency, possession time, penalties, passing leaders, rushing leaders, receiving leaders, defensive leaders, venue, and update time. After ESPN data loads, LiveLayer creates a separate tile for every returned athlete in every player category. Enabling Jordan Love does not prevent you from also enabling another passer or several receivers.

Kalshi market widgets include YES and NO price, a live price chart, bid and ask, manual position, volume, market status, and update time. A Kalshi sports game or event is expanded into separate price, chart, bid/ask, volume, and status tiles for every returned market.

Kalshi account widgets include portfolio summary, connection status, and a separate tile for every visible position or order captured from the connected page. Newly discovered bets are created as visible card widgets and placed on the next open grid positions.

A Text note tile is always available. If no source links are saved, the Widgets page says **Add the links above** and still shows Text note.

## Broadcast cards and progress bars

Numeric score, ESPN team-stat, player-stat, Kalshi market, and Kalshi position widgets can use targets. In the widget editor, enter the target and optional unit. LiveLayer shows the current value out of the target, the completed percentage, and a live progress bar. A completed bar fills to 100% in the widget accent color.

When both teams are shown in one ESPN score or team-stat widget, each team gets its own progress bar against the same target. Leave the target blank to hide progress.

Each Kalshi position or order widget can use either:

- **Broadcast stat card**: Custom title, detail line, current value, target, unit, and progress bar
- **Table row**: Individual captured cells with optional table headers

For a broadcast card, **Current value source** can use the live Kalshi row, a manual value, or a live ESPN player statistic. LiveLayer first tries to match the bet wording to players from every connected ESPN game. For example, `Jordan Love 200+ passing yards` maps to Jordan Love, Passing, YDS, and a target of 200.

Automatic matching is deliberately conservative. If the wording is unclear or the relevant ESPN game is not connected, the card shows `N/A` instead of inventing a live value. Open its gear to select the ESPN player and stat manually. A manual selection is preserved and will not be overwritten by later automatic matching.

## Live editor

Widget settings open as their own page. Changes appear immediately on the overlay and save automatically. Use **Back to widgets** when you are finished.

The Heading section can show or hide any custom heading. Layer size supports direct width and height, with `0` height meaning automatic. Visual-style and block-size controls let widgets share exact dimensions and fit together like a broadcast dashboard. Player-stat cards can optionally put the jersey number before the player name.

## Global appearance settings

Click the pinned LiveLayer extension icon in the Brave or Chrome toolbar. Below the one-tab controls, Global appearance changes:

- App accent color
- Default widget text color
- Default font
- Default background opacity
- Arrange-grid opacity
- Default number-color behavior and conditional colors

Global changes update LiveLayer immediately. Existing widgets that still use the previous global defaults move to the new defaults, while individually customized widget colors remain intact.

## Conditional number colors

Every numeric widget has a **Number color** section in its editor:

- **Match widget text**: Uses the normal text color
- **One color**: Uses a fixed number color
- **Spectrum toward target**: Blends from the Far away color to the Near target color, then switches to Target reached
- **Switch color at target**: Uses Far away until the target is reached, then switches to Target reached

The color direction is fully editable, so red-to-green and green-to-red both work. Spectrum and threshold modes require a numeric target.

## Saved layouts

Choose **Layouts** beside the source dropdown on the Widgets page. A named layout stores all current widgets, including which are visible, their position and size, targets, conditional colors, and other widget styling.

Use **Apply** to restore one, the circular-arrow button to replace it with the current arrangement, the pencil to rename it, or the X to delete it. Source links are not duplicated inside layouts, so the same saved connections continue feeding every layout.

The custom CSS field accepts declarations for that widget container, for example:

```css
border-radius: 0;
letter-spacing: 1px;
border-left: 4px solid #62d9ff;
```

Bad CSS can hide or move a widget. If that happens, reopen its gear from the Widgets page and clear the CSS field.

## Arrange and resize

Enabling a widget immediately turns on Arrange mode and places the new widget in the next open grid position, first to the right of the previous widget and then below it. The 10%-opacity grid and widget boxes remain visible until you choose **Done**.

Drag a widget to move it. Movement snaps to the grid. Drag the right-edge handle to change width, the bottom-edge handle to change height, or the bottom-right handle to scale the layer and text together. Fixed block sizes are grid-aligned. Use the pencil to edit it or the X in the top-right corner to delete it immediately.

Automatic placement prevents overlap while open screen space remains. If more widgets are enabled than can physically fit in the viewport, LiveLayer uses the position with the least overlap and leaves manual resizing available.

## Fullscreen

Use the video site's own fullscreen button first. LiveLayer promotes its transparent host back into Chromium's top layer when webpage fullscreen begins.

If the site still hides it, choose LiveLayer's **Full screen** button. LiveLayer expands the largest visible video or embedded player beneath the overlays. Press `Esc` to exit and restore the original player styles.

## Refresh speed

Each live widget can refresh every 0.5, 1, 2, 5, 10, 15, 30, 60, or 120 seconds. Widgets using the same source share one request, using the fastest enabled rate for that source.

Half-second polling is aggressive. ESPN, Kalshi, or the browser may rate-limit it. The Kalshi account-page capture reacts to visible page changes, so selecting 0.5 seconds does not guarantee that Kalshi itself updates the page twice per second.

## Shortcuts

- `Alt + Shift + L`: Open controls on the enabled tab
- `Alt + Shift + O`: Hide or show overlays on the enabled tab

## Important limitations

- ESPN's site endpoint is not a guaranteed public developer contract and may change.
- A Kalshi percentage is a market-implied price, not a guaranteed probability.
- A Kalshi chart stores up to 60 live samples while the source is active. It does not claim to be full historical exchange data.
- Personal Kalshi data comes from visible text in an open, logged-in Kalshi page. The extension does not use or store private API credentials.
- Pasting a private portfolio URL cannot authenticate the extension. The corresponding Kalshi tab must be open and logged in, and only bets currently rendered by Kalshi can be imported.
- If an automatic sell, resting order, fill, or position is visible on the connected page, LiveLayer can capture it. If Kalshi does not render it there, LiveLayer cannot retrieve it from the link alone.
- Browser-owned pages, picture-in-picture windows, casting targets, protected native video surfaces, and operating-system-native fullscreen cannot be covered by normal webpage HTML.
- A 0.5-second option does not force the underlying source to publish data that quickly.

## Development check

```bash
npm test
```

The extension uses plain JavaScript and has no build step.
