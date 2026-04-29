// Lightweight WebAudio SFX synth. Zero assets: every sound is generated on demand.
// Exposes the global `sfx` object with sfx.play(kind, opts), sfx.setMuted, sfx.isMuted.
(function () {
  const STORAGE_KEY = "emoji-survivors-audio-v1";
  const DEFAULT_SFX_VOLUME = 0.5;
  const DEFAULT_MUSIC_VOLUME = 0.5;
  const SFX_OUTPUT_GAIN = 1.2;
  const SFX_BUDGET_WINDOW = 0.05;
  const MAX_SFX_EVENTS_PER_WINDOW = 12;
  const MIN_EVENT_INTERVAL = {
    hit: 0.03,
    crit: 0.06,
    kill: 0.05,
    bossHit: 0.04,
    pickupXp: 0.05,
    damage: 0.05,
    heartbeat: 0.9,
    uiClick: 0.02,
  };
  const UI_CLICK_PITCHES = [500, 560, 625];
  const DASH_PITCHES = [180, 200, 165];
  const MUSIC_TRACKS = [
    "audio/Tense Lutefire.mp3",
    "audio/Cinder Pursuit.mp3",
    "audio/Gossamer Pursuit.mp3",
  ];
  const MUSIC_BASE_GAIN = 0.5;
  const MUSIC_TRACK_SWITCH_FADE_MS = 260;
  const MUSIC_TRACK_QUEUE_LEAD = 0.42;
  let lastUiPitchIndex = -1;
  let lastDashPitchIndex = -1;

  let muted = false;
  let sfxMuted = false;
  let musicMuted = false;
  let sfxVolume = DEFAULT_SFX_VOLUME;
  let musicVolume = DEFAULT_MUSIC_VOLUME;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.muted === "boolean") muted = parsed.muted;
      if (typeof parsed.sfxMuted === "boolean") sfxMuted = parsed.sfxMuted;
      if (typeof parsed.musicMuted === "boolean") musicMuted = parsed.musicMuted;
      if (typeof parsed.sfxVolume === "number") {
        sfxVolume = Math.max(0, Math.min(1, parsed.sfxVolume));
      } else if (typeof parsed.volume === "number") {
        // Backward compatibility with older single-volume save.
        sfxVolume = Math.max(0, Math.min(1, parsed.volume));
      }
      if (typeof parsed.musicVolume === "number") {
        musicVolume = Math.max(0, Math.min(1, parsed.musicVolume));
      }
    }
  } catch {
    // ignore
  }
  if (!musicMuted && musicVolume <= 0.0001) {
    musicVolume = DEFAULT_MUSIC_VOLUME;
  }
  if (!sfxMuted && sfxVolume <= 0.0001) {
    sfxVolume = DEFAULT_SFX_VOLUME;
  }

  let audioCtx = null;
  let masterGain = null;
  let sfxGain = null;
  let compressor = null;
  let musicElement = null;
  let musicSource = null;
  let musicFilter = null;
  let musicGain = null;
  let currentMusicTrackIndex = -1;
  let lastMusicTrackIndex = -1;
  let runMusicActive = false;
  let runMusicPaused = false;
  let runMusicMode = "normal";
  let runMusicDeathProgress = 0;
  let musicStopToken = 0;
  let musicTransitionToken = 0;
  let musicQueuedTransition = false;
  let musicUnlockPending = false;
  let musicGraphReady = false;
  const lastPlayed = Object.create(null);
  let sfxWindowStart = 0;
  let sfxWindowCount = 0;
  const BUDGET_PROTECTED_KINDS = new Set([
    "uiClick",
    "dash",
    "dashFail",
    "damage",
    "bossHit",
    "bossKill",
    "bossSpawn",
    "bossPhase",
    "levelUp",
    "runStart",
    "runOver",
    "archiveUnlock",
  ]);

  function getEffectiveSfxGain() {
    if (muted || sfxMuted || sfxVolume <= 0.0001) {
      return 0.0001;
    }
    return Math.max(0.0001, sfxVolume * SFX_OUTPUT_GAIN);
  }

  function getEffectiveMusicGain() {
    if (muted || musicMuted || musicVolume <= 0.0001) {
      return 0.0001;
    }
    return MUSIC_BASE_GAIN * musicVolume;
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        muted,
        sfxMuted,
        musicMuted,
        sfxVolume,
        musicVolume,
      }));
    } catch {
      // ignore
    }
  }

  function ensureContext() {
    if (audioCtx) {
      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
      return audioCtx;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      audioCtx = new Ctor();
    } catch {
      audioCtx = null;
      return null;
    }
    masterGain = audioCtx.createGain();
    masterGain.gain.value = muted ? 0.0001 : 1;
    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = getEffectiveSfxGain();
    compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 18;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.16;
    sfxGain.connect(masterGain);
    masterGain.connect(compressor);
    compressor.connect(audioCtx.destination);
    return audioCtx;
  }

  function smoothstep01(value) {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function pickNextMusicTrackIndex() {
    if (MUSIC_TRACKS.length <= 1) {
      return 0;
    }
    let nextIndex = Math.floor(Math.random() * MUSIC_TRACKS.length);
    while (nextIndex === lastMusicTrackIndex) {
      nextIndex = Math.floor(Math.random() * MUSIC_TRACKS.length);
    }
    return nextIndex;
  }

  function ensureMusicNodes(ctx) {
    if (!musicElement) {
      musicElement = new Audio();
      musicElement.preload = "auto";
      musicElement.loop = false;
      musicElement.volume = 1;
      musicElement.addEventListener("ended", () => {
        if (musicQueuedTransition) {
          return;
        }
        if (!runMusicActive || muted || musicMuted || musicVolume <= 0.0001 || runMusicPaused || runMusicDeathProgress > 0.001) {
          return;
        }
        startRunMusicTrack(pickNextMusicTrackIndex(), { restart: true });
      });
      musicElement.addEventListener("timeupdate", () => {
        if (
          musicQueuedTransition ||
          !runMusicActive ||
          muted ||
          musicMuted ||
          musicVolume <= 0.0001 ||
          runMusicPaused ||
          runMusicDeathProgress > 0.001
        ) {
          return;
        }
        if (!Number.isFinite(musicElement.duration) || musicElement.duration <= 0) {
          return;
        }
        const timeLeft = musicElement.duration - musicElement.currentTime;
        if (timeLeft > MUSIC_TRACK_QUEUE_LEAD) {
          return;
        }
        musicQueuedTransition = true;
        startRunMusicTrack(pickNextMusicTrackIndex(), { restart: true });
      });
    }
    if (window.location.protocol === "file:") {
      return true;
    }
    if (!ctx || !masterGain || ctx.state !== "running") {
      return true;
    }
    if (musicGraphReady && musicSource && musicGain && musicFilter) {
      return true;
    }
    try {
      musicSource = ctx.createMediaElementSource(musicElement);
      musicFilter = ctx.createBiquadFilter();
      musicFilter.type = "lowpass";
      musicFilter.frequency.value = 18000;
      musicFilter.Q.value = 0.5;
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.0001;
      musicSource.connect(musicFilter);
      musicFilter.connect(musicGain);
      musicGain.connect(masterGain);
      musicGraphReady = true;
    } catch {
      // Fallback to plain HTMLAudio output when graph wiring fails.
      musicGraphReady = false;
      musicSource = null;
      musicFilter = null;
      musicGain = null;
      return true;
    }
    return true;
  }

  function preloadMusicOnPageLoad() {
    if (MUSIC_TRACKS.length === 0) {
      return;
    }
    ensureMusicNodes(null);
    if (musicElement && !musicElement.src) {
      const preloadIndex = pickNextMusicTrackIndex();
      const preloadSrc = encodeURI(MUSIC_TRACKS[preloadIndex]);
      musicElement.src = preloadSrc;
      currentMusicTrackIndex = preloadIndex;
      lastMusicTrackIndex = preloadIndex;
      musicElement.load();
    }
    for (const track of MUSIC_TRACKS) {
      const href = encodeURI(track);
      const existing = document.querySelector(`link[rel="preload"][as="audio"][href="${href}"]`);
      if (existing) {
        continue;
      }
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "audio";
      link.href = href;
      document.head.appendChild(link);
    }
  }

  function applyRunMusicState(progress = 0) {
    if (!musicElement) {
      return;
    }
    const ctx = audioCtx;
    const now = ctx ? ctx.currentTime : 0;
    const eased = smoothstep01(progress);
    const baseMusicGain = getEffectiveMusicGain();
    const muffled = runMusicMode === "muffled";
    const gain = Math.max(0.0001, baseMusicGain * (muffled ? 0.16 : 1) * lerp(1, 0.04, eased));
    const cutoff = muffled ? Math.min(18000, lerp(460, 280, eased)) : lerp(18000, 220, eased);
    const q = muffled ? lerp(2.2, 2.9, eased) : lerp(0.6, 2.4, eased);
    const playbackRate = lerp(1, 0.16, eased);
    if (ctx && musicGraphReady && musicGain && musicFilter) {
      musicGain.gain.cancelScheduledValues(now);
      musicGain.gain.setTargetAtTime(gain, now, 0.18);
      musicFilter.frequency.cancelScheduledValues(now);
      musicFilter.frequency.setTargetAtTime(cutoff, now, 0.2);
      musicFilter.Q.cancelScheduledValues(now);
      musicFilter.Q.setTargetAtTime(q, now, 0.2);
    } else {
      musicElement.volume = Math.max(0, Math.min(1, gain));
    }
    musicElement.playbackRate = playbackRate;
    if ("preservesPitch" in musicElement) {
      musicElement.preservesPitch = false;
    } else if ("webkitPreservesPitch" in musicElement) {
      musicElement.webkitPreservesPitch = false;
    }
  }

  function startRunMusicTrack(trackIndex, options = {}) {
    const { restart = false } = options;
    const ctx = ensureContext();
    if (muted || musicMuted || musicVolume <= 0.0001) {
      return;
    }
    if (!ensureMusicNodes(ctx)) {
      return;
    }
    const nextIndex = Math.max(0, Math.min(MUSIC_TRACKS.length - 1, trackIndex));
    const nextSrc = encodeURI(MUSIC_TRACKS[nextIndex]);
    const expectedHref = new URL(nextSrc, window.location.href).href;
    const shouldSwitchTrack = currentMusicTrackIndex !== nextIndex || musicElement.src !== expectedHref;
    if (shouldSwitchTrack && !musicElement.paused) {
      const transitionToken = ++musicTransitionToken;
      const now = audioCtx?.currentTime ?? 0;
      if (audioCtx && musicGraphReady && musicGain) {
        musicGain.gain.cancelScheduledValues(now);
        musicGain.gain.setTargetAtTime(0.0001, now, 0.08);
      } else {
        musicElement.volume = 0;
      }
      window.setTimeout(() => {
        if (!musicElement || transitionToken !== musicTransitionToken || !runMusicActive) {
          return;
        }
        musicElement.src = nextSrc;
        currentMusicTrackIndex = nextIndex;
        if (restart) {
          try {
            musicElement.currentTime = 0;
          } catch {
            // ignore
          }
        }
        musicQueuedTransition = false;
        applyRunMusicState(runMusicDeathProgress);
        musicElement.play().catch(() => {});
      }, MUSIC_TRACK_SWITCH_FADE_MS);
      return;
    }
    if (shouldSwitchTrack) {
      musicElement.src = nextSrc;
      currentMusicTrackIndex = nextIndex;
    }
    if (restart) {
      try {
        musicElement.currentTime = 0;
      } catch {
        // ignore
      }
    }
    musicQueuedTransition = false;
    musicStopToken += 1;
    runMusicActive = true;
    runMusicPaused = false;
    runMusicDeathProgress = 0;
    lastMusicTrackIndex = nextIndex;
    applyRunMusicState(0);
    musicElement.play().catch(() => {
      if (musicUnlockPending) {
        return;
      }
      musicUnlockPending = true;
      const resumeMusic = () => {
        musicUnlockPending = false;
        window.removeEventListener("pointerdown", resumeMusic, true);
        window.removeEventListener("keydown", resumeMusic, true);
        window.removeEventListener("touchstart", resumeMusic, true);
        if (!runMusicActive || muted || musicMuted || !musicElement) {
          return;
        }
        ensureContext();
        ensureMusicNodes(audioCtx);
        applyRunMusicState(runMusicDeathProgress);
        musicElement.play().catch(() => {});
      };
      window.addEventListener("pointerdown", resumeMusic, true);
      window.addEventListener("keydown", resumeMusic, true);
      window.addEventListener("touchstart", resumeMusic, true);
    });
  }

  function startRunMusic() {
    if (muted || musicMuted || musicVolume <= 0.0001 || MUSIC_TRACKS.length === 0) {
      return;
    }
    startRunMusicTrack(pickNextMusicTrackIndex(), { restart: true });
  }

  function stopRunMusic(options = {}) {
    const { immediate = false, keepPosition = false } = options;
    runMusicActive = false;
    runMusicPaused = false;
    runMusicDeathProgress = 0;
    musicStopToken += 1;
    const stopToken = musicStopToken;
    if (!musicElement) {
      return;
    }
    const now = audioCtx?.currentTime ?? 0;
    if (audioCtx && musicGraphReady && musicGain && musicFilter) {
      musicGain.gain.cancelScheduledValues(now);
      musicFilter.frequency.cancelScheduledValues(now);
      musicFilter.Q.cancelScheduledValues(now);
    }
    if (immediate) {
      if (musicGraphReady && musicGain) {
        musicGain.gain.setValueAtTime(0.0001, now);
      } else {
        musicElement.volume = 0;
      }
      musicElement.pause();
      if (!keepPosition) {
        try {
          musicElement.currentTime = 0;
        } catch {
          // ignore
        }
      }
      return;
    }
    if (musicGraphReady && musicGain) {
      musicGain.gain.setTargetAtTime(0.0001, now, 0.24);
    } else {
      musicElement.volume = 0;
    }
    window.setTimeout(() => {
      if (stopToken !== musicStopToken || !musicElement) {
        return;
      }
      musicElement.pause();
      if (!keepPosition) {
        try {
          musicElement.currentTime = 0;
        } catch {
          // ignore
        }
      }
    }, 800);
  }

  function setRunMusicDeathProgress(progress) {
    runMusicDeathProgress = Math.max(0, Math.min(1, Number(progress) || 0));
    if (!runMusicActive || muted) {
      return;
    }
    applyRunMusicState(runMusicDeathProgress);
  }

  function pauseRunMusic() {
    if (!musicElement || !runMusicActive) {
      return;
    }
    runMusicMode = "muffled";
    if (runMusicPaused) {
      runMusicPaused = false;
    }
    if (muted || musicMuted || musicVolume <= 0.0001) {
      return;
    }
    ensureContext();
    ensureMusicNodes(audioCtx);
    applyRunMusicState(runMusicDeathProgress);
    musicElement.play().catch(() => {});
  }

  function resumeRunMusic() {
    if (!musicElement || !runMusicActive) {
      return;
    }
    runMusicMode = "normal";
    if (runMusicPaused) {
      runMusicPaused = false;
    }
    if (muted || musicMuted || musicVolume <= 0.0001) {
      return;
    }
    ensureContext();
    ensureMusicNodes(audioCtx);
    applyRunMusicState(runMusicDeathProgress);
    musicElement.play().catch(() => {});
  }

  function rateLimited(kind) {
    const gate = MIN_EVENT_INTERVAL[kind];
    if (!gate || !audioCtx) return false;
    const now = audioCtx.currentTime;
    const last = lastPlayed[kind] ?? -Infinity;
    if (now - last < gate) return true;
    lastPlayed[kind] = now;
    return false;
  }

  function exceedsSfxBudget(kind) {
    if (!audioCtx) {
      return false;
    }
    const now = audioCtx.currentTime;
    if (now - sfxWindowStart >= SFX_BUDGET_WINDOW) {
      sfxWindowStart = now;
      sfxWindowCount = 0;
    }
    if (sfxWindowCount < MAX_SFX_EVENTS_PER_WINDOW) {
      sfxWindowCount += 1;
      return false;
    }
    if (BUDGET_PROTECTED_KINDS.has(kind)) {
      sfxWindowCount += 1;
      return false;
    }
    return true;
  }

  function makeBuffer(ctx, seconds, generator) {
    const length = Math.max(1, Math.floor(seconds * ctx.sampleRate));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = generator(i / ctx.sampleRate, i, length);
    }
    return buffer;
  }

  const noiseBufferCache = new WeakMap();
  function getNoiseBuffer(ctx) {
    let buffer = noiseBufferCache.get(ctx);
    if (buffer) return buffer;
    buffer = makeBuffer(ctx, 0.6, () => Math.random() * 2 - 1);
    noiseBufferCache.set(ctx, buffer);
    return buffer;
  }

  function envelope(ctx, gainNode, peak, attack, decay, startTime) {
    const t0 = startTime ?? ctx.currentTime;
    gainNode.gain.cancelScheduledValues(t0);
    gainNode.gain.setValueAtTime(0.0001, t0);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    return t0 + attack + decay;
  }

  function playTone(opts) {
    const ctx = ensureContext();
    if (!ctx) return;
    const {
      type = "sine",
      freq = 440,
      freqEnd = null,
      peak = 0.2,
      attack = 0.005,
      decay = 0.12,
      detune = 0,
      delay = 0,
    } = opts;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    const startTime = ctx.currentTime + delay;
    osc.frequency.setValueAtTime(freq, startTime);
    if (freqEnd !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), startTime + attack + decay);
    }
    osc.detune.value = detune;
    osc.connect(gain);
    gain.connect(sfxGain);
    const endTime = envelope(ctx, gain, peak, attack, decay, startTime);
    osc.start(startTime);
    osc.stop(endTime + 0.02);
  }

  function playNoise(opts) {
    const ctx = ensureContext();
    if (!ctx) return;
    const { peak = 0.2, attack = 0.004, decay = 0.18, filterFreq = 1400, filterQ = 1, highpass = false, delay = 0 } = opts;
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer(ctx);
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = highpass ? "highpass" : "lowpass";
    filter.frequency.value = filterFreq;
    filter.Q.value = filterQ;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);
    const startTime = ctx.currentTime + delay;
    const endTime = envelope(ctx, gain, peak, attack, decay, startTime);
    src.start(startTime);
    src.stop(endTime + 0.02);
  }

  const patches = {
    hit({ intensity = 1 } = {}) {
      playTone({ type: "square", freq: 720, freqEnd: 320, peak: 0.08 * intensity, attack: 0.002, decay: 0.07 });
      playNoise({ peak: 0.04 * intensity, attack: 0.001, decay: 0.05, filterFreq: 2600, filterQ: 0.6 });
    },
    crit({ intensity = 1 } = {}) {
      playTone({ type: "square", freq: 880, freqEnd: 360, peak: 0.12 * intensity, attack: 0.002, decay: 0.11 });
      playTone({ type: "sawtooth", freq: 1480, freqEnd: 620, peak: 0.07 * intensity, attack: 0.003, decay: 0.14, delay: 0.01 });
      playNoise({ peak: 0.06 * intensity, attack: 0.001, decay: 0.08, filterFreq: 3600, highpass: true });
    },
    kill() {
      playTone({ type: "triangle", freq: 560, freqEnd: 180, peak: 0.1, attack: 0.004, decay: 0.16 });
      playNoise({ peak: 0.05, attack: 0.002, decay: 0.14, filterFreq: 1600 });
    },
    bossHit() {
      playTone({ type: "sawtooth", freq: 160, freqEnd: 82, peak: 0.22, attack: 0.003, decay: 0.22 });
      playNoise({ peak: 0.09, attack: 0.002, decay: 0.18, filterFreq: 880 });
    },
    bossKill() {
      playTone({ type: "sawtooth", freq: 220, freqEnd: 55, peak: 0.3, attack: 0.005, decay: 0.7 });
      playTone({ type: "square", freq: 80, freqEnd: 34, peak: 0.24, attack: 0.01, decay: 0.9, delay: 0.02 });
      playNoise({ peak: 0.18, attack: 0.002, decay: 0.5, filterFreq: 1400 });
      playNoise({ peak: 0.1, attack: 0.02, decay: 0.9, filterFreq: 420, delay: 0.05 });
    },
    bossSpawn() {
      playTone({ type: "sawtooth", freq: 110, freqEnd: 74, peak: 0.22, attack: 0.04, decay: 0.9 });
      playTone({ type: "sine", freq: 55, peak: 0.2, attack: 0.08, decay: 1.2, delay: 0.02 });
      playNoise({ peak: 0.08, attack: 0.05, decay: 1.0, filterFreq: 520 });
    },
    bossPhase() {
      playTone({ type: "square", freq: 260, freqEnd: 86, peak: 0.18, attack: 0.025, decay: 0.44 });
      playNoise({ peak: 0.12, attack: 0.01, decay: 0.42, filterFreq: 920 });
    },
    pickupXp({ chain = 0 } = {}) {
      const base = 720 + Math.min(12, chain) * 40;
      playTone({ type: "triangle", freq: base, freqEnd: base * 1.9, peak: 0.12, attack: 0.002, decay: 0.14 });
    },
    pickupCache() {
      playTone({ type: "triangle", freq: 640, freqEnd: 1280, peak: 0.16, attack: 0.003, decay: 0.18 });
      playTone({ type: "sine", freq: 960, freqEnd: 1800, peak: 0.08, attack: 0.004, decay: 0.22, delay: 0.03 });
    },
    pickupHeal() {
      playTone({ type: "triangle", freq: 520, peak: 0.14, attack: 0.01, decay: 0.2 });
      playTone({ type: "triangle", freq: 780, peak: 0.1, attack: 0.01, decay: 0.22, delay: 0.05 });
      playTone({ type: "triangle", freq: 1040, peak: 0.08, attack: 0.01, decay: 0.24, delay: 0.1 });
    },
    levelUp() {
      playTone({ type: "triangle", freq: 520, peak: 0.16, attack: 0.005, decay: 0.18 });
      playTone({ type: "triangle", freq: 660, peak: 0.14, attack: 0.005, decay: 0.2, delay: 0.07 });
      playTone({ type: "triangle", freq: 880, peak: 0.14, attack: 0.006, decay: 0.32, delay: 0.14 });
      playTone({ type: "sine", freq: 1320, peak: 0.08, attack: 0.008, decay: 0.42, delay: 0.18 });
    },
    dash() {
      const ctx = audioCtx;
      if (!ctx || !masterGain) return;
      const pitchPool = DASH_PITCHES.map((_, i) => i).filter((i) => i !== lastDashPitchIndex);
      const pitchIndex = pitchPool[Math.floor(Math.random() * pitchPool.length)] ?? 0;
      lastDashPitchIndex = pitchIndex;
      const baseFreq = DASH_PITCHES[pitchIndex];
      const now = ctx.currentTime;

      const noise = ctx.createBufferSource();
      noise.buffer = getNoiseBuffer(ctx);
      const bandPass = ctx.createBiquadFilter();
      bandPass.type = "bandpass";
      bandPass.frequency.setValueAtTime(baseFreq * 4, now);
      bandPass.frequency.exponentialRampToValueAtTime(Math.max(40, baseFreq * 1.2), now + 0.18);
      bandPass.Q.value = 1.4;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.linearRampToValueAtTime(0.32, now + 0.012);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      noise.connect(bandPass);
      bandPass.connect(noiseGain);
      noiseGain.connect(sfxGain);
      noise.start(now);
      noise.stop(now + 0.23);

      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(baseFreq * 1.6, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, baseFreq * 0.5), now + 0.17);
      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.0001, now);
      oscGain.gain.linearRampToValueAtTime(0.13, now + 0.01);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.connect(oscGain);
      oscGain.connect(sfxGain);
      osc.start(now);
      osc.stop(now + 0.19);
    },
    uiClick() {
      const pitchPool = UI_CLICK_PITCHES.map((_, i) => i).filter((i) => i !== lastUiPitchIndex);
      const pitchIndex = pitchPool[Math.floor(Math.random() * pitchPool.length)] ?? 0;
      lastUiPitchIndex = pitchIndex;
      const freq = UI_CLICK_PITCHES[pitchIndex];
      playTone({ type: "sine", freq, freqEnd: freq * 0.62, peak: 0.1, attack: 0.003, decay: 0.1 });
    },
    dashFail() {
      playTone({ type: "square", freq: 180, freqEnd: 120, peak: 0.08, attack: 0.003, decay: 0.1 });
    },
    damage() {
      playTone({ type: "sawtooth", freq: 240, freqEnd: 90, peak: 0.2, attack: 0.002, decay: 0.26 });
      playNoise({ peak: 0.12, attack: 0.002, decay: 0.2, filterFreq: 780 });
    },
    heartbeat({ intensity = 1 } = {}) {
      playTone({ type: "sine", freq: 110, freqEnd: 54, peak: 0.18 * intensity, attack: 0.01, decay: 0.22 });
      playTone({ type: "sine", freq: 78, freqEnd: 40, peak: 0.14 * intensity, attack: 0.012, decay: 0.26, delay: 0.12 });
    },
    combo({ tier = 1 } = {}) {
      const freq = 520 + Math.min(12, tier) * 40;
      playTone({ type: "triangle", freq, peak: 0.08, attack: 0.003, decay: 0.1 });
    },
    upgradeSelect() {
      playTone({ type: "triangle", freq: 480, peak: 0.11, attack: 0.004, decay: 0.12 });
      playTone({ type: "triangle", freq: 640, peak: 0.08, attack: 0.004, decay: 0.16, delay: 0.055 });
    },
    runStart() {
      playTone({ type: "triangle", freq: 440, peak: 0.13, attack: 0.006, decay: 0.16 });
      playTone({ type: "triangle", freq: 660, peak: 0.11, attack: 0.006, decay: 0.18, delay: 0.06 });
      playTone({ type: "triangle", freq: 880, peak: 0.1, attack: 0.006, decay: 0.22, delay: 0.12 });
    },
    archiveUnlock() {
      playTone({ type: "triangle", freq: 620, peak: 0.14, attack: 0.006, decay: 0.18 });
      playTone({ type: "triangle", freq: 780, peak: 0.12, attack: 0.006, decay: 0.2, delay: 0.07 });
      playTone({ type: "triangle", freq: 980, peak: 0.1, attack: 0.006, decay: 0.24, delay: 0.14 });
    },
    runOver() {
      playTone({ type: "sawtooth", freq: 220, freqEnd: 60, peak: 0.26, attack: 0.02, decay: 1.2 });
      playTone({ type: "sine", freq: 110, freqEnd: 42, peak: 0.16, attack: 0.06, decay: 1.6, delay: 0.08 });
    },
  };

  function play(kind, opts) {
    if (muted || sfxMuted || sfxVolume <= 0.0001) return;
    ensureContext();
    if (!audioCtx) return;
    if (exceedsSfxBudget(kind)) return;
    if (rateLimited(kind)) return;
    const patch = patches[kind];
    if (!patch) return;
    try {
      patch(opts ?? {});
    } catch {
      // ignore synth errors
    }
  }

  function setMuted(next) {
    muted = Boolean(next);
    if (muted && audioCtx) {
      try {
        masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
        masterGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      } catch {
        // ignore
      }
    } else if (masterGain && audioCtx) {
      masterGain.gain.setValueAtTime(1, audioCtx.currentTime);
      if (sfxGain) {
        sfxGain.gain.cancelScheduledValues(audioCtx.currentTime);
        sfxGain.gain.setTargetAtTime(getEffectiveSfxGain(), audioCtx.currentTime, 0.06);
      }
    }
    if (runMusicActive) {
      applyRunMusicState(runMusicDeathProgress);
    }
    persist();
  }

  function setVolume(value) {
    setSfxVolume(value);
  }

  function setSfxVolume(value) {
    sfxVolume = Math.max(0, Math.min(1, Number(value) || 0));
    if (sfxGain && audioCtx) {
      sfxGain.gain.cancelScheduledValues(audioCtx.currentTime);
      sfxGain.gain.setTargetAtTime(getEffectiveSfxGain(), audioCtx.currentTime, 0.06);
    }
    persist();
  }

  function setMusicVolume(value) {
    musicVolume = Math.max(0, Math.min(1, Number(value) || 0));
    if (runMusicActive) {
      applyRunMusicState(runMusicDeathProgress);
    }
    persist();
  }

  function setSfxMuted(next) {
    sfxMuted = Boolean(next);
    if (sfxGain && audioCtx) {
      sfxGain.gain.cancelScheduledValues(audioCtx.currentTime);
      sfxGain.gain.setTargetAtTime(getEffectiveSfxGain(), audioCtx.currentTime, 0.06);
    }
    persist();
  }

  function setMusicMuted(next) {
    musicMuted = Boolean(next);
    if (runMusicActive) {
      applyRunMusicState(runMusicDeathProgress);
    }
    persist();
  }

  function toggleMuted() {
    setMuted(!muted);
    return muted;
  }

  function unlockOnFirstInput() {
    const handler = () => {
      ensureContext();
      window.removeEventListener("pointerdown", handler, true);
      window.removeEventListener("keydown", handler, true);
      window.removeEventListener("touchstart", handler, true);
    };
    window.addEventListener("pointerdown", handler, true);
    window.addEventListener("keydown", handler, true);
    window.addEventListener("touchstart", handler, true);
  }

  unlockOnFirstInput();
  preloadMusicOnPageLoad();

  window.sfx = {
    play,
    setMuted,
    toggleMuted,
    setVolume,
    setSfxVolume,
    setMusicVolume,
    setSfxMuted,
    setMusicMuted,
    isMuted() {
      return muted;
    },
    isSfxMuted() {
      return sfxMuted;
    },
    isMusicMuted() {
      return musicMuted;
    },
    getVolume() {
      return sfxVolume;
    },
    getSfxVolume() {
      return sfxVolume;
    },
    getMusicVolume() {
      return musicVolume;
    },
    isRunMusicActive() {
      return runMusicActive;
    },
    startRunMusic,
    stopRunMusic,
    pauseRunMusic,
    resumeRunMusic,
    setRunMusicDeathProgress,
  };
})();
