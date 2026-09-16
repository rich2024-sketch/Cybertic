import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudyMate — Your lecture, understood",
  description: "Korean lectures, English understanding. Record, organise, and revisit each class with notes suited to your academic year.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
