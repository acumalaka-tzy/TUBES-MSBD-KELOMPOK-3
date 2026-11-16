"use client";

const PENDING_SCROLL_KEY = "warkop_pending_scroll_target";

/**
 * Menggulir layar secara mulus (smooth) menggunakan requestAnimationFrame
 * dengan kurva easeInOutCubic ke elemen target berdasarkan ID.
 * Menghitung posisi elemen secara dinamis di setiap frame agar tetap akurat
 * meskipun gambar/konten di atasnya baru selesai dimuat.
 */
export function smoothScrollToSection(
  elementId: string,
  offsetPx = -72,
  durationMs = 680,
): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const targetEl = document.getElementById(elementId);
  if (!targetEl) {
    return false;
  }

  const startY = window.scrollY || window.pageYOffset;
  const initialTargetY = getTargetScrollTop(targetEl, offsetPx);

  if (Math.abs(initialTargetY - startY) < 4) {
    return true;
  }

  const htmlEl = document.documentElement;
  const prevScrollBehavior = htmlEl.style.scrollBehavior;
  htmlEl.style.scrollBehavior = "auto";

  let startTime: number | null = null;

  function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function step(timestamp: number) {
    if (startTime === null) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(1, elapsed / durationMs);
    const eased = easeInOutCubic(progress);

    const currentTargetEl = document.getElementById(elementId);
    const liveTargetY = currentTargetEl
      ? getTargetScrollTop(currentTargetEl, offsetPx)
      : initialTargetY;

    const nextY = startY + (liveTargetY - startY) * eased;
    window.scrollTo(0, Math.round(nextY));

    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      htmlEl.style.scrollBehavior = prevScrollBehavior;
    }
  }

  window.requestAnimationFrame(step);
  return true;
}

function getTargetScrollTop(el: HTMLElement, offsetPx: number): number {
  const currentScroll = window.scrollY || window.pageYOffset;
  const rawY = el.getBoundingClientRect().top + currentScroll + offsetPx;
  const maxScrollY = Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight,
  );
  return Math.min(Math.max(0, rawY), maxScrollY);
}

/**
 * Menandai target section untuk di-scroll setelah navigasi lintas halaman selesai,
 * sekaligus menjalankan polling hingga elemen benar-benar muncul di DOM beranda.
 */
export function triggerScrollToSectionAcrossPages(
  elementId: string,
  navigateToHome: () => void,
  offsetPx = -72,
  durationMs = 680,
): void {
  if (typeof window === "undefined") return;

  // Jika sudah berada di halaman beranda dan elemen sudah tersedia di DOM
  if (window.location.pathname === "/") {
    const existing = document.getElementById(elementId);
    if (existing) {
      window.history.replaceState(null, "", `/#${elementId}`);
      smoothScrollToSection(elementId, offsetPx, durationMs);
      return;
    }
  }

  try {
    sessionStorage.setItem(PENDING_SCROLL_KEY, elementId);
  } catch {
    // Abaikan jika storage tidak tersedia
  }

  navigateToHome();
  waitAndScrollToElement(elementId, offsetPx, durationMs);
}

/**
 * Memeriksa apakah ada antrean scroll lintas halaman (atau hash URL) dan
 * menunggu hingga elemen target selesai dirender di DOM sebelum memulai animasi smooth scroll.
 */
export function consumePendingScrollOnHome(
  defaultElementId = "info",
  offsetPx = -72,
  durationMs = 680,
): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== "/") return;

  let pendingId: string | null = null;
  try {
    pendingId = sessionStorage.getItem(PENDING_SCROLL_KEY);
    if (pendingId) {
      sessionStorage.removeItem(PENDING_SCROLL_KEY);
    }
  } catch {
    // Abaikan
  }

  if (!pendingId && window.location.hash === `#${defaultElementId}`) {
    pendingId = defaultElementId;
  }

  if (pendingId) {
    waitAndScrollToElement(pendingId, offsetPx, durationMs);
  }
}

function waitAndScrollToElement(
  elementId: string,
  offsetPx: number,
  durationMs: number,
): void {
  let attempts = 0;
  const maxAttempts = 60; // hingga ~3.6 detik

  const checkInterval = window.setInterval(() => {
    attempts += 1;

    if (window.location.pathname === "/") {
      const targetEl = document.getElementById(elementId);
      if (targetEl && targetEl.getBoundingClientRect().height > 0) {
        window.clearInterval(checkInterval);
        try {
          sessionStorage.removeItem(PENDING_SCROLL_KEY);
        } catch {
          // Abaikan
        }
        // Tunggu sejenak agar reset scroll bawaan router Next.js selesai lebih dulu
        window.setTimeout(() => {
          window.history.replaceState(null, "", `/#${elementId}`);
          smoothScrollToSection(elementId, offsetPx, durationMs);
        }, 120);
        return;
      }
    }

    if (attempts >= maxAttempts) {
      window.clearInterval(checkInterval);
    }
  }, 60);
}
