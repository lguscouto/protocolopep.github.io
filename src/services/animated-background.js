export function startAnimatedBackground({
  container,
  theme,
  windowRef = window,
  documentRef = document,
  random = Math.random
} = {}) {
  if (!container || windowRef.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return null;

  const canvas = documentRef.createElement("canvas");
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  let width = (canvas.width = windowRef.innerWidth);
  let height = (canvas.height = windowRef.innerHeight);
  let animationFrame = null;
  let resizeFrame = null;

  const particles = Array.from({ length: 18 }, () => ({
    x: random() * width,
    y: random() * height,
    vx: (random() - 0.5) * 0.4,
    vy: (random() - 0.5) * 0.4,
    r: random() * 2 + 1.2
  }));

  const resize = () => {
    if (resizeFrame !== null) return;
    resizeFrame = windowRef.requestAnimationFrame(() => {
      resizeFrame = null;
      width = canvas.width = windowRef.innerWidth;
      height = canvas.height = windowRef.innerHeight;
    });
  };

  const animate = () => {
    animationFrame = null;
    if (documentRef.hidden) return;
    ctx.clearRect(0, 0, width, height);
    const isWhite = theme.isLight();
    ctx.fillStyle = isWhite ? "rgba(14, 133, 128, 0.2)" : "rgba(44, 197, 192, 0.15)";
    ctx.strokeStyle = isWhite ? "rgba(14, 133, 128, 0.08)" : "rgba(44, 197, 192, 0.06)";

    for (let i = 0; i < particles.length; i += 1) {
      const particle = particles[i];
      particle.x += particle.vx;
      particle.y += particle.vy;
      if (particle.x < 0) particle.x = width;
      if (particle.x > width) particle.x = 0;
      if (particle.y < 0) particle.y = height;
      if (particle.y > height) particle.y = 0;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
      ctx.fill();

      for (let j = i + 1; j < particles.length; j += 1) {
        const other = particles[j];
        const dx = particle.x - other.x;
        const dy = particle.y - other.y;
        if ((dx * dx) + (dy * dy) < 12100) {
          ctx.beginPath();
          ctx.moveTo(particle.x, particle.y);
          ctx.lineTo(other.x, other.y);
          ctx.stroke();
        }
      }
    }
    animationFrame = windowRef.requestAnimationFrame(animate);
  };

  const handleVisibility = () => {
    if (documentRef.hidden && animationFrame !== null) {
      windowRef.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    } else if (!documentRef.hidden && animationFrame === null) {
      animationFrame = windowRef.requestAnimationFrame(animate);
    }
  };

  windowRef.addEventListener("resize", resize);
  documentRef.addEventListener("visibilitychange", handleVisibility);
  animationFrame = windowRef.requestAnimationFrame(animate);

  return {
    isRunning: () => animationFrame !== null,
    destroy() {
      if (animationFrame !== null) windowRef.cancelAnimationFrame(animationFrame);
      if (resizeFrame !== null) windowRef.cancelAnimationFrame(resizeFrame);
      windowRef.removeEventListener("resize", resize);
      documentRef.removeEventListener("visibilitychange", handleVisibility);
      canvas.remove();
    }
  };
}
