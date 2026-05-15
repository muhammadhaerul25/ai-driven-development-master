'use strict';

const DECKS = [
  { id: 'base', label: 'Base', src: 'base/index.html' },
  { id: 'chapter1', label: 'Chapter 1', src: 'chapter1/index.html' },
  { id: 'chapter2', label: 'Chapter 2', src: 'chapter2/index.html' },
  { id: 'chapter3', label: 'Chapter 3', src: 'chapter3/index.html' },
  { id: 'chapter4', label: 'Chapter 4', src: 'chapter4/index.html' },
  { id: 'handson', label: 'Hands-on', src: 'handson/index.html' },
];

const deckFrames = [
  document.getElementById('deckFrame'),
  document.getElementById('deckFrameNext'),
];
let activeFrame = deckFrames[0];
const presentationStage = document.getElementById('presentationStage');

const WRAPPER_STORAGE_KEY = 'combined-deck-index';

let deckIndex = 0;
let pendingJump = null; // 'end' | 'start' | null
let pendingSwap = null;

function getInactiveFrame() {
  return activeFrame === deckFrames[0] ? deckFrames[1] : deckFrames[0];
}

function syncFrameClasses() {
  deckFrames.forEach((frameEl) => {
    if (!frameEl) return;
    const isActive = frameEl === activeFrame;
    frameEl.classList.toggle('is-active', isActive);
    frameEl.classList.toggle('is-inactive', !isActive);
    if (!pendingSwap || pendingSwap.frameEl !== frameEl) {
      frameEl.classList.remove('is-transitioning-in');
    }
  });
}

function setDeckUiHidden(hidden) {
  for (const frameEl of deckFrames) {
    const body = safeDoc(frameEl)?.body;
    if (!body) continue;
    body.classList.toggle('__combinedHideUi', Boolean(hidden));
  }
}

function updateStatus() {
  const deck = DECKS[deckIndex];
  if (!deck) return;
  document.title = `AI-Driven Development — ${deck.label} (${deckIndex + 1}/${DECKS.length})`;
}

function isAnyFullscreenActive() {
  // Fullscreen may be triggered by the wrapper (fullscreenElement = iframe)
  // OR by the embedded deck itself (fullscreenElement inside the iframe doc).
  const apiFullscreen = Boolean(document.fullscreenElement) || deckFrames.some(frameEl => Boolean(safeDoc(frameEl)?.fullscreenElement));
  if (apiFullscreen) return true;

  // Browser fullscreen (F11) does not use the Fullscreen API.
  // Use a conservative heuristic: only consider it fullscreen when the viewport
  // is basically the screen size.
  const w = window.innerWidth;
  const h = window.innerHeight;
  const sw = window.screen?.width || 0;
  const sh = window.screen?.height || 0;
  if (!sw || !sh) return false;

  return w >= sw * 0.98 && h >= sh * 0.98;
}

function setFullscreenState() {
  const full = isAnyFullscreenActive();
  document.body.classList.toggle('is-fullscreen', full);
  setDeckUiHidden(full);
}

function toggleFullscreen() {
  if (!isAnyFullscreenActive()) {
    const target = presentationStage || document.documentElement;
    target.requestFullscreen?.().catch(() => { });
  } else {
    document.exitFullscreen?.().catch(() => { });
  }
}

function safeDoc(frameEl = activeFrame) {
  try {
    return frameEl?.contentDocument || null;
  } catch {
    return null;
  }
}

function safeWin(frameEl = activeFrame) {
  try {
    return frameEl?.contentWindow || null;
  } catch {
    return null;
  }
}

function getDeckNavState(frameEl = activeFrame) {
  const doc = safeDoc(frameEl);
  if (!doc) return { atStart: false, atEnd: false };

  const prev = doc.getElementById('prevBtn');
  const next = doc.getElementById('nextBtn');

  return {
    atStart: Boolean(prev && prev.disabled),
    atEnd: Boolean(next && next.disabled),
  };
}

function updateHud() {
  // Overlay HUD removed; keep title updated for quick orientation.
  updateStatus();
}

