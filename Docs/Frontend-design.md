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
- below those buttons sits the user's own record card: games played, wins and win rate across completed public matches, then either a progress bar toward leaderboard eligibility or their rank once they have it (see features.md, Your Record). It sits under the leaderboard button rather than above the fold, so the ways to start a game keep the top of the page.
- arriving with `?queue` joins the public queue on load, and `?group=<id>` opens that group's dialog; both are cleared from the URL once applied, so a refresh does not repeat them. They back the end-of-game actions on the gameplay page.
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
- gameplay is drag-and-drop first (dnd-kit, with mouse and touch sensors so it works on mobile): drag the deck or the discard top into your hand to draw, drag a hand card onto the discard pile to end your turn, and build sets by dragging cards into a staging tray between the felt and your hand (slots for each set plus a "new set" slot), then lay them all down with one button; staged cards can be dragged between slots or back to the hand
- while a drag is in flight only the legal targets light up: the piles, the tray slots, go-er zones on the ends of tabled sets (low/high for runs), and tabled jokers as swap targets (the dragged card plus any tap-selected cards are offered as the joker's replacements)
- tapping remains as a fallback everywhere: tap a pile to draw, tap-select cards then "Stage set" or "Discard selected", and the go-er / joker buttons on tabled sets still work, which also keeps the game playable without precise dragging
- a chat button in the table header toggles a side panel with the table chat, which only the game's players can read and type in; the panel shows "chat closed" once the game ends (see features.md, In-Game Chat)
- two sort buttons under the hand order it by rank (highest to lowest) or by suit. a card drawn or picked up mid-turn stays unsorted at the right of the hand until the turn ends with it still in hand, or until a sort button is pressed again
- a menu button in the table header opens the game menu: the scoresheet for the match so far (a row per player, a column per round scored, running total on the end, and chips when the game is played for play money) with the quit button at the bottom, behind a confirmation. quitting is the only way out and cannot be undone, so it is deliberately not one tap from the felt
- when a round ends, a popup titled with the round winner shows that round's scoresheet (each player's points gained and running total) and counts down the 10 seconds until the next deal; it cannot be dismissed early. it stays up showing the buy-in prompt while decisions are pending (with a 20-second decision countdown in public matches), reads "paused" instead of a countdown while a player reconnects, and stays up for good once the game is over
- the countdown is followed by the round intro: the deck riffles on the spot, then card backs fly out from it to each seat in dealing order and to your own hand. it is measured off the live layout, plays over the table rather than blocking it, and is suppressed under `prefers-reduced-motion`. the same intro runs for the first round when you land on the table, but only once and only while that round is still untouched, so refreshing (or rejoining after a disconnect) part-way through drops you straight onto the table instead of replaying a deal you already watched
- the final scoresheet lists everyone who played rather than only the players the last round scored, marking anyone knocked out earlier as "out" in the round column, and carries an add-friend icon button beside each opponent still worth adding. Under the table it offers the next game (requeue, play the bots again, or back to the group) beside "back to the lobby" (see features.md, Game Modes)

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
- left hand side contains logo of the website which is yet to be made, "KalookiOnline" for now, followed by a small live "N players online" count with a green dot (hidden on the narrowest screens), then links to the how to play (rules) and tips pages. They are also in the footer, but a player still learning the game should not have to reach the bottom of the page to find them, so they are repeated here and stay on the narrowest screens even though the online count does not. The current page's link is shown in the full foreground colour.
- right hand side Contains the username and a cog icon that takes user to settings page

## footer

- on all pages except the gameplay.
- contains links to the how to play (rules) page, tips and tricks page, contact page, privacy policy page, and displays copyright text.
