'use strict';

(() => {
  const { ranks, colors, relations, colorOf, createGame, play, score, analyze } = Seer;
  const notesKey = 'hec-seer-notes-v1';
  const form = get('seer-note-form');
  const ownField = form.elements.namedItem('own');
  let game = createGame();
  let notes = loadNotes();

  function loadNotes() {
    try {
      const saved = JSON.parse(localStorage.getItem(notesKey));
      if (Array.isArray(saved) && saved.length <= ranks.length &&
          saved.every((round) => ranks.includes(round?.own) &&
            Object.hasOwn(colors, round.color) && Object.hasOwn(relations, round.relation)) &&
          new Set(saved.map((round) => round.own)).size === saved.length &&
          analyze(saved)) return saved;
    } catch {}
    return [];
  }

  function saveNotes(message) {
    try { localStorage.setItem(notesKey, JSON.stringify(notes)); } catch {}
    renderNotes(message);
  }

  function renderRounds(target, rounds, info, revealed = null) {
    if (!rounds.length) {
      target.innerHTML = '<p class="muted seer-empty">Henüz tur yok.</p>';
      return;
    }
    target.innerHTML = `<div class="seer-history-wrap"><table class="seer-history">
      <caption>Tur Geçmişi</caption>
      <thead><tr><th scope="col">Tur</th><th scope="col">Sen</th><th scope="col">Rakip</th><th scope="col">Sonuç</th><th scope="col">${revealed ? 'Rakibin kartı' : 'Olası kartlar'}</th></tr></thead>
      <tbody>${rounds.map((round, index) => `
        <tr><th scope="row">${index + 1}</th><td>${round.own}</td><td>${colors[round.color]}</td>
          <td>${relations[round.relation]}</td><td>${revealed ? revealed[index] : info.byRound[index].join(', ')}</td></tr>`
      ).join('')}</tbody></table></div>`;
  }

  function renderRemaining(target, remaining) {
    target.innerHTML = remaining.length
      ? remaining.map((rank) => `<span class="seer-chip seer-${colorOf(rank)}" aria-label="${rank}, ${colors[colorOf(rank)]}">${rank}</span>`).join('')
      : '<p class="muted">Rakibin eli boş.</p>';
  }

  function renderNotes(message = '') {
    const info = analyze(notes);
    ownField.innerHTML = '<option value="">Seç</option>' +
      ranks.filter((rank) => !notes.some((note) => note.own === rank))
        .map((rank) => `<option value="${rank}">${rank} · ${colors[colorOf(rank)]}</option>`).join('');
    get('seer-record').disabled = notes.length === ranks.length;
    get('seer-undo').disabled = !notes.length;
    get('seer-reset').disabled = !notes.length;
    get('seer-note-status').textContent = message;
    renderRounds(get('seer-note-history'), notes, info);
    renderRemaining(get('seer-note-remaining'), info.remaining);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const fields = new FormData(form);
    const own = fields.get('own');
    if (own === '') return;
    const round = { own: Number(own), color: fields.get('color'), relation: fields.get('relation') };
    const next = [...notes, round];
    if (!analyze(next)) {
      get('seer-note-status').textContent = 'Bu ipucu önceki turlarla uyuşmuyor. Kartı, rengi ve sonucu kontrol et.';
      GameSound.play('miss');
      return;
    }
    notes = next;
    form.reset();
    saveNotes(`${notes.length}. tur kaydedildi.`);
    GameSound.play('card');
  });

  get('seer-undo').addEventListener('click', () => {
    notes.pop();
    saveNotes('Son tur silindi.');
    GameSound.play('discard');
  });

  get('seer-reset').addEventListener('click', () => {
    notes = [];
    form.reset();
    saveNotes('Not defteri temizlendi.');
    GameSound.play('deal');
  });

  function matchCard(id, rank, color, fallback) {
    const card = get(id);
    card.className = `seer-match-card${color ? ' seer-' + color : ''}`;
    card.textContent = rank ?? fallback;
  }

  function renderGame() {
    const count = game.rounds.length;
    const finished = count === ranks.length;
    const last = game.rounds.at(-1);
    const info = analyze(game.rounds);
    const result = score(game.rounds);
    const used = new Set(game.rounds.map((round) => round.own));
    get('seer-round-count').textContent = finished ? 'Düello bitti' : `Tur ${count + 1} / 9`;
    matchCard('seer-own-card', last?.own, last && colorOf(last.own), '—');
    matchCard('seer-rival-card', finished ? game.deck.at(-1) : null, last?.color, '?');
    get('seer-own-score').textContent = result.own;
    get('seer-rival-score').textContent = result.rival;
    get('seer-reward').textContent = finished ? `Antrenman sonucu · ${result.coins} jeton` : 'Jetonlar 9 tur sonunda hesaplanır.';
    const outcome = result.own > result.rival ? 'Kazandın.' : result.own < result.rival ? 'Rakip kazandı.' : 'Düello berabere.';
    get('seer-game-status').textContent = finished ? `${outcome} ${result.coins} jeton.` : last
      ? `${count}. tur · Rakip ${colors[last.color].toLocaleLowerCase('tr')} kart oynadı. ${relations[last.relation]}.`
      : 'İlk tur için bir kart seç.';
    get('seer-hand').innerHTML = ranks.map((rank) => `
      <button type="button" class="seer-card seer-${colorOf(rank)}" data-seer-card="${rank}"
        aria-label="${rank}, ${colors[colorOf(rank)]}${used.has(rank) ? ', oynandı' : ''}" ${used.has(rank) ? 'disabled' : ''}>${rank}</button>`
    ).join('');
    renderRounds(get('seer-game-history'), game.rounds, info, finished ? game.deck : null);
    renderRemaining(get('seer-game-remaining'), info.remaining);
  }

  get('seer-hand').addEventListener('click', (event) => {
    const button = event.target.closest('[data-seer-card]');
    if (!button) return;
    const result = play(game, Number(button.dataset.seerCard));
    if (!result) return;
    const total = score(game.rounds);
    const finishWin = game.rounds.length === ranks.length && total.own > total.rival;
    GameSound.play(finishWin ? 'win' : result.relation === 'lower' ? 'point' : result.relation === 'equal' ? 'tie' : 'miss');
    renderGame();
    if (event.detail === 0) (get('seer-hand').querySelector('button:not(:disabled)') || get('seer-new-game')).focus({ preventScroll: true });
  });

  get('seer-new-game').addEventListener('click', () => {
    game = createGame();
    renderGame();
    GameSound.play('deal');
  });

  renderNotes();
  renderGame();
})();
