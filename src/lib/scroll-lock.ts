"use client";

import { useEffect } from "react";

let lockCount = 0;
let savedScrollY = 0;

let prevHtmlOverflow = "";
let prevHtmlOverscrollBehavior = "";
let prevBodyOverflow = "";
let prevBodyPosition = "";
let prevBodyTop = "";
let prevBodyLeft = "";
let prevBodyRight = "";
let prevBodyWidth = "";
let prevBodyPaddingRight = "";
let prevBodyOverscrollBehavior = "";

/**
 * Mengunci scroll halaman di belakang drawer/modal (desktop maupun mobile)
 * menggunakan reference counter agar modal bertumpuk tetap aman.
 */
export function lockBodyScroll(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const html = document.documentElement;
  const body = document.body;

  if (lockCount === 0) {
    savedScrollY = window.scrollY;

    prevHtmlOverflow = html.style.overflow;
    prevHtmlOverscrollBehavior = html.style.overscrollBehavior;
    prevBodyOverflow = body.style.overflow;
    prevBodyPosition = body.style.position;
    prevBodyTop = body.style.top;
    prevBodyLeft = body.style.left;
    prevBodyRight = body.style.right;
    prevBodyWidth = body.style.width;
    prevBodyPaddingRight = body.style.paddingRight;
    prevBodyOverscrollBehavior = body.style.overscrollBehavior;

    const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);

    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${savedScrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overscrollBehavior = "none";

    if (scrollbarWidth > 0) {
      const computedPaddingRight = Number.parseFloat(getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${computedPaddingRight + scrollbarWidth}px`;
    }
  }

  lockCount += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);

    if (lockCount === 0) {
      html.style.overflow = prevHtmlOverflow;
      html.style.overscrollBehavior = prevHtmlOverscrollBehavior;

      body.style.overflow = prevBodyOverflow;
      body.style.position = prevBodyPosition;
      body.style.top = prevBodyTop;
      body.style.left = prevBodyLeft;
      body.style.right = prevBodyRight;
      body.style.width = prevBodyWidth;
      body.style.paddingRight = prevBodyPaddingRight;
      body.style.overscrollBehavior = prevBodyOverscrollBehavior;

      const prevScrollBehavior = html.style.scrollBehavior;
      html.style.scrollBehavior = "auto";
      window.scrollTo(0, savedScrollY);
      html.style.scrollBehavior = prevScrollBehavior;
    }
  };
}

/** Hook untuk mengunci scroll latar belakang selama overlay terbuka. */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    return lockBodyScroll();
  }, [locked]);
}
