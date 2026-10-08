import { BrandLogo } from "../components/common/BrandLogo";
import { ThemeToggle } from "../components/common/ThemeToggle";
import { PortalDocsSection } from "../components/common/PortalDocsSection";
import { PortalMainSection } from "../components/common/PortalMainSection";
import { parseMarkdownFile } from "../utils/markdown";

export default function PortalPage() {
  const guideData = parseMarkdownFile("GUIDE.md");

  return (
    <main className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col justify-between px-4 py-6 sm:py-10 font-sans relative">
      {/* Theme Toggle at top right */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col justify-center">
        {/* Brand Header */}
        <header className="mb-6 sm:mb-8 text-center flex flex-col items-center">
          <BrandLogo size={56} showText={true} isDark={false} subtitle="ระบบตรวจเช็คลิสต์และมาตรฐานการปฏิบัติงานสาขา" />
          <h1 className="sr-only">ระบบตรวจเช็คลิสต์และกำกับดูแลสาขา Eater Egg Fresh Mart</h1>
          <p className="mt-3 text-[var(--color-text-muted)] text-sm sm:text-base font-normal max-w-md">
            เลือกช่องทางเข้าปฏิบัติงานตามตำแหน่งหน้าที่ หรือลงทะเบียนพนักงานสาขาใหม่
          </p>
        </header>

        {/* Structured Operational Gateways + Employee Registration */}
        <PortalMainSection />

        {/* Integrated Operating Guide Section */}
        <PortalDocsSection guideData={guideData} />
      </div>

      <footer className="mt-8 text-center text-xs text-[var(--color-text-muted)] font-medium flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2">
        <span>Eater Egg Fresh Mart • Operations, SOP & Audit Portal</span>
        <span className="hidden sm:inline">•</span>
        <span>
          User avatar icons modified from{" "}
          <a
            href="https://www.flaticon.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          >
            www.flaticon.com
          </a>
        </span>
      </footer>
    </main>
  );
}
