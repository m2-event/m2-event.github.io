'use strict';

(() => {
  const { ranks, colors, relations, colorOf, createGame, play, score, analyze } = Seer;
  const notesKey = 'hec-seer-notes-v1';
  const form = get('seer-note-form');
  const colorOrder = ['white', 'black'];
  const noteHand = get('seer-note-hand');
  let draft = emptyDraft();
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

  function renderColorRows(cards, renderCard) {
    return colorOrder.map((color) => {
      const row = cards.filter((rank) => colorOf(rank) === color);
      return row.length
        ? `<div class="seer-card-row" role="group" aria-label="${colors[color]} kartlar">${row.map(renderCard).join('')}</div>`
        : '';
    }).join('');
  }

  function renderHand(target, used, isNotes = false) {
    target.innerHTML = renderColorRows(ranks, (rank) => {
      const color = colorOf(rank);
      const played = used.has(rank);
      return `<button type="button" class="seer-card seer-${color}" data-seer-card="${rank}"
        aria-label="${rank}, ${colors[color]}${played ? ', oynandı' : ''}"
        ${isNotes ? `aria-pressed="${draft.own === rank}"` : ''} ${played ? 'disabled' : ''}>${rank}</button>`;
    });
  }

  function renderRemaining(target, remaining) {
    target.innerHTML = remaining.length
      ? renderColorRows(remaining, (rank) => `<span class="seer-chip seer-${colorOf(rank)}" aria-label="${rank}, ${colors[colorOf(rank)]}">${rank}</span>`)
      : '<p class="muted">Rakibin eli boş.</p>';
  }

  function emptyDraft() {
    return { own: null, color: null, relation: null };
  }

  function renderDraft() {
    for (const button of form.querySelectorAll('[data-seer-card],[data-seer-color],[data-seer-relation]')) {
      const { seerCard, seerColor, seerRelation } = button.dataset;
      const selected = seerCard !== undefined ? draft.own === Number(seerCard)
        : seerColor !== undefined ? draft.color === seerColor : draft.relation === seerRelation;
      button.setAttribute('aria-pressed', String(selected));
      if (seerCard === undefined) button.disabled = notes.length === ranks.length;
    }
    get('seer-record').disabled = Object.values(draft).some((value) => value === null) || notes.length === ranks.length;
  }

  function renderNotes(message = '') {
    const info = analyze(notes);
    renderHand(noteHand, new Set(notes.map((note) => note.own)), true);
    renderDraft();
    get('seer-undo').disabled = !notes.length;
    get('seer-reset').disabled = !notes.length;
    get('seer-note-status').textContent = message;
    renderRounds(get('seer-note-history'), notes, info);
    renderRemaining(get('seer-note-remaining'), info.remaining);
  }

  form.addEventListener('click', (event) => {
    const button = event.target.closest('[data-seer-card],[data-seer-color],[data-seer-relation]');
    if (!button || button.disabled) return;
    const { seerCard, seerColor, seerRelation } = button.dataset;
    if (seerCard !== undefined) draft.own = Number(seerCard);
    else if (seerColor !== undefined) draft.color = seerColor;
    else draft.relation = seerRelation;
    get('seer-note-status').textContent = '';
    renderDraft();
    GameSound.play('card');
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (get('seer-record').disabled) return;
    const round = { ...draft };
    const next = [...notes, round];
    if (!analyze(next)) {
      get('seer-note-status').textContent = 'Bu ipucu önceki turlarla uyuşmuyor. Kartı, rengi ve sonucu kontrol et.';
      GameSound.play('miss');
      return;
    }
    notes = next;
    draft = emptyDraft();
    saveNotes(`${notes.length}. tur kaydedildi.`);
    noteHand.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
    GameSound.play('card');
  });

  get('seer-undo').addEventListener('click', () => {
    notes.pop();
    draft = emptyDraft();
    saveNotes('Son tur silindi.');
    GameSound.play('discard');
  });

  get('seer-reset').addEventListener('click', () => {
    notes = [];
    draft = emptyDraft();
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
    renderHand(get('seer-hand'), used);
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
