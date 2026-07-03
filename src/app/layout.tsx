import type { Metadata, Viewport } from "next";
import { Geist_Mono, Rubik } from "next/font/google";
import "@/styles/globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { SuppressKnownErrors } from "@/components/SuppressKnownErrors";
import RouteProgressBar from "@/components/RouteProgressBar";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Workzen HRIS Web App",
  description: "Workzen HRIS Web App – Employee data, workflows, approvals, audit.",
  icons: {
    icon: "/newlogo.png",
    shortcut: "/newlogo.png",
    apple: "/newlogo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${rubik.variable} dark`}>
      <head>
        <link rel="icon" type="image/png" href="/newlogo.png" />
        <link rel="shortcut icon" type="image/png" href="/newlogo.png" />
        <meta
          name="format-detection"
          content="telephone=no, date=no, email=no, address=no"
        />
      </head>
      <body className={`${rubik.variable} ${geistMono.variable} antialiased`}>
        <RouteProgressBar />
        <SuppressKnownErrors />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
