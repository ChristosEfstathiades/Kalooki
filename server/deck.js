module.exports = class Deck {
    constructor(deck) {
        this.deck = deck;
    }

    suits = ['Heart', 'Spade', 'Diamond', 'Club'];
    pictures = ['Jack', 'Queen', 'King', 'Ace'];
    orders = [0.1, 0.2, 0.3, 0.4]
    tempone = null;
    temptwo = null;

    discardPile = [];

    fillDeck() {
        this.suits.forEach(suit => {
            for (let i = 2; i < 11.; i++) {
                this.deck.push({
                    value: i,
                    suit: suit,
                    type: 'number',
                    img: `${i}` + suit[0],
                    order: i + this.orders[this.suits.indexOf(suit)]
                });
            };
            this.pictures.forEach(picture => {
                this.deck.push({
                    value: picture == 'Ace' ? 11 : 10,
                    suit: suit,
                    type: picture,
                    img: picture[0] + suit[0],
                    order: 10 + (this.orders[this.suits.indexOf(suit)]) + (this.orders[this.pictures.indexOf(picture)] * 10)
                });
            });
        })
        this.tempone = this.deck;
        this.temptwo = this.deck;
        this.deck = this.tempone.concat(this.temptwo);
    }

    shuffle() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * i);
            let temp = this.deck[i];
            this.deck[i] = this.deck[j];
            this.deck[j] = temp;
        }
    }

    drawCard() {
        this.card = this.deck[0];
        this.deck.shift();
        return this.card;
    }

    compare(a, b) {
        let orderA = a.order;
        let orderB = b.order;

        let comparison = 0;
        if (orderA > orderB) {
            comparison = 1;
        } else if (orderA < orderB) {
            comparison = -1;
        }
        return comparison;
    }

    orderCards(hand) {
        hand.sort(this.compare)
    }

}