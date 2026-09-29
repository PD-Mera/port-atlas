import type { SVGProps } from "react";

export type IconName = "search" | "server" | "layers" | "grid" | "plus" | "arrow" | "clock" | "command";

const paths: Record<IconName, string[]> = {
  search: ["M21 21l-4.5-4.5", "M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0"],
  server: ["M4 3h16v7H4z", "M4 14h16v7H4z", "M7 6.5h.01M7 17.5h.01M11 6.5h6M11 17.5h6"],
  layers: ["M12 3 2 8l10 5 10-5-10-5", "m2 12 10 5 10-5", "m2 16 10 5 10-5"],
  grid: ["M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"],
  plus: ["M12 5v14M5 12h14"],
  arrow: ["M5 12h14m-6-6 6 6-6 6"],
  clock: ["M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0", "M12 6v6l4 2"],
  command: ["M9 7V4a2 2 0 1 0-2 2h10a2 2 0 1 0-2-2v16a2 2 0 1 0 2-2H7a2 2 0 1 0 2 2V7"],
};

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {paths[name].map((path, index) => <path key={index} d={path} />)}
  </svg>;
}
