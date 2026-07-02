"use client";

import { useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { swipeDestination, type NavigationItem } from "@/lib/navigation";

const MIN_DISTANCE = 70;
const HORIZONTAL_DOMINANCE = 1.25;

export function PageSwipeNavigation({
  items,
  children,
}: {
  items: NavigationItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);

  function onTouchStart(event: React.TouchEvent<HTMLElement>) {
    if (
      event.touches.length !== 1 ||
      window.matchMedia("(min-width: 768px)").matches ||
      shouldIgnoreGesture(event.target)
    ) {
      start.current = null;
      return;
    }

    const touch = event.touches[0];
    start.current = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchEnd(event: React.TouchEvent<HTMLElement>) {
    const origin = start.current;
    start.current = null;
    if (!origin || event.changedTouches.length !== 1) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - origin.x;
    const deltaY = touch.clientY - origin.y;
    if (
      Math.abs(deltaX) < MIN_DISTANCE ||
      Math.abs(deltaX) < Math.abs(deltaY) * HORIZONTAL_DOMINANCE
    ) {
      return;
    }

    const destination = swipeDestination(
      pathname,
      items.map((item) => item.href),
      deltaX,
    );
    if (destination) router.push(destination);
  }

  return (
    <main
      className="mx-auto w-full max-w-5xl flex-1 px-4 py-6"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </main>
  );
}

function shouldIgnoreGesture(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  if (
    target.closest(
      "a, button, input, select, textarea, [role='dialog'], [role='listbox'], [contenteditable='true'], [data-swipe-ignore]",
    )
  ) {
    return true;
  }

  let element: Element | null = target;
  while (element) {
    const htmlElement = element as HTMLElement;
    const overflowX = window.getComputedStyle(element).overflowX;
    if (
      (overflowX === "auto" || overflowX === "scroll") &&
      htmlElement.scrollWidth > htmlElement.clientWidth
    ) {
      return true;
    }
    element = element.parentElement;
  }
  return false;
}
