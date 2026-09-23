import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { AppProvider } from "../context/AppContext";
import { LoadingProvider } from "../context/LoadingContext";
import { PageTransitionWatcher } from "../components/common/PageTransitionWatcher";
import { GlobalLoadingOverlay } from "../components/common/GlobalLoadingOverlay";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1e8" },
    { media: "(prefers-color-scheme: dark)", color: "#18100f" },
  ],
};

export const metadata: Metadata = {
  title: "Eater Egg Fresh Mart - ระบบเช็คลิสต์ประจำกะ",
  description: "ระบบจัดการและตรวจสอบเช็คลิสต์การปฏิบัติงานประจำกะ",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }

                // Daily cache eviction: check if last visit was on a different day
                var now = new Date();
                var todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now);
                var lastVisit = localStorage.getItem('app_last_visit_date');
                if (lastVisit && lastVisit !== todayStr) {
                  var keysToRemove = [
                    'app_sessions',
                    'app_active_session',
                    'app_selected_shift',
                    'cached_branches',
                    'branch_last_update',
                    'branches_last_checked_at',
                    'app_manager_read_notifs',
                    'app_notifications'
                  ];
                  for (var i = 0; i < keysToRemove.length; i++) {
                    localStorage.removeItem(keysToRemove[i]);
                  }
                }
                localStorage.setItem('app_last_visit_date', todayStr);
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--color-background)] text-[var(--color-text)]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-[var(--color-surface)] focus:text-[var(--color-primary)] focus:text-xs focus:font-bold focus:rounded-xl focus:shadow-xl focus:outline-2 focus:outline-[var(--color-primary)]"
        >
          ข้ามไปยังเนื้อหาหลัก (Skip to main content)
        </a>
        <LoadingProvider>
          <Suspense fallback={null}>
            <PageTransitionWatcher />
          </Suspense>
          <GlobalLoadingOverlay />
          <AppProvider>
            <main id="main-content" tabIndex={-1} className="min-h-full flex-1 focus-visible:outline-none">
              {children}
            </main>
          </AppProvider>
        </LoadingProvider>
      </body>
    </html>
  );
}
