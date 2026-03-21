"use client";

/**
 * Minimal layout — no sidebar.
 * Wispr Flow uses a clean, chrome-free design with the Flow Bar
 * as the primary navigation element. Settings and history are
 * accessible from the top bar on the main page.
 */
export function ClientLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-full flex flex-col">{children}</div>;
}
