# LiveLayer privacy notes

LiveLayer stores source links, widgets, named layouts, global appearance settings, and per-widget conditional colors in `chrome.storage.local`. That data stays in the local browser profile unless the browser itself backs up or syncs extension storage.

The extension makes these network requests:

- ESPN game and scoreboard data from `https://site.api.espn.com/`
- Public Kalshi market and event data from `https://external-api.kalshi.com/`

LiveLayer does not contain its own analytics, advertising, tracking pixel, remote script, account login, or private server. It does not place bets or trades. It does not request or store Kalshi credentials.

Because the extension draws over ordinary webpages, its content script is allowed to run on normal HTTP and HTTPS pages. The script does not read or transmit the page's form fields, passwords, cookies, messages, or video contents.

The visible LiveLayer controls and widgets are enabled for only one browser tab at a time. Enabling a new tab disables and removes the overlay host from the previously enabled tab.

When a logged-in Kalshi portfolio, positions, orders, fills, history, activity, or account page is open, LiveLayer reads visible summary and table or card text from that page. It stores a limited local snapshot so the same information can appear in an overlay on another tab. Snapshots are kept in `chrome.storage.local`, capped to recent pages, and sent only between the extension's own components. They are not sent to an outside server.

The account-page feature does not read password fields, session cookies, API keys, or hidden network responses. Closing the Kalshi tab stops live capture. The last local snapshot may remain until newer snapshots replace it or the extension's local data is cleared.