function tryPlayActiveSlideVideos(frameEl = activeFrame) {
  const doc = safeDoc(frameEl);
  if (!doc) return;

  const videos = doc.querySelectorAll('.slide.active video');
  videos.forEach((video) => {
    try {
      if (video.muted !== true) video.muted = true;
      if (video.loop !== true) video.loop = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      const maybePromise = video.play();
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => {
          window.setTimeout(() => {
            try {
              video.play().catch(() => { });
            } catch { }
          }, 120);
        });
      }
    } catch { }
  });
}

function waitForDeckReady(frameEl, timeoutMs = 1200) {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const tick = () => {
      const doc = safeDoc(frameEl);
      const ready = Boolean(
        doc &&
        doc.querySelector('.slide.active') &&
        doc.getElementById('currentSlide')
      );

      if (ready || Date.now() - startedAt >= timeoutMs) {
        resolve();
        return;
      }

      window.requestAnimationFrame(tick);
    };

    tick();
  });
}

function installBridgeInFrame(frameEl = activeFrame) {
  const win = safeWin(frameEl);
  const doc = safeDoc(frameEl);
  if (!win || !doc) return;
  if (win.__combinedBridgeInstalled) return;

  win.__combinedBridgeInstalled = true;

  const onKeyDownCapture = (e) => {
    const nextKeys = ['ArrowRight', 'ArrowDown', 'PageDown', ' '];
    const prevKeys = ['ArrowLeft', 'ArrowUp', 'PageUp'];

    const parentNext = window.parent?.combinedNext;
    const parentPrev = window.parent?.combinedPrev;

    if (nextKeys.includes(e.key)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (typeof parentNext === 'function') parentNext();
      return;
    }

    if (prevKeys.includes(e.key)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (typeof parentPrev === 'function') parentPrev();
      return;
    }
  };

  const onWheelCapture = (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const parentNext = window.parent?.combinedNext;
    const parentPrev = window.parent?.combinedPrev;

    if (e.deltaY > 0) {
      if (typeof parentNext === 'function') parentNext();
    } else {
      if (typeof parentPrev === 'function') parentPrev();
    }
  };

  doc.addEventListener('keydown', onKeyDownCapture, true);
  doc.addEventListener('wheel', onWheelCapture, { capture: true, passive: false });

  const originalGoTo = typeof win.goTo === 'function' ? win.goTo : null;
  if (originalGoTo && !win.__combinedGoToWrapped) {
    win.__combinedGoToWrapped = true;
    win.goTo = function combinedGoTo(index, direction) {
      const result = originalGoTo.call(win, index, direction);
      window.setTimeout(() => tryPlayActiveSlideVideos(frameEl), 0);
      window.setTimeout(() => tryPlayActiveSlideVideos(frameEl), 120);
      window.setTimeout(() => tryPlayActiveSlideVideos(frameEl), 400);
      return result;
    };
  }

  // Make the embedded deck's fullscreen button reliable.
  // The deck HTML calls a global toggleFullscreen() via onclick.
  // In iframes, requestFullscreen from inside the frame can be flaky depending
  // on browser/permissions, so we route it to the wrapper which fullscreen's the iframe.
  if (!win.__combinedFullscreenShimInstalled) {
    win.__combinedFullscreenShimInstalled = true;

    const originalToggle = typeof win.toggleFullscreen === 'function' ? win.toggleFullscreen : null;
    win.toggleFullscreen = function combinedDeckToggleFullscreen() {
      try {
        // Use the wrapper's implementation (fullscreen the iframe).
        toggleFullscreen();
        return;
      } catch { }

      // Fallback: call the deck's original implementation.
      try {
        if (originalToggle) return originalToggle.call(win);
      } catch { }
    };
  }

  // Even with allowfullscreen, some browsers treat fullscreen requests routed to the
  // wrapper as not being a direct user gesture. To avoid that, we also attach a click
  // handler that runs in the iframe's own realm.
  if (!win.__combinedFullscreenBtnHandlerInstalled) {
    win.__combinedFullscreenBtnHandlerInstalled = true;

    const fsBtn = doc.getElementById('fullscreenBtn');
    if (fsBtn) {
      const handler = win.Function('e', `
        const safeCall = (fn) => {
          try {
            const out = fn();
            if (out && typeof out.catch === 'function') out.catch(() => {});
            return out;
          } catch (_) {
            return null;
          }
        };

        try { e.preventDefault(); } catch (_) {}
        try { e.stopPropagation(); } catch (_) {}
        try { e.stopImmediatePropagation(); } catch (_) {}

        // EXIT: if either parent or iframe is in fullscreen.
        try {
          if (window.parent && window.parent.document && window.parent.document.fullscreenElement) {
            safeCall(() => window.parent.document.exitFullscreen());
            return;
          }
        } catch (_) {}

        try {
          if (document.fullscreenElement) {
            safeCall(() => document.exitFullscreen());
            return;
          }
        } catch (_) {}

        // ENTER: prefer fullscreening the parent iframe element (reliable across browsers).
        try {
          const parentStage = window.parent && window.parent.document && window.parent.document.getElementById('presentationStage');
          if (parentStage && parentStage.requestFullscreen) {
            safeCall(() => parentStage.requestFullscreen());
            return;
          }
        } catch (_) {}

        // Fallback: fullscreen inside the iframe.
        safeCall(() => document.documentElement.requestFullscreen());
      `);

      // Capture to beat any existing listeners.
      fsBtn.addEventListener('click', handler, true);
    }
  }

  // Sync wrapper UI with fullscreen events that happen inside the iframe.
  doc.addEventListener('fullscreenchange', () => {
    setFullscreenState();
  });

  doc.addEventListener('canplay', () => tryPlayActiveSlideVideos(frameEl), true);
  doc.addEventListener('loadedmetadata', () => tryPlayActiveSlideVideos(frameEl), true);
  doc.addEventListener('playing', () => tryPlayActiveSlideVideos(frameEl), true);

  // Inject small CSS to hide the embedded deck HUD during fullscreen.
  // This avoids editing the chapter files.
  if (!doc.getElementById('__combinedFullscreenStyle')) {
    const style = doc.createElement('style');
    style.id = '__combinedFullscreenStyle';
    style.textContent = `
      .map-toggle,
      .slide-map,
      :fullscreen .nav-controls,
      :fullscreen .fullscreen-btn,
      :fullscreen .slide-counter,
      :fullscreen .progress-bar {
        display: none !important;
      }

      body.__combinedHideUi .map-toggle,
      body.__combinedHideUi .slide-map,
      body.__combinedHideUi .nav-controls,
      body.__combinedHideUi .fullscreen-btn,
      body.__combinedHideUi .slide-counter,
      body.__combinedHideUi .progress-bar {
        display: none !important;
      }
    `;
    doc.head.appendChild(style);
  }

  // Apply immediately in case we loaded this deck while already fullscreen.
  setFullscreenState();
  window.setTimeout(() => tryPlayActiveSlideVideos(frameEl), 0);
}

