# General

No AI slop design / UI / UX such as harsh gradients, uneccesary animations, emojis, etc.
The design should be pragmatic with a focus on UX over fancy design.
I want users to be able to create an account and join a game in as few clicks as possible.
Use appropiate HTML tags and semantic html tags.
needs to be mobile responsive.
all buttons should have pointer cursor.
TailwindCSS should be used.
Take a little inspiration from ([https://play.pokemonshowdown.com/](https://play.pokemonshowdown.com/)) in regards to how the page looks once the user is logged in.
the frontend is a separate SPA in apps/frontend that uses tanstack react.

## Theme / Colours

- The website should have a darker theme by default with colours similar to card game websites such as ggpoker and pokerstars.
- A light theme is available as an opt-in from the settings page (per device, remembered in the browser); dark stays the default. The light theme is the same room by daylight: a soft green-grey background, white panels, the same felt/red/purple brand colours, and chat name colours darkened for contrast on light backgrounds.
- #141616 = Main background color
- A dark blue (#1b2838) = Secondary background colour
- use red (#6a303b) and purple (#533367) colours for buttons. These were selected cause they pair nicely with #35654d which is the colour of the felt
- Text should be white with good contrast to background
- #35654d = colour of felt for gameplay

## Typography

- Use existing fonts for now but make it easy to change in future

## Pages

### Welcome page

- Gives brief introduction to Kaluki and advertises the features of the website.
- Call to action to play should stand out and should take them to the signin/signup page if not logged in.
- below that there are the rules of the game and screenshots of what the gameplay looks like. Extract rules from kalooki.md

## Signin/signup page

- simple forms no bullshit

## Play page

- Users should be redirected to this page if they are logged in
- Left hand side of the page contains button to find public match and below that is buttons to send friend requests and to view friends list and to see match history and the leaderboard. friends list should be a popup modal.
- right hand side contains a sidebar where users can select to show global public chat or one of their private group chats
- below the chat sidebar is a news box for site announcements; its messages come from the static `public/news.json` file in the frontend (edit or swap that file to change what's shown — no code change needed)

## Kalooki Gameplay page

- Users are placed around the felt in a rectangular shape
- Each user is placed at the bottom middle of the screen in their perspective
- opponents are seated in turn order starting from whoever plays after you, and the seat that plays next is tagged "next" so you can see your go approaching
- Users should see how many cards each player has left
- whose turn it is must be readable at a glance, from four cues that always agree: a banner above your hand (accented and naming the action you owe on your turn, muted and naming who you are waiting on otherwise), the seat on turn ringed while the others dim, the draw deck and discard pile ringed while they are legal targets, and the move clock shown on the seat of whoever is on turn rather than floating in the header
- when the turn passes to you the banner and the pile pulse once and then settle; the pulse is suppressed under `prefers-reduced-motion`
- while the tab is in the background and your turn arrives, the browser tab title changes to flag it and reverts once the tab is looked at again
- users can see melds and most recently discarded card in the middle of the felt alongside the draw deck
- a chat button in the table header toggles a side panel with the table chat, which only the game's players can read and type in; the panel shows "chat closed" once the game ends (see features.md, In-Game Chat)
- two sort buttons under the hand order it by rank (highest to lowest) or by suit. a card drawn or picked up mid-turn stays unsorted at the right of the hand until the turn ends with it still in hand, or until a sort button is pressed again
- when a round ends, a popup titled with the round winner shows the scoresheet (each player's points gained and running total) for 5 seconds, then closes on its own; it stays open while buy-in decisions are pending or when the game is over

## Rules page

- besides the rules being displayed on the welcome page there should be a separate page dedicated to it.

## match history page

- display table of match history. click match to expand and show more info that is specified in features.md
- a filter bar above the list: match type (all/public/private), date order (newest/oldest first), and a checkbox to show only matches the user won. filtering happens server-side.

## leaderboard page

- separate page (not a modal) reachable from the play page, linked next to match history.
- a single ranked table of the top public-match players: rank, profile picture + username, win rate, games, wins, best win streak, average points per round, rounds won rate, and average players per game (see features.md, Global Leaderboard).
- the signed-in user's own row is highlighted when they are on the board. explains the 10-public-match eligibility rule above the table; wide stats scroll horizontally on small screens.

## settings page

- users can change username (their robot avatar is generated from it, so it changes too), chat colour (a swatch picker over the fixed palette, see features.md, Chat Messages), switch between the dark (default) and light themes, and logout

## header

- on all pages except the gameplay and welcome.
- left hand side contains logo of the website which is yet to be made, "KalookiOnline" for now
- right hand side Contains the username and a cog icon that takes user to settings page

## footer

- on all pages except the gameplay.
- contains links to the how to play (rules) page, tips and tricks page, contact page, privacy policy page, and displays copyright text.
