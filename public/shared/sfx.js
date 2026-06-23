const sfx = (() => {
  let ctx = null;
  let muted = false;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function play(freq, dur, type, vol) {
    if (muted) return;
    try {
      const c = getCtx();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type || "square";
      osc.frequency.value = freq;
      gain.gain.value = vol || 0.08;
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + dur);
    } catch(e) {}
  }

  return {
    move()     { play(300, 0.05, "square", 0.04); },
    place()    { play(500, 0.08, "sine", 0.06); },
    capture()  { play(200, 0.15, "sawtooth", 0.06); play(400, 0.1, "sine", 0.04); },
    hit()      { play(800, 0.08, "square", 0.07); },
    miss()     { play(200, 0.12, "triangle", 0.04); },
    sunk()     { [0,100,200].forEach((d,i) => setTimeout(() => play(600 - i*150, 0.2, "square", 0.06), d)); },
    drop()     { play(180, 0.1, "triangle", 0.05); },
    clear()    { play(523, 0.1, "sine", 0.07); setTimeout(() => play(659, 0.1, "sine", 0.07), 80); },
    tetris()   { [523,659,784,1047].forEach((f,i) => setTimeout(() => play(f, 0.12, "sine", 0.07), i*70)); },
    bounce()   { play(440, 0.04, "square", 0.05); },
    score()    { play(880, 0.15, "sine", 0.06); },
    win()      { [523,659,784,1047,784,1047].forEach((f,i) => setTimeout(() => play(f, 0.15, "sine", 0.07), i*100)); },
    lose()     { [400,300,200].forEach((f,i) => setTimeout(() => play(f, 0.2, "triangle", 0.05), i*150)); },
    toggle()   { muted = !muted; return !muted; },
    isMuted()  { return muted; }
  };
})();
