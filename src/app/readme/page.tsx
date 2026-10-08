import { parseMarkdownFile } from "../../utils/markdown";
import { BrandLogo } from "../../components/common/BrandLogo";
import { ThemeToggle } from "../../components/common/ThemeToggle";
import { PrintButton } from "../../components/common/PrintButton";
import Link from "next/link";
import { ArrowLeft, BookOpen, FileCode2 } from "lucide-react";

export const metadata = {
  title: "ข้อมูลระบบและการดูแลรักษา (System & Maintenance) | Eater Egg Fresh Mart",
  description: "โครงสร้างระบบ สถาปัตยกรรม Next.js 16, Supabase, Drizzle ORM และคู่มือการบำรุงรักษาสำหรับ Eater Egg Fresh Mart",
};

export default function ReadmePage() {
  const readmeData = parseMarkdownFile("README.md");

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="no-print sticky top-0 z-30 bg-[var(--color-surface)]/90 backdrop-blur-md border-b border-[var(--color-border)] px-4 sm:px-8 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">กลับหน้าหลัก</span>
          </Link>
          <div className="h-6 w-px bg-[var(--color-border)]" />
          <BrandLogo size={28} showText={false} isDark={false} />
          <span className="text-sm font-bold text-[var(--color-text)] hidden sm:inline">
            ข้อมูลระบบ & การบำรุงรักษา (README.md)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/guide"
            className="px-3 py-1.5 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-xs font-semibold flex items-center gap-1.5 transition-colors text-[var(--color-text)]"
          >
            <BookOpen size={14} className="text-amber-600" />
            <span>ดูคู่มือปฏิบัติงาน (GUIDE)</span>
          </Link>

          <ThemeToggle />
        </div>
      </header>

      {/* Main Container */}
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-8 py-8 flex-1">
        {/* Printable Header */}
        <div className="hidden print:block mb-8 pb-4 border-b-2 border-black">
          <div className="text-2xl font-bold">Eater Egg Fresh Mart</div>
          <div className="text-base text-gray-700 font-semibold">
            ข้อมูลระบบ โครงสร้างสถาปัตยกรรม และการดูแลรักษา (README.md)
          </div>
          <div className="text-xs text-gray-500 mt-1">
            พิมพ์จากระบบ Eater Egg Fresh Mart Portal
          </div>
        </div>

        {/* Article Body */}
        <main className="doc-content bg-[var(--color-surface)] p-6 sm:p-12 rounded-2xl border border-[var(--color-border)] shadow-xs">
          <article dangerouslySetInnerHTML={{ __html: readmeData.html }} />
        </main>
      </div>

      {/* Footer */}
      <footer className="no-print py-6 border-t border-[var(--color-border)] text-center text-xs text-[var(--color-text-muted)]">
        Eater Egg Fresh Mart • Checklist System & Operational Guidelines
      </footer>
    </div>
  );
}
