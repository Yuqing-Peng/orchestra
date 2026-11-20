# ostinato

A prototype of a shared listening room built on Spotify: log in with Spotify, search for songs, add them to a shared queue, play them through the Spotify embed player, and chat alongside. There's also an audio visualizer to spice things up.

## Limitations

It's hard to get around Spotify's Premium requirement, so the app is still in Spotify **development mode**. That means:

- the site's URL has to be registered as a Redirect URI in the Spotify Developer Dashboard
- every participant's Spotify account has to be added to the app's allowlist (*User Management*)
- every participant needs a Spotify Premium account

## File structure

```
index.html              → redirects to the landing page
pages/landing/          → main app (Spotify login, search, queue, chat, player)
pages/account/          → profile page (mock data)
visualizer/             → tab-audio visualizer
resources/              → logo + placeholder image
api/                    → optional PHP + MySQL backend for shared chat/queue
```

## Visualizer

Located in `visualizer/index.html`. Click *Share Tab*, pick the tab that's playing music, and turn on "Share tab audio". This only works in Chrome and Edge.
