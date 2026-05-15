/* =============================================
   AI-DRIVEN DEVELOPMENT — PRESENTATION ENGINE
   ============================================= */
'use strict';

let currentIndex = 0;
let isAnimating = false;
let touchStartX = 0;
let touchStartY = 0;

const STORAGE_KEY = `slide-pos-index:${location.pathname}`;

const slides = Array.from(document.querySelectorAll('.slide'));
const totalEl = document.getElementById('totalSlides');
const currentEl = document.getElementById('currentSlide');
const progressBar = document.getElementById('progressBar');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

const stepState = slides.map(() => 0);

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
      const maybePromise = video.play();
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => { });
      }
    } catch { }
  });
}

function getStepCount(slideEl) {
  return parseInt(slideEl.dataset.steps || '1', 10);
}
function getStepEls(slideEl) {
  return Array.from(slideEl.querySelectorAll('.reveal-step'));
}
function showStep(slideEl, stepIndex) {
  const els = getStepEls(slideEl);
  if (!els.length) return;
  els.forEach((el, i) => el.classList.toggle('active-step', i === stepIndex));
}
function resetSteps(slideEl) {
  const i = slides.indexOf(slideEl);
  stepState[i] = 0;
  showStep(slideEl, 0);
}

function init() {
  totalEl.textContent = slides.length;

  const saved = parseInt(sessionStorage.getItem(STORAGE_KEY), 10);
  const startIndex = (!isNaN(saved) && saved >= 0 && saved < slides.length) ? saved : 0;

  goTo(startIndex, 'none');
  updateControls();
  attachEvents();
}

function goTo(index, direction = 'next') {
  if (isAnimating) return;
  if (index < 0 || index >= slides.length) return;
  isAnimating = true;
  const prev = slides[currentIndex];
  const next = slides[index];

  if (prev !== next) stopVideosInSlide(prev);
  resetSteps(next);
  slides.forEach(s => s.classList.remove('active', 'prev'));
  next.classList.add('active');
  if (direction !== 'none') prev.classList.add('prev');
  currentIndex = index;
  sessionStorage.setItem(STORAGE_KEY, index);
  updateHUD();
  updateControls();
  playVideosInSlide(next);
  setTimeout(() => { slides.forEach(s => s.classList.remove('prev')); isAnimating = false; }, 550);
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

function updateHUD() {
  currentEl.textContent = currentIndex + 1;
  progressBar.style.width = ((currentIndex + 1) / slides.length * 100) + '%';
  document.title = `Slide ${currentIndex + 1}/${slides.length} — AI-Driven Development`;
}

function updateControls() {
  const atStart = currentIndex === 0 && stepState[currentIndex] === 0;
  const atEnd = currentIndex === slides.length - 1 &&
    stepState[currentIndex] === getStepCount(slides[currentIndex]) - 1;
  prevBtn.disabled = atStart;
  nextBtn.disabled = atEnd;
}

function attachEvents() {
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('wheel', debounce(onWheel, 80), { passive: true });
  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true });
  document.getElementById('slidesContainer').addEventListener('click', onContainerClick);
}

function onKeyDown(e) {
  switch (e.key) {
    case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ':
      e.preventDefault(); nextSlide(); break;
    case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
      e.preventDefault(); prevSlide(); break;
    case 'Home': e.preventDefault(); goTo(0, 'none'); break;
    case 'End': e.preventDefault(); goTo(slides.length - 1, 'next'); break;
    case 'f': case 'F': toggleFullscreen(); break;
    case 'Escape': if (document.fullscreenElement) toggleFullscreen(); break;
  }
}
function onWheel(e) { e.deltaY > 0 ? nextSlide() : prevSlide(); }
function onTouchStart(e) { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; }
function onTouchEnd(e) {
  const dx = touchStartX - e.changedTouches[0].clientX;
  const dy = touchStartY - e.changedTouches[0].clientY;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) dx > 0 ? nextSlide() : prevSlide();
}
function onContainerClick(e) {
  if (e.target.closest('button, a, .nav-controls')) return;
  const x = e.clientX / window.innerWidth;
  if (x > 0.65) nextSlide();
  else if (x < 0.35) prevSlide();
}
function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => { });
  else document.exitFullscreen();
}
function debounce(fn, wait) {
  let timer;
  return function (...args) { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), wait); };
}

init();