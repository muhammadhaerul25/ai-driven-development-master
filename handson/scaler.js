/* =============================================
   SLIDE SCALER — Fixed 16:9 Aspect Ratio
   Ensures consistent appearance on any display:
   laptop, projector, or videotron.
   ============================================= */

(function () {
  'use strict';

  // Reference design resolution (16:9)
  const REF_W = 1920;
  const REF_H = 1080;

  const scaler = document.getElementById('slideScaler');
  if (!scaler) return;

  function resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Scale uniformly to fit inside the viewport
    const scale = Math.min(vw / REF_W, vh / REF_H);

    // Center the scaled canvas in the viewport (letterbox/pillarbox)
    const scaledW = REF_W * scale;
    const scaledH = REF_H * scale;
    const offsetX = (vw - scaledW) / 2;
    const offsetY = (vh - scaledH) / 2;

    scaler.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    scaler.style.width  = REF_W + 'px';
    scaler.style.height = REF_H + 'px';
  }

  // Run on load and resize
  resize();
  window.addEventListener('resize', resize);

  // Also handle fullscreen changes
  document.addEventListener('fullscreenchange', () => {
    // Small delay to let the browser settle the new viewport
    setTimeout(resize, 100);
  });
})();