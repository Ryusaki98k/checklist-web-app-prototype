import { parseMarkdownFile } from "../../utils/markdown";
import { BrandLogo } from "../../components/common/BrandLogo";
import { ThemeToggle } from "../../components/common/ThemeToggle";
import { PrintButton } from "../../components/common/PrintButton";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "คู่มือการปฏิบัติงานสาขา (SOP & User Guide) | Eater Egg Fresh Mart",
  description: "คู่มือการใช้งานระบบตรวจเช็คลิสต์และกำกับดูแลสาขา Eater Egg Fresh Mart สำหรับพนักงาน, ผู้ช่วยผู้จัดการ, ผู้จัดการร้าน, ผู้บริหาร และเจ้าของกิจการ",
};

export default function GuidePage() {
  const guideData = parseMarkdownFile("GUIDE.md");

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
            คู่มือการปฏิบัติงานสาขา (GUIDE.md)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <PrintButton />
          <ThemeToggle />
        </div>
      </header>

      {/* Main Container */}
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-8 py-8 flex-1">
        {/* Printable Header */}
        <div className="hidden print:block mb-8 pb-4 border-b-2 border-black">
          <div className="text-2xl font-bold">Eater Egg Fresh Mart</div>
          <div className="text-base text-gray-700 font-semibold">
            คู่มือการปฏิบัติงานตามมาตรฐาน (SOP & User Guide)
          </div>
          <div className="text-xs text-gray-500 mt-1">
            พิมพ์จากระบบ Eater Egg Fresh Mart Portal
          </div>
        </div>

        {/* Article Body */}
        <main className="doc-content bg-[var(--color-surface)] p-6 sm:p-12 rounded-2xl border border-[var(--color-border)] shadow-xs">
          <article dangerouslySetInnerHTML={{ __html: guideData.html }} />
        </main>
      </div>

      {/* Footer */}
      <footer className="no-print py-6 border-t border-[var(--color-border)] text-center text-xs text-[var(--color-text-muted)]">
        Eater Egg Fresh Mart • Checklist System & Operational Guidelines
      </footer>
    </div>
  );
}
