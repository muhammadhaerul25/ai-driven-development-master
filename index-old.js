'use strict';

// ── State ────────────────────────────────────
let currentIndex = 0;
let isAnimating  = false;

const STORAGE_KEY = 'presentation-slide-index';

// ── DOM refs ─────────────────────────────────
const slides      = Array.from(document.querySelectorAll('.slide'));
const totalEl     = document.getElementById('totalSlides');
const currentEl   = document.getElementById('currentSlide');
const progressBar = document.getElementById('progressBar');
const prevBtn     = document.getElementById('prevBtn');
const nextBtn     = document.getElementById('nextBtn');

// ── Step state per slide ──────────────────────
const stepState = slides.map(() => 0);

function getStepCount(slideEl) {
  return parseInt(slideEl.dataset.steps || '1', 10);
}

function getStepEls(slideEl) {
  return Array.from(slideEl.querySelectorAll('.reveal-step'));
}

function showStep(slideEl, stepIndex) {
  const stepEls = getStepEls(slideEl);
  if (!stepEls.length) return;
  stepEls.forEach((el, i) => {
    el.classList.toggle('active-step', i === stepIndex);
  });
}

function resetSteps(slideEl) {
  const i = slides.indexOf(slideEl);
  if (i === -1) return;
  stepState[i] = 0;
  showStep(slideEl, 0);
}

// ── Init ─────────────────────────────────────
function init() {
  if (!totalEl) return;
  totalEl.textContent = slides.length;

  const saved = parseInt(sessionStorage.getItem(STORAGE_KEY), 10);
  const startIndex = (!isNaN(saved) && saved >= 0 && saved < slides.length) ? saved : 0;

  goTo(startIndex, 'none');
  updateControls();
  attachEvents();
  setupTwitterVideos();
}

// ── Navigation ───────────────────────────────
function goTo(index, direction = 'next') {
  if (isAnimating) return;
  if (index < 0 || index >= slides.length) return;

  isAnimating = true;

  const prev = slides[currentIndex];
  const next = slides[index];

  // Update Body Class for CSS scoping
  const chapter = next.dataset.chapter || 'base';
  document.body.className = `ch-${chapter}`;

  resetSteps(next);

  slides.forEach(s => s.classList.remove('active', 'prev'));
  next.classList.add('active');
  if (direction !== 'none' && prev) prev.classList.add('prev');

  currentIndex = index;
  sessionStorage.setItem(STORAGE_KEY, index);
  updateHUD();
  updateControls();

  setTimeout(() => {
    slides.forEach(s => s.classList.remove('prev'));
    isAnimating = false;
  }, 550);
}

function nextSlide() {
  const slide = slides[currentIndex];
  const totalSteps = getStepCount(slide);
  const cur = stepState[currentIndex];

  if (cur < totalSteps - 1) {
    stepState[currentIndex]++;
    showStep(slide, stepState[currentIndex]);
    updateControls();
  } else if (currentIndex < slides.length - 1) {
    goTo(currentIndex + 1, 'next');
  }
}

function prevSlide() {
  const slide = slides[currentIndex];
  const cur = stepState[currentIndex];

  if (cur > 0) {
    stepState[currentIndex]--;
    showStep(slide, stepState[currentIndex]);
    updateControls();
  } else if (currentIndex > 0) {
    goTo(currentIndex - 1, 'prev');
  }
}

// ── HUD ──────────────────────────────────────
function updateHUD() {
  if (currentEl) currentEl.textContent = currentIndex + 1;
  const progress = ((currentIndex + 1) / slides.length) * 100;
  if (progressBar) progressBar.style.width = progress + '%';
  
  const slideLabel = slides[currentIndex].querySelector('.slide-label')?.textContent || '';
  document.title = `${slideLabel} — AI-Driven Development`;
}

function updateControls() {
  if (!prevBtn || !nextBtn) return;
  const atStart = currentIndex === 0 && stepState[currentIndex] === 0;
  const atEnd   = currentIndex === slides.length - 1 &&
                  stepState[currentIndex] === getStepCount(slides[currentIndex]) - 1;
  prevBtn.disabled = atStart;
  nextBtn.disabled = atEnd;
}

// ── Events ───────────────────────────────────
function attachEvents() {
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('wheel', debounce(onWheel, 80), { passive: true });
}

function onKeyDown(e) {
  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowDown':
    case 'PageDown':
    case ' ':
      e.preventDefault();
      nextSlide();
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'PageUp':
      e.preventDefault();
      prevSlide();
      break;
    case 'Home':
      e.preventDefault();
      goTo(0, 'none');
      break;
    case 'End':
      e.preventDefault();
      goTo(slides.length - 1, 'next');
      break;
    case 'f':
    case 'F':
      toggleFullscreen();
      break;
    case 'Escape':
      if (document.fullscreenElement) toggleFullscreen();
      break;
  }
}

function onWheel(e) {
  if (e.deltaY > 0) nextSlide();
  else prevSlide();
}

// ── Fullscreen ───────────────────────────────
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
}

// ── Slide Map ─────────────────────────────────
function toggleSlideMap() {
  const num = parseInt(prompt(`Go to slide (1–${slides.length}):`));
  if (!isNaN(num) && num >= 1 && num <= slides.length) {
    const dir = num - 1 > currentIndex ? 'next' : 'prev';
    goTo(num - 1, dir);
  }
}

// ── Twitter Video Sync ───────────────────────
function setupTwitterVideos() {
  const containers = document.querySelectorAll('.twitter-video-sync, .vibe-video-embed');
  const proxies = ['api.fxtwitter.com', 'api.vxtwitter.com', 'api.fixupx.com'];
  
  containers.forEach(container => {
    const video = container.querySelector('video');
    const fallback = container.querySelector('.video-fallback, .vibe-video-fallback');
    const tweetId = container.getAttribute('data-tweet-id') || '1924399746447269963';

    if (!video) return;

    let proxyIndex = 0;

    function tryFetch() {
      if (proxyIndex >= proxies.length) {
        showFallback();
        return;
      }

      const apiUrl = `https://${proxies[proxyIndex]}/status/${tweetId}`;
      fetch(apiUrl)
        .then(r => r.json())
        .then(data => {
          const mp4 = data?.tweet?.media?.videos?.[0]?.url
                    || data?.tweet?.media?.all?.[0]?.url;
          if (mp4) {
            video.src = mp4;
            video.load();
            video.play().catch(() => {});
            if (fallback) fallback.style.display = 'none';
          } else {
            nextProxy();
          }
        })
        .catch(() => nextProxy());
    }

    function nextProxy() {
      proxyIndex++;
      tryFetch();
    }

    tryFetch();

    video.addEventListener('error', showFallback);
    
    video.addEventListener('canplay', () => {
      if (fallback) fallback.style.display = 'none';
      video.play().catch(() => {});
    });

    function showFallback() {
      video.style.display = 'none';
      if (fallback) fallback.style.display = 'flex';
    }
  });
}

// ── Utility ──────────────────────────────────
function debounce(fn, wait) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

// ── Start ─────────────────────────────────────
init();
