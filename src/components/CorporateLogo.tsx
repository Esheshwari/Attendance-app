import React from 'react';

export function CorporateLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="36" height="36" rx="10" fill="url(#vantrex_grad)" />
      <path
        d="M18 7.5L26.66 12.5V22.5L18 27.5L9.34 22.5V12.5L18 7.5Z"
        stroke="white"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeOpacity="0.95"
      />
      <path
        d="M13.5 14.5L18 22.5L22.5 14.5"
        stroke="white"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="18" cy="11.5" r="1.4" fill="#93c5fd" />
      <defs>
        <linearGradient id="vantrex_grad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1e40af" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
    </svg>
  );
}