function loadDeck(nextDeckIndex, { jumpToEnd = false, jumpToStart = false, animate = false } = {}) {
  if (nextDeckIndex < 0 || nextDeckIndex >= DECKS.length) return;

  deckIndex = nextDeckIndex;
  pendingJump = jumpToEnd ? 'end' : (jumpToStart ? 'start' : null);
  sessionStorage.setItem(WRAPPER_STORAGE_KEY, String(deckIndex));

  const deck = DECKS[deckIndex];

  if (!animate) {
    activeFrame = deckFrames[0];
    const inactiveFrame = deckFrames[1];
    syncFrameClasses();
    activeFrame.src = deck.src;
    inactiveFrame.removeAttribute('src');
    updateHud();
    return;
  }

  if (pendingSwap) return;

  const incomingFrame = getInactiveFrame();
  if (!incomingFrame) return;

  pendingSwap = {
    frameEl: incomingFrame,
    token: Symbol('swap'),
    jumpToEnd,
    jumpToStart,
  };

  incomingFrame.classList.remove('is-active');
  incomingFrame.classList.add('is-inactive');
  incomingFrame.classList.remove('is-transitioning-in');
  syncFrameClasses();

  incomingFrame.addEventListener('load', () => {
    const swap = pendingSwap;
    if (!swap || swap.frameEl !== incomingFrame) return;

    installBridgeInFrame(incomingFrame);

    waitForDeckReady(incomingFrame).then(() => {
      if (!pendingSwap || pendingSwap.frameEl !== incomingFrame) return;

      activeFrame = incomingFrame;
      pendingSwap = null;
      syncFrameClasses();

      if (swap.jumpToEnd) {
        jumpToEndOfCurrentDeck(activeFrame);
      } else if (swap.jumpToStart) {
        jumpToStartOfCurrentDeck(activeFrame);
      }

      setFullscreenState();
      updateHud();
      tryPlayActiveSlideVideos(activeFrame);
    });
  }, { once: true });

  incomingFrame.src = deck.src;
  updateHud();
}

