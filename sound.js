'use strict';

const GameSound = (() => {
  const button = document.getElementById('sound-toggle');
  const storageKey = 'hec-game-sound-v1';
  let enabled = readPreference();
  let context;

  const effects = {
    card: [[230, 0, .075, .045, 'triangle']],
    deal: [[250, 0, .065, .04, 'triangle'], [370, .055, .085, .035, 'triangle']],
    discard: [[185, 0, .12, .045, 'triangle']],
    point: [[523, 0, .125, .055, 'sine'], [659, .075, .16, .05, 'sine']],
    win: [[523, 0, .15, .055, 'sine'], [659, .08, .15, .05, 'sine'], [784, .16, .22, .045, 'sine']],
    miss: [[277, 0, .11, .04, 'triangle'], [196, .08, .14, .045, 'sine']],
    tie: [[330, 0, .105, .04, 'sine'], [330, .10, .11, .025, 'sine']],
    trap: [[220, 0, .12, .055, 'triangle'], [147, .08, .19, .05, 'triangle']],
  };

  function readPreference() {
    try { return localStorage.getItem(storageKey) !== 'off'; }
    catch { return true; }
  }

  function updateButton() {
    button.setAttribute('aria-pressed', enabled);
    button.querySelector('span').textContent = enabled ? 'Ses açık' : 'Ses kapalı';
  }

  function play(effect) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!enabled || !Audio || !effects[effect]) return;
    try {
      context ||= new Audio();
      if (context.state === 'suspended') context.resume().catch(() => {});
      const now = context.currentTime;
      for (const [pitch, offset, duration, volume, wave] of effects[effect]) {
        const tone = context.createOscillator();
        const gain = context.createGain();
        const start = now + offset;
        tone.type = wave;
        tone.frequency.setValueAtTime(pitch, start);
        gain.gain.setValueAtTime(.001, start);
        gain.gain.exponentialRampToValueAtTime(volume, start + .012);
        gain.gain.exponentialRampToValueAtTime(.001, start + duration);
        tone.connect(gain);
        gain.connect(context.destination);
        tone.start(start);
        tone.stop(start + duration);
      }
    } catch { /* Gameplay remains available if audio is blocked. */ }
  }

  button.addEventListener('click', () => {
    enabled = !enabled;
    try { localStorage.setItem(storageKey, enabled ? 'on' : 'off'); } catch {}
    updateButton();
    if (enabled) play('card');
    else if (context?.state === 'running') context.suspend().catch(() => {});
  });
  updateButton();
  return { play };
})();
