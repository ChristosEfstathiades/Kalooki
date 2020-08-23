const Express = require("express");
const Http = require("http").Server(Express);
const Socketio = require("socket.io")(Http);
const Deck = require("./deck");

let players = [];

let cards = new Deck([]);
cards.fillDeck();
cards.shuffle();
cards.discardPile.push(cards.deck[0]);
cards.deck.shift();
cards.discardPile.push(cards.deck[0]);
cards.deck.shift();

n = 0;

Socketio.on("connection", socket => {
    players.push({
        points: 0,
        cards: null,
        cardCount: 13,
        joker: 1,
        myTurn: false
    });
    Socketio.emit("playerCount", players.length);
    

    socket.on("start", () => {
        if (players.length > 1 && players.length < 7) {
            newDeck = cards.deck.splice(13);

            cards.orderCards(cards.deck);
            
            players[n].number = n+1;
            players[n].cards = cards.deck;
            n == 0 ? myTurn = true : myTurn = false;
            
            socket.emit("start", {
               playerCount: players.length,
               player: players[n],
               discardPile: cards.discardPile
            });

            cards.deck = newDeck;
            n++;
        }
    });

    socket.on("drawCard", data => {
        players.forEach(player => {
           if (player.number == data.id) {
                player.cardCount++;
                if (data.pile == "deck") {
                    card = cards.drawCard();
                    player.cards.push(card);
                    // cards.orderCards(player.cards); TODO order cards when turn ends
                    socket.emit("newCard", [player, "deck"]);
                } else if (data.pile == "discard") {
                    card = cards.discardPile[0];
                    cards.discardPile.shift();
                    socket.emit("newCard", [card, "discard"]);
                    Socketio.emit("newDiscardPile", cards.discardPile);
                }
           };
        });
    });


    socket.on("disconnect", () => {
        players.pop();
        Socketio.emit("playerCount", players.length);
    });
});

Http.listen(3000, () => {
    console.log("listening");
});

