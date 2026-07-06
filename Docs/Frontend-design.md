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
- Left hand side of the page contains button to find public match and below that is buttons to send friend requests and to view friends list and to see match history. friends list should be a popup modal.
- right hand side contains a sidebar where users can select to show global public chat or one of their private group chats

## Kalooki Gameplay page

- Users are placed around the felt in a rectangular shape
- Each user is placed at the bottom middle of the screen in their perspective
- Users should see how many cards each player has left
- users can see melds and most recently discarded card in the middle of the felt alongside the draw deck
- a chat button in the table header toggles a side panel with the table chat, which only the game's players can read and type in; the panel shows "chat closed" once the game ends (see features.md, In-Game Chat)

## Rules page

- besides the rules being displayed on the welcome page there should be a separate page dedicated to it.

## match history page

- display table of match history. click match to expand and show more info that is specified in features.md

## settings page

- users can change username, profile picture, and logout

## header

- on all pages except the gameplay and welcome.
- left hand side contains logo of the website which is yet to be made, "KalookiOnline" for now
- right hand side Contains the username and a cog icon that takes user to settings page

## footer

- on all pages except the gameplay.
- contains links to the how to play (rules) page, tips and tricks page, contact page, privacy policy page, and displays copyright text.
