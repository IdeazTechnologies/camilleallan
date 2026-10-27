"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function MobileMenuCloser() {
  const pathname = usePathname();
  useEffect(() => {
    const menu = document.getElementById("mobile-menu");
    if (menu?.matches(":popover-open")) menu.hidePopover();
  }, [pathname]);
  return null;
}
