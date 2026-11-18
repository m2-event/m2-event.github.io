'use strict';

const Seer = (() => {
  const ranks = Object.freeze(Array.from({ length: 9 }, (_, index) => index));
  const colors = Object.freeze({ black: 'Siyah', white: 'Beyaz' });
  const relations = Object.freeze({ lower: 'Rakip daha düşük', equal: 'Eşit', higher: 'Rakip daha yüksek' });
  const colorOf = (rank) => rank % 2 === 0 ? 'black' : 'white';
  const relationOf = (own, rival) => rival < own ? 'lower' : rival > own ? 'higher' : 'equal';

  function createGame(random = Math.random) {
    const deck = [...ranks];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return { deck, rounds: [] };
  }

  function play(game, own) {
    if (!ranks.includes(own) || game.rounds.length >= ranks.length ||
        game.rounds.some((round) => round.own === own)) return null;
    const rival = game.deck[game.rounds.length];
    const round = { own, color: colorOf(rival), relation: relationOf(own, rival) };
    game.rounds.push(round);
    return round;
  }

  function score(rounds) {
    let own = 0;
    let rival = 0;
    for (const round of rounds) {
      if (round.relation === 'lower') own++;
      if (round.relation === 'higher') rival++;
    }
    return { own, rival, coins: own + Math.max(0, own - rival) };
  }

  function analyze(rounds) {
    const options = rounds.map(({ own, color, relation }) =>
      ranks.filter((rank) => colorOf(rank) === color && relationOf(own, rank) === relation)
    );
    const memo = new Map();
    function possible(index, used) {
      if (index === options.length) return true;
      const key = (index << ranks.length) | used;
      if (!memo.has(key)) {
        memo.set(key, options[index].some((rank) => {
          const bit = 1 << rank;
          return !(used & bit) && possible(index + 1, used | bit);
        }));
      }
      return memo.get(key);
    }

    if (!possible(0, 0)) return null;
    let states = new Set([0]);
    const byRound = options.map((candidates, index) => {
      const next = new Set();
      const valid = candidates.filter((rank) => {
        const bit = 1 << rank;
        let fits = false;
        for (const used of states) {
          if (!(used & bit) && possible(index + 1, used | bit)) {
            next.add(used | bit);
            fits = true;
          }
        }
        return fits;
      });
      states = next;
      return valid;
    });
    const remaining = ranks.filter((rank) => [...states].some((used) => !(used & (1 << rank))));
    return { byRound, remaining };
  }

  return { ranks, colors, relations, colorOf, createGame, play, score, analyze };
})();

if (typeof module !== 'undefined') module.exports = Seer;
