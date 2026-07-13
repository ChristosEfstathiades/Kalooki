# Features

## User Accounts

- Users can create an account with an email address, a unique username, and a password. Signup also collects a password confirmation (must match). Each account's avatar is a DiceBear "bottts" robot generated deterministically from the username, so no photo upload is needed. Password rules: at least 8 characters, including at least one symbol and one capital letter. After signup the account stays inactive until the user verifies their email via an emailed confirmation link. Email verification is only enforced in production; in development accounts are active immediately without verification. When signing in, users can log in with either their email address or their username, and can choose a "remember me" option to stay logged in. Email addresses are stored lowercased and matched case-insensitively; usernames must match exactly, including case.
- Users can change their username at any time from the settings page (usernames must stay unique, checked case-insensitively); the email address cannot be changed. Because the avatar is generated from the username, changing the username also changes the robot avatar.
- Users can also choose their chat name colour from the settings page (see Chat Messages), and switch the site between the default dark theme and a light theme — a per-device choice remembered by the browser, not stored on the account.
- Users can delete their account from the settings page. Deletion is a soft delete: the account is deactivated immediately (every session is signed out) and permanently removed after a 30-day grace period, during which signing back in restores the account. Until the purge runs, the username and email stay reserved. The running server purges expired accounts automatically (on boot and every 12 hours); `node ace accounts:purge` does the same for manual or cron-driven runs.

## Friends

- Users can send a friend request by typing another user's exact username and clicking "submit request". Typing does not reveal a list of users with similar names — only an exact username match is accepted. The recipient receives an in-app notification and can accept or decline the request; the sender can cancel a request that is still pending. Once accepted, the two users become friends, which grants them access to other friends-only features described later. Users can view a list of their friends and remove any connection; removal is silent and mutual (the connection is deleted for both users, and the other person is not notified).

## Chat Messages

- Every chat surface (private group chats, the global chatroom, in-game table chat) displays messages as `username: message`. Each user's name is shown in a colour: by default it's deterministically derived from their username, so it's stable but not chosen; a user can instead pick one of a fixed set of colours from the settings page, which then applies to their name in every chat.

## Private Groups

- Users can create private groups and invite people to join. Only the group's creator (owner) can send invites, and they can only invite users they are friends with — however, members of a group do not all need to be friends with each other. While the owner types an invitee's name, a dropdown suggests matching names drawn only from their own friends list (people already in the group are not suggested); unlike friend requests, this never reveals other users' names, because everyone suggested is already a friend. Invitees receive an in-app notification and must accept before joining. The group view lists invites that are still pending, below the member list and visible to all members; the owner can revoke a pending invite, and neither pending invitees nor existing members appear in the invite suggestions. Groups are limited to 50 members. Members can leave a group at any time, the owner can remove members and can transfer ownership to another member, and if the owner deletes the group it disbands for everyone.
- Each group has a real-time chat that members use to communicate. Messages are stored in the database for 30 days and then deleted. Outgoing messages are checked for inappropriate language: offending words are censored (masked) but the message is still posted. Any member can report a message; reports are sent to the app's admins/moderators for review.
- The group owner can start private games with custom rules that only members of that group can join. Only one game can be in progress per group at a time.
- Instead of opening the lobby immediately, the owner can **schedule** the game to open in 1, 3, 6, 12, or 24 hours. Nobody — the owner included — can join a scheduled game until the countdown ends; at that point the lobby opens for joining and the owner starts it as usual. Scheduled games survive a server restart, the owner can cancel one at any time, and a lobby nobody starts within 24 hours of opening is dropped.
- While a group has a lobby open or a game scheduled, it is shown as a **pinned notification** at the top of that group's chat (like a pinned Twitch chat message): a countdown while scheduled, and a join button with the player count once open.
- A private game can optionally be played for **play money** ("chips"). When the owner turns this on, they must set four amounts before opening the lobby: the stake each player puts up, the cost of a buy-in (rebuy), the payment for calling a kalooki (calling the round by laying all thirteen cards in one turn), and the payment for each ordinary call. Chips are a per-match ledger tracked on the scoresheet — no balance is stored on accounts and nothing carries over between games. The money flow is described in `Kalooki.md` ("Play money").

## Global Chatroom

- There is a public global chatroom that any user can post in. Each user is limited to one message every 3 seconds to prevent spam. Messages are stored in the database for 30 days and then deleted. Messages are heavily censored to block inappropriate language, with particular emphasis on preventing racial abuse; users who repeatedly post abusive content are flagged to the app's admins for action (e.g. muting or banning). Users can click on the name of anyone who has posted in the chat to send them a friend request or report their message; reports are sent to the app's admins/moderators for review.

## In-Game Chat

- Every live game has a table chat, shown in a side panel on the gameplay page, that only that game's players can read and post in. Each player is limited to one message every 3 seconds, and messages are censored and reportable like every other chat. When the game ends the chat closes: nobody — players included — can access the messages any more. The messages remain stored in the database for 30 days (associated with the game's id, the same id the recorded match carries) so moderators can act on reports, and are then deleted like all other chat messages.

## Match History

- Every game is recorded so users can view their match history. (Gameplay and in-game mechanics are documented separately in `kalooki.md`.) Each recorded match stores: the winner (if the game finished), the full scoresheet including round-by-round scores, the players involved and their final placements (1st/2nd/3rd, etc.), the date/time and duration of the match, and the game variant and custom rules that were in effect. For play-money games the record also stores each player's net chips and the round-by-round chip movements. Unfinished games (abandoned or where a player quit) are also recorded, marked as incomplete with no winner and noting who left or forfeited. Match records are visible only to the participants of that match and are kept indefinitely. The match history list can be filtered by match type (public/private), ordered newest or oldest first, and narrowed to only matches the user won.

## Global Leaderboard

- There is a global leaderboard for public matches, shown on its own page (not a popup). Once a user has completed 10 public matches they are eligible to appear; only completed public games count — private games (custom rules) and incomplete games (no winner) are excluded from both eligibility and every stat.
- Players are ranked by highest win rate (ties broken by more games played, then more wins). Each row shows the player's profile picture and username alongside their stats: win rate, games played, wins, longest win streak (consecutive public-match wins), average penalty points per round (lower is better), rounds won rate (how often they go out and win an individual round), and average number of players in their games.
- The board shows the top 100 players and is visible to any signed-in user.

## Game Modes

- There are two ways to play Kalooki. (1) Public friendly matches, which always use a fixed, universal classic ruleset. (2) Private matches (as described in Private Groups), which can use either the classic ruleset or custom rules set by the group owner.