function jumpToStartOfCurrentDeck(frameEl = activeFrame) {
  const win = safeWin(frameEl);
  if (!win) return;
  if (typeof win.goTo === 'function') {
    win.goTo(0, 'none');
  }
}

function jumpToEndOfCurrentDeck(frameEl = activeFrame) {
  const win = safeWin(frameEl);
  const doc = safeDoc(frameEl);
  if (!win || !doc) return;

  const slides = doc.querySelectorAll('.slide');
  const lastIndex = Math.max(0, slides.length - 1);

  if (typeof win.goTo === 'function') {
    win.goTo(lastIndex, 'none');
  }
}

window.combinedNext = function combinedNext() {
  if (pendingSwap) return;

  const win = safeWin();
  if (!win) return;

  const { atEnd } = getDeckNavState();
  if (atEnd) {
    // When moving across decks, always start the next deck from slide 1 (not a saved position).
    loadDeck(deckIndex + 1, { jumpToStart: true, animate: true });
    return;
  }

  if (typeof win.nextSlide === 'function') {
    win.nextSlide();
  }

  setTimeout(updateHud, 0);
};

window.combinedPrev = function combinedPrev() {
  if (pendingSwap) return;

  const win = safeWin();
  if (!win) return;

  const { atStart } = getDeckNavState();
  if (atStart) {
    loadDeck(deckIndex - 1, { jumpToEnd: true, animate: true });
    return;
  }

  if (typeof win.prevSlide === 'function') {
    win.prevSlide();
  }

  setTimeout(updateHud, 0);
};

function initControls() {
  document.addEventListener('keydown', (e) => {
    const nextKeys = ['ArrowRight', 'ArrowDown', 'PageDown', ' '];
    const prevKeys = ['ArrowLeft', 'ArrowUp', 'PageUp'];

    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      toggleFullscreen();
      return;
    }

    if (nextKeys.includes(e.key)) {
      e.preventDefault();
      window.combinedNext();
    } else if (prevKeys.includes(e.key)) {
      e.preventDefault();
      window.combinedPrev();
    }
  });

  document.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();

    if (e.deltaY > 0) window.combinedNext();
    else window.combinedPrev();
  }, { passive: false });
}

function init() {
  initControls();

  document.addEventListener('fullscreenchange', () => {
    setFullscreenState();
  });

  window.addEventListener('resize', () => {
    setFullscreenState();
  });

  deckFrames.forEach((frameEl) => {
    if (!frameEl) return;
    frameEl.addEventListener('load', () => {
      if (pendingSwap && pendingSwap.frameEl === frameEl) {
        return;
      }

      installBridgeInFrame(frameEl);
      syncFrameClasses();
      setFullscreenState();
      updateHud();
    });
  });

  const savedDeckIndex = parseInt(sessionStorage.getItem(WRAPPER_STORAGE_KEY), 10);
  const startIndex = Number.isInteger(savedDeckIndex) && savedDeckIndex >= 0 && savedDeckIndex < DECKS.length
    ? savedDeckIndex
    : 0;

  loadDeck(startIndex);

  setFullscreenState();
  updateStatus();
}

init();
