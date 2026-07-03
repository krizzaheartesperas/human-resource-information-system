"use client";

import Image from "next/image";
import { useTheme } from "@/components/theme/ThemeProvider";

type ThemeLogoProps = {
  width?: number;
  height?: number;
  className?: string;
};

export function ThemeLogo({ width = 48, height = 48, className }: ThemeLogoProps) {
  const { theme } = useTheme();
  const logoSrc = "/newlogo.png";

  return (
    <Image
      src={logoSrc}
      alt="Workzen HRIS logo"
      width={width}
      height={height}
      className={`shrink-0 object-contain ${className ?? ""}`}
      unoptimized
    />
  );
}
