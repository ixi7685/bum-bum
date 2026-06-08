import type { Metadata } from "next";
import "./globals.css";
import Header from "./components/Header";
import { AuthProvider } from "./context/AuthContext";

export const metadata: Metadata = {
  title: "Why Risk — Employment Risk Intelligence",
  description:
    "See patterns, not promises. Multi-source intelligence from Reddit, Glassdoor, HackerNews, and more — before you sign.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Header />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
