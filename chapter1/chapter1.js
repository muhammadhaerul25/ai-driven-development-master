/* =============================================
   CHAPTER 1 — PRESENTATION ENGINE
   ============================================= */

'use strict';

// ── State ────────────────────────────────────
let currentIndex = 0;
let isAnimating  = false;

// Storage key for persisting slide position across refreshes
const STORAGE_KEY = 'slide-pos-ch1';

// ── DOM refs ─────────────────────────────────
const slides      = Array.from(document.querySelectorAll('.slide'));
const totalEl     = document.getElementById('totalSlides');
const currentEl   = document.getElementById('currentSlide');
const progressBar = document.getElementById('progressBar');
const prevBtn     = document.getElementById('prevBtn');
const nextBtn     = document.getElementById('nextBtn');

function stopVideosInSlide(slideEl) {
  if (!slideEl) return;
  slideEl.querySelectorAll('video').forEach(video => {
    try {
      video.pause();
      video.currentTime = 0;
    } catch { }
  });
}

function playVideosInSlide(slideEl) {
  if (!slideEl) return;
  slideEl.querySelectorAll('video').forEach(video => {
    try {
      video.loop = true;
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      const maybePromise = video.play();
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => {
          setTimeout(() => {
            try { video.play().catch(() => { }); } catch { }
          }, 120);
        });
      }
    } catch { }
  });
}

// ── Init ─────────────────────────────────────
function init() {
  totalEl.textContent = slides.length;

  // Restore saved position on refresh
  const saved = parseInt(sessionStorage.getItem(STORAGE_KEY), 10);
  const startIndex = (!isNaN(saved) && saved >= 0 && saved < slides.length) ? saved : 0;

  goTo(startIndex, 'none');
  updateControls();
  attachEvents();
}

// ── Navigation ───────────────────────────────
function goTo(index, direction = 'next') {
  if (isAnimating) return;
  if (index < 0 || index >= slides.length) return;

  isAnimating = true;

  const prev = slides[currentIndex];
  const next = slides[index];

  if (prev !== next) stopVideosInSlide(prev);

  slides.forEach(s => s.classList.remove('active', 'prev'));
  next.classList.add('active');
  if (direction !== 'none') prev.classList.add('prev');

  currentIndex = index;
  sessionStorage.setItem(STORAGE_KEY, index);
  updateHUD();
  updateControls();

  playVideosInSlide(next);

  setTimeout(() => {
    slides.forEach(s => s.classList.remove('prev'));
    isAnimating = false;
  }, 550);
}

function nextSlide() {
  if (currentIndex < slides.length - 1) goTo(currentIndex + 1, 'next');
}

function prevSlide() {
  if (currentIndex > 0) goTo(currentIndex - 1, 'prev');
}

// ── HUD Update ───────────────────────────────
function updateHUD() {
  currentEl.textContent = currentIndex + 1;
  const progress = ((currentIndex + 1) / slides.length) * 100;
  progressBar.style.width = progress + '%';
  document.title = `Ch.1 · Slide ${currentIndex + 1}/${slides.length} — AI Changed the Industry`;
}

function updateControls() {
  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex === slides.length - 1;
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

// ── Utility ──────────────────────────────────
function debounce(fn, wait) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

// ── Twitter Video Sync — Autoplay + Loop ───────────
function playResolvedVideo(video) {
  try {
    video.loop = true;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    const maybePromise = video.play();
    if (maybePromise && typeof maybePromise.catch === 'function') {
      maybePromise.catch(() => {
        setTimeout(() => {
          try { video.play().catch(() => { }); } catch { }
        }, 120);
      });
    }
  } catch { }
}

async function resolveTwitterVideo(tweetId) {
  const apiUrl = `/api/twitter-video.mp4?tweetId=${encodeURIComponent(tweetId)}`;
  const response = await fetch(apiUrl);
  if (!response.ok) return null;
  return apiUrl;
}

function setupTwitterVideos() {
  const containers = document.querySelectorAll('.twitter-video-sync, .vibe-video-embed');
  
  containers.forEach(container => {
    const tweetId = container.getAttribute('data-tweet-id');
    if (!tweetId) return;

    const video = container.querySelector('video');
    const fallback = container.querySelector('.video-fallback, .vibe-video-fallback');

    if (!video) return;

    (async () => {
      try {
        const mp4 = await resolveTwitterVideo(tweetId);
        if (!mp4) {
          showFallback();
          return;
        }

        video.src = mp4;
        video.preload = 'auto';
        video.load();

        if (fallback) fallback.style.display = 'none';

        const slide = container.closest('.slide');
        if (slide && slide.classList.contains('active')) {
          playResolvedVideo(video);
        }
      } catch {
        showFallback();
      }
    })();

    video.addEventListener('error', showFallback);
    video.addEventListener('loadedmetadata', () => {
      if (video.videoWidth && video.videoHeight) {
        container.style.setProperty('--vibe-video-ratio', `${video.videoWidth} / ${video.videoHeight}`);
      }
      playResolvedVideo(video);
    });

    const timer = setTimeout(() => {
      if (!video.src) showFallback();
    }, 8000);

    video.addEventListener('canplay', () => {
      clearTimeout(timer);
      if (fallback) fallback.style.display = 'none';
      playResolvedVideo(video);
    });

    function showFallback() {
      clearTimeout(timer);
      video.style.display = 'none';
      if (fallback) fallback.style.display = 'flex';
    }
  });
}

// ── Start ─────────────────────────────────────
init();
setupTwitterVideos();