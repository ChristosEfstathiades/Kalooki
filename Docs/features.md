# Features

## User Accounts

- Users can create an account with an email address, a unique username, and a password. Signup also collects a password confirmation (must match) and an optional avatar / profile photo. Password rules: at least 8 characters, including at least one symbol and one capital letter. After signup the account stays inactive until the user verifies their email via an emailed confirmation link. Email verification is only enforced in production; in development accounts are active immediately without verification. When signing in, users can choose a "remember me" option to stay logged in.
- Users can change their username and profile photo at any time from the settings page. The same rules as at signup apply: usernames must stay unique (checked case-insensitively) and photos are JPG/PNG/WebP up to 2 MB. Replacing a photo deletes the old file; the email address cannot be changed.

## Friends

- Users can send a friend request by typing another user's exact username and clicking "submit request". Typing does not reveal a list of users with similar names — only an exact username match is accepted. The recipient receives an in-app notification and can accept or decline the request; the sender can cancel a request that is still pending. Once accepted, the two users become friends, which grants them access to other friends-only features described later. Users can view a list of their friends and remove any connection; removal is silent and mutual (the connection is deleted for both users, and the other person is not notified).

## Private Groups

- Users can create private groups and invite people to join. Only the group's creator (owner) can send invites, and they can only invite users they are friends with — however, members of a group do not all need to be friends with each other. Invitees receive an in-app notification and must accept before joining. Groups are limited to 50 members. Members can leave a group at any time, the owner can remove members and can transfer ownership to another member, and if the owner deletes the group it disbands for everyone.
- Each group has a real-time chat that members use to communicate. Messages are stored in the database for 30 days and then deleted. Outgoing messages are checked for inappropriate language: offending words are censored (masked) but the message is still posted. Any member can report a message; reports are sent to the app's admins/moderators for review.
- The group owner can start private games with custom rules that only members of that group can join. Only one game can be in progress per group at a time.

## Global Chatroom

- There is a public global chatroom that any user can post in. Each user is limited to one message every 3 seconds to prevent spam. Messages are stored in the database for 30 days and then deleted. Messages are heavily censored to block inappropriate language, with particular emphasis on preventing racial abuse; users who repeatedly post abusive content are flagged to the app's admins for action (e.g. muting or banning). Users can click on the name of anyone who has posted in the chat to send them a friend request or report their message; reports are sent to the app's admins/moderators for review.

## In-Game Chat

- Every live game has a table chat, shown in a side panel on the gameplay page, that only that game's players can read and post in. Each player is limited to one message every 3 seconds, and messages are censored and reportable like every other chat. When the game ends the chat closes: nobody — players included — can access the messages any more. The messages remain stored in the database for 30 days (associated with the game's id, the same id the recorded match carries) so moderators can act on reports, and are then deleted like all other chat messages.

## Match History

- Every game is recorded so users can view their match history. (Gameplay and in-game mechanics are documented separately in `kalooki.md`.) Each recorded match stores: the winner (if the game finished), the full scoresheet including round-by-round scores, the players involved and their final placements (1st/2nd/3rd, etc.), the date/time and duration of the match, and the game variant and custom rules that were in effect. Unfinished games (abandoned or where a player quit) are also recorded, marked as incomplete with no winner and noting who left or forfeited. Match records are visible only to the participants of that match and are kept indefinitely.

## Game Modes

- There are two ways to play Kalooki. (1) Public friendly matches, which always use a fixed, universal classic ruleset. (2) Private matches (as described in Private Groups), which can use either the classic ruleset or custom rules set by the group owner.
