import type { SVGProps } from "react";

/** The Cute Job Platform mark — also duplicated as static markup in src/app/icon.svg for the browser-tab favicon (that file can't import a component). Keep the two in sync if this ever changes. */
export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="100" height="100" rx="22" fill="#4CAF7D" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M50 18 82 82 18 82ZM50 52 64 82 36 82Z"
        fill="#fff"
      />
    </svg>
  );
}
