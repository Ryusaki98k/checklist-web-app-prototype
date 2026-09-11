import { useState, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Role = "employee" | "manager";
export type ShiftType = "morning" | "afternoon" | "both";

interface Position {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  position?: string;
}

interface ChecklistItem {
  id: string;
  label: string;
  category?: string;
  completedAt: string | null;
}

interface ShiftSession {
  id: string;
  userId: string;
  userName: string;
  userPosition?: string;
  shift: ShiftType;
  startedAt: string;
  completedAt: string | null;
  items: ChecklistItem[];
  notified: boolean;
}

interface Notification {
  id: string;
  shiftSessionId: string;
  userName: string;
  userPosition?: string;
  shift: ShiftType;
  completedAt: string;
  read: boolean;
}

// ─── Focus Trap Hook (SC 2.1.2 No Keyboard Trap & SC 2.4.3 Focus Order) ─────────
function useModalFocusTrap(isOpen: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      const timer = setTimeout(() => {
        if (dialogRef.current) {
          const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length > 0) {
            focusable[0].focus();
          } else {
            dialogRef.current.focus();
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    } else if (triggerRef.current) {
      triggerRef.current.focus();
    }
  }, [isOpen]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === "Tab" && dialogRef.current) {
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }

  return { dialogRef, handleKeyDown };
}

// ─── Checklist Templates (Eater Egg Fresh Mart) ──────────────────────────────

// 1. แคชเชียร์
const CASHIER_MORNING_ITEMS: Omit<ChecklistItem, "completedAt">[] = [
  { id: "c-m1", category: "ช่วงก่อนเปิดร้าน (เตรียมความพร้อม)", label: "สแกนนิ้วเข้างาน แต่งกายและติดป้ายชื่อเรียบร้อย" },
  { id: "c-m2", category: "ช่วงก่อนเปิดร้าน (เตรียมความพร้อม)", label: "เปิดเครื่อง POS ล็อกอินด้วยรหัสของตนเอง และทดสอบอุปกรณ์ (เครื่องสแกนบาร์โค้ด, ลิ้นชักเก็บเงิน, เครื่องพิมพ์ใบเสร็จ)" },
  { id: "c-m3", category: "ช่วงก่อนเปิดร้าน (เตรียมความพร้อม)", label: "ตรวจนับเงินทอน (Float) ก้นลิ้นชักให้ครบถ้วนและถูกต้องตรงตามระเบียบ" },
  { id: "c-m4", category: "ช่วงก่อนเปิดร้าน (เตรียมความพร้อม)", label: "ตรวจเช็กและเติมอุปกรณ์อำนวยความสะดวกที่เคาน์เตอร์ (ถุงหูหิ้วสำหรับแยกของสด/เนื้อสัตว์, ม้วนกระดาษใบเสร็จ)" },
  { id: "c-m5", category: "ช่วงระหว่างกะ (ให้บริการและดูแลความเรียบร้อย)", label: "ทักทายลูกค้า คิดเงิน และทอนเงินอย่างถูกต้องรวดเร็ว" },
  { id: "c-m6", category: "ช่วงระหว่างกะ (ให้บริการและดูแลความเรียบร้อย)", label: "แจ้งลูกค้าอย่างสุภาพเรื่องข้อปฏิบัติของร้าน (เช่น การงดรับธนบัตร 1,000 บาท สำหรับยอดซื้อที่ต่ำกว่า 300 บาทในช่วงเช้า)" },
  { id: "c-m7", category: "ช่วงระหว่างกะ (ให้บริการและดูแลความเรียบร้อย)", label: "คอยรักษาความสะอาดบริเวณเคาน์เตอร์คิดเงิน เครื่องสแกน และเครื่องชั่ง (ถ้ามี) ให้สะอาดอยู่เสมอ โดยเฉพาะเมื่อมีคราบน้ำจากสินค้ากลุ่มเนื้อสด" },
  { id: "c-m8", category: "ช่วงระหว่างกะ (ให้บริการและดูแลความเรียบร้อย)", label: "จัดเรียงสินค้าบริเวณหน้าเคาน์เตอร์ให้เต็มและดูน่าซื้อเสมอ" },
  { id: "c-m9", category: "ช่วงระหว่างกะ (ให้บริการและดูแลความเรียบร้อย)", label: "เปลี่ยนป้ายเปลี่ยนบาร์โค้ด กรณี ปรับราคาสินค้า" },
  { id: "c-m10", category: "ช่วงก่อนส่งกะ (เคลียร์ยอดและส่งมอบงาน)", label: "เคลียร์บิล สรุปยอดขายส่วนตัวในกะเช้า และนับเงินสดส่งมอบตามระบบ" },
  { id: "c-m11", category: "ช่วงก่อนส่งกะ (เคลียร์ยอดและส่งมอบงาน)", label: "ตรวจสอบและจัดเตรียมเงินทอนให้เพียงพอสำหรับกะบ่าย" },
  { id: "c-m12", category: "ช่วงก่อนส่งกะ (เคลียร์ยอดและส่งมอบงาน)", label: "เก็บขยะบริเวณเคาน์เตอร์ไปทิ้ง" },
  { id: "c-m13", category: "ช่วงก่อนส่งกะ (เคลียร์ยอดและส่งมอบงาน)", label: "ส่งมอบกะ (Handover) แจ้งข้อมูลสำคัญ โปรโมชันที่ต้องเน้น หรือปัญหาที่พบในช่วงเช้าให้แคชเชียร์กะบ่ายทราบ" },
];

const CASHIER_AFTERNOON_ITEMS: Omit<ChecklistItem, "completedAt">[] = [
  { id: "c-a1", category: "ช่วงรับกะ (รับมอบงาน)", label: "สแกนนิ้วเข้างาน แต่งกายและติดป้ายชื่อเรียบร้อย" },
  { id: "c-a2", category: "ช่วงรับกะ (รับมอบงาน)", label: "รับมอบลิ้นชักเงินทอนจากกะเช้า และตรวจนับยอดเงินทอนให้ถูกต้องก่อนเริ่มงาน" },
  { id: "c-a3", category: "ช่วงรับกะ (รับมอบงาน)", label: "รับฟังสรุปงานจากกะเช้า (เช่น สินค้าตัวไหนจัดโปรโมชัน, สินค้ากลุ่มไข่ปลอดสารหรือเนื้อสัตว์รายการไหนที่ต้องเน้นขาย)" },
  { id: "c-a4", category: "ช่วงรับกะ (รับมอบงาน)", label: "ตรวจสอบความเรียบร้อยของถุงพลาสติกและกระดาษใบเสร็จ หากพร่องให้เติมทันที" },
  { id: "c-a5", category: "ช่วงระหว่างกะ (ให้บริการและดูแลความเรียบร้อย)", label: "ทักทายลูกค้า คิดเงิน และทอนเงินอย่างถูกต้องรวดเร็ว" },
  { id: "c-a6", category: "ช่วงระหว่างกะ (ให้บริการและดูแลความเรียบร้อย)", label: "หมั่นเช็ดทำความสะอาดสายพานหรือโต๊ะเคาน์เตอร์หลังคิดเงินเสร็จ เพื่อสุขอนามัยที่ดีของสินค้าสด" },
  { id: "c-a7", category: "ช่วงระหว่างกะ (ให้บริการและดูแลความเรียบร้อย)", label: "คัดแยกธนบัตรและเหรียญในลิ้นชักให้เป็นระเบียบ เพื่อป้องกันความผิดพลาดในช่วงเวลาที่ลูกค้าเยอะ (Peak Hours)" },
  { id: "c-a8", category: "ช่วงปิดกะและปิดร้าน (สรุปยอดและทำความสะอาด)", label: "ปิดยอดขายประจำวัน ของเครื่อง POS ตนเอง" },
  { id: "c-a9", category: "ช่วงปิดกะและปิดร้าน (สรุปยอดและทำความสะอาด)", label: "นับเงินสดทั้งหมด นำเงินรายได้ส่ง ผจก.ร้าน หรือเตรียมนำฝากตามระเบียบที่ร้านกำหนด" },
  { id: "c-a10", category: "ช่วงปิดกะและปิดร้าน (สรุปยอดและทำความสะอาด)", label: "ทำความสะอาดเคาน์เตอร์คิดเงินทั้งหมด เช็ดเครื่อง POS และอุปกรณ์ต่างๆ ด้วยน้ำยาทำความสะอาด" },
  { id: "c-a11", category: "ช่วงปิดกะและปิดร้าน (สรุปยอดและทำความสะอาด)", label: "ปิดเครื่อง POS และปิดสวิตช์อุปกรณ์ไฟฟ้าบริเวณเคาน์เตอร์" },
  { id: "c-a12", category: "ช่วงปิดกะและปิดร้าน (สรุปยอดและทำความสะอาด)", label: "ตรวจสอบความเรียบร้อยรอบสุดท้ายก่อนสแกนนิ้วเลิกงาน" },
];

// 2. พนักงานสต็อก/จัดเรียง
const STOCK_MORNING_ITEMS: Omit<ChecklistItem, "completedAt">[] = [
  { id: "s-m1", category: "ช่วงก่อนเปิดร้าน / เตรียมการขาย", label: "สแกนนิ้วเข้างาน แต่งกายรัดกุม สวมผ้ากันเปื้อน หมวกคลุมผม และถุงมือให้เรียบร้อย (เน้นสุขอนามัยเนื่องจากต้องสัมผัสเนื้อสด)" },
  { id: "s-m2", category: "ช่วงก่อนเปิดร้าน / เตรียมการขาย", label: "(หน้าที่หลัก) นำไก่สดและหมูสด ออกมาจัดเรียงใส่ถาดและนำเข้าตู้แช่แสดงสินค้าให้สวยงาม พร้อมสำหรับการขาย" },
  { id: "s-m3", category: "ช่วงก่อนเปิดร้าน / เตรียมการขาย", label: "ตรวจสอบอุณหภูมิตู้แช่เนื้อสด ตู้แช่แข็ง และตู้แช่เย็นอื่นๆ ให้อยู่ในเกณฑ์มาตรฐาน" },
  { id: "s-m4", category: "ช่วงก่อนเปิดร้าน / เตรียมการขาย", label: "จัดเรียงสินค้าอื่นๆ ให้เต็มชั้นวาง เช่น เติมสต็อกไข่ปลอดสาร และสินค้าแช่แข็งต่างๆ" },
  { id: "s-m5", category: "ช่วงก่อนเปิดร้าน / เตรียมการขาย", label: "ติดป้ายราคาและตรวจสอบความถูกต้องของป้ายโปรโมชันบริเวณตู้แช่" },
  { id: "s-m6", category: "ช่วงระหว่างกะ (ดูแลความเรียบร้อย)", label: "หมั่นตรวจสอบปริมาณหมูสดและไก่สดในตู้แช่ หากพร่องให้รีบเติมให้ดูเต็มและน่าซื้ออยู่เสมอ" },
  { id: "s-m7", category: "ช่วงระหว่างกะ (ดูแลความเรียบร้อย)", label: "ดูแลความสะอาดบริเวณพื้นที่จัดเตรียมเนื้อสัตว์และอาหารสด" },
  { id: "s-m8", category: "ช่วงระหว่างกะ (ดูแลความเรียบร้อย)", label: "คอยซับน้ำหรือเลือดที่อาจซึมออกมาจากถาดเนื้อสัตว์ในตู้โชว์ เพื่อความสะอาดสะอ้าน" },
  { id: "s-m9", category: "ช่วงระหว่างกะ (ดูแลความเรียบร้อย)", label: "เช็ดทำความสะอาดกระจกตู้แช่ไม่ให้มีคราบรอยนิ้วมือหรือฝ้าฝุ่น" },
  { id: "s-m10", category: "ช่วงส่งมอบกะ / สรุปงาน", label: "ก่อนกลับเติมของหรือเก็บของ ล้างวัสดุอุปกรณ์ที่ใช้ให้เรียบร้อยเสมอ" },
];

const STOCK_AFTERNOON_ITEMS: Omit<ChecklistItem, "completedAt">[] = [
  { id: "s-a1", category: "ช่วงรับกะ / ระหว่างการขาย", label: "สแกนนิ้วเข้างาน แต่งกายรัดกุม สวมผ้ากันเปื้อน หมวกคลุมผม และถุงมือ" },
  { id: "s-a2", category: "ช่วงรับกะ / ระหว่างการขาย", label: "รับช่วงต่อจากกะเช้า ตรวจสอบปริมาณสินค้าในตู้แช่และบนชั้นวาง หากใกล้หมดให้เติมสต็อก" },
  { id: "s-a3", category: "ช่วงรับกะ / ระหว่างการขาย", label: "ดูแลความสะอาดบริเวณตู้แช่และพื้นที่ขายอย่างต่อเนื่อง" },
  { id: "s-a4", category: "ช่วงก่อนปิดร้าน / เก็บสินค้า (หน้าที่หลัก)", label: "(หน้าที่หลัก) นำหมูสดและไก่สดที่เหลือจากการขายในถาด มาบรรจุใส่ถุงให้มิดชิด" },
  { id: "s-a5", category: "ช่วงก่อนปิดร้าน / เก็บสินค้า (หน้าที่หลัก)", label: "(หน้าที่หลัก) นำถุงเนื้อสัตว์ที่แพ็คแล้ว ไปจัดเก็บในตู้แช่เย็น/ตู้สต็อกหลังร้าน โดยควบคุมอุณหภูมิให้เหมาะสมเพื่อรักษาความสด" },
  { id: "s-a6", category: "ช่วงก่อนปิดร้าน / เก็บสินค้า (หน้าที่หลัก)", label: "(หน้าที่หลัก) นำถาดใส่เนื้อสัตว์ที่ว่างเปล่าทั้งหมดไปล้างทำความสะอาด ขัดคราบไขมัน และผึ่ง/เช็ดให้แห้งสนิท" },
  { id: "s-a7", category: "ช่วงก่อนปิดร้าน / เก็บสินค้า (หน้าที่หลัก)", label: "(หน้าที่หลัก) ทำความสะอาดภายในตู้แช่เนื้อสด เช็ดคราบน้ำ คราบเลือด และฆ่าเชื้อบริเวณชั้นวางและกระจกตู้" },
  { id: "s-a8", category: "ช่วงก่อนปิดร้าน / เก็บสินค้า (หน้าที่หลัก)", label: "ทำความสะอาดบริเวณห้องหั่น/เตรียมสินค้า ให้สะอาดตามมาตรฐานความปลอดภัยทางอาหาร" },
  { id: "s-a9", category: "ช่วงก่อนปิดร้าน / เก็บสินค้า (หน้าที่หลัก)", label: "จัดเก็บอุปกรณ์ เครื่องชั่ง และเคลียร์ขยะ/กล่องเปล่าไปทิ้งหลังร้าน" },
  { id: "s-a10", category: "ช่วงก่อนปิดร้าน / เก็บสินค้า (หน้าที่หลัก)", label: "ตรวจสอบความเรียบร้อยรอบสุดท้าย ปิดไฟตู้โชว์ (ถ้ามีระเบียบให้ปิด) ก่อนเลิกงาน" },
];

// 3. ผช.ผู้จัดการร้าน
const ASST_MANAGER_MORNING_ITEMS: Omit<ChecklistItem, "completedAt">[] = [
  { id: "am-m1", category: "ช่วงเปิดร้าน - สาย (05:30 - 10:00)", label: "ตรวจสอบการเข้างาน การแต่งกาย และความพร้อมของพนักงานแคชเชียร์และพนักงานสต็อก" },
  { id: "am-m2", category: "ช่วงเปิดร้าน - สาย (05:30 - 10:00)", label: "เดินตรวจความเรียบร้อยของพื้นที่ขาย ตู้แช่หมูอนามัย ชิ้นส่วนไก่ อาหารแช่แข็ง และจุดวางไข่ปลอดสาร" },
  { id: "am-m3", category: "ช่วงเปิดร้าน - สาย (05:30 - 10:00)", label: "ดูแลความเรียบร้อยหน้าเคาน์เตอร์แคชเชียร์ พร้อมกำชับเรื่องกฎการงดรับแบงก์ 1,000 บาทสำหรับยอดซื้อที่ต่ำกว่า 300 บาทในช่วงเช้า" },
  { id: "am-m4", category: "ช่วงเปิดร้าน - สาย (05:30 - 10:00)", label: "ตรวจนับเงินสดค่าขายสินค้าของเมื่อวานในเซฟหรือจากระบบให้ถูกต้องตรงกับรายงานสรุปยอดขาย" },
  { id: "am-m5", category: "ช่วงเปิดร้าน - สาย (05:30 - 10:00)", label: "รับเข้าสินค้า" },
  { id: "am-m6", category: "ช่วงสาย - ก่อนเที่ยง (10:00 - 12:00)", label: "เตรียมเอกสาร ใบนำฝาก (Pay-in Slip) และจัดเก็บเงินสดใส่กระเป๋าให้ปลอดภัย" },
  { id: "am-m7", category: "ช่วงสาย - ก่อนเที่ยง (10:00 - 12:00)", label: "(หน้าที่หลัก) เดินทางไปธนาคารเพื่อนำเงินค่าขายสินค้าของเมื่อวานเข้าบัญชีให้เสร็จสิ้นก่อน 12:00 น." },
  { id: "am-m8", category: "ช่วงบ่าย - ส่งกะ (12:00 - 15:00)", label: "นำสลิปหรือหลักฐานการฝากเงินเข้าธนาคารมาจัดเก็บเข้าแฟ้มเอกสารของร้านให้เรียบร้อย" },
  { id: "am-m9", category: "ช่วงบ่าย - ส่งกะ (12:00 - 15:00)", label: "สรุปสถานการณ์ช่วงเช้า ปัญหาที่พบ หรืออัปเดตงาน เพื่อส่งมอบกะ ให้ผู้จัดการกะบ่าย" },
];

const ASST_MANAGER_AFTERNOON_ITEMS: Omit<ChecklistItem, "completedAt">[] = [
  { id: "am-a1", category: "ช่วงบ่าย - ช่วยดูแลภาพรวม", label: "รับช่วงมอบงานและตรวจสอบความพร้อมของหน้าร้าน" },
  { id: "am-a2", category: "ช่วงบ่าย - ช่วยดูแลภาพรวม", label: "ช่วยตรวจตราความเรียบร้อยพื้นที่ขายและสต็อกสินค้า" },
  { id: "am-a3", category: "ช่วงบ่าย - ช่วยดูแลภาพรวม", label: "สนับสนุนงานแคชเชียร์และงานจัดเรียงสินค้าในช่วงลูกค้าหนาแน่น" },
  { id: "am-a4", category: "ช่วงบ่าย - ปิดกะ", label: "ตรวจสอบความเรียบร้อยก่อนส่งมอบงานให้ผู้จัดการร้าน" },
];

// 4. ผู้จัดการร้าน
const MANAGER_MORNING_ITEMS: Omit<ChecklistItem, "completedAt">[] = [
  { id: "mgr-m1", category: "ช่วงเช้า - ตรวจสอบความพร้อม", label: "ตรวจความพร้อมการเปิดร้านและบุคลากรทุกแผนก" },
  { id: "mgr-m2", category: "ช่วงเช้า - ตรวจสอบความพร้อม", label: "ตรวจสอบสต็อกสินค้าสดและรายการรับเข้าสินค้าประจำวัน" },
  { id: "mgr-m3", category: "ช่วงเช้า - ประสานงาน", label: "ติดตามยอดขายช่วงเช้าและประสานงานกับซัพพลายเออร์" },
];

const MANAGER_AFTERNOON_ITEMS: Omit<ChecklistItem, "completedAt">[] = [
  { id: "mgr-a1", category: "ช่วงรับกะ - ระหว่างวัน (13:00 - 17:00)", label: "รับมอบงานจาก ผช.ผู้จัดการกะเช้า และตรวจสอบหลักฐานการนำเงินเข้าธนาคาร" },
  { id: "mgr-a2", category: "ช่วงรับกะ - ระหว่างวัน (13:00 - 17:00)", label: "(หน้าที่หลัก: ดูภาพรวม) เดินตรวจตราความเรียบร้อยรอบร้าน Eater Egg Fresh Mart ทั้งในส่วนของพื้นที่ขาย สต็อกหลังร้าน และการให้บริการของพนักงาน" },
  { id: "mgr-a3", category: "ช่วงรับกะ - ระหว่างวัน (13:00 - 17:00)", label: "(หน้าที่หลัก: จัดการของเสีย) ตรวจสอบสต็อกสินค้าอาหารสด เช่น เนื้อหมูและไก่สด ที่ใกล้หมดอายุการขาย" },
  { id: "mgr-a4", category: "ช่วงรับกะ - ระหว่างวัน (13:00 - 17:00)", label: "นำเสนอแผนการจัดการของเสีย (Waste) เช่น การจัดโปรโมชั่นลดราคา (Clearance) สำหรับสินค้าสดในช่วงเย็น" },
  { id: "mgr-a5", category: "ช่วงรับกะ - ระหว่างวัน (13:00 - 17:00)", label: "(หน้าที่หลัก: ช่องทางโปรโมท) คิดคอนเทนต์หรือวางแผนทำกราฟิกโปรโมชั่น เพื่อนำไปโพสต์โปรโมทร้านผ่านช่องทาง Facebook และ TikTok ฯลฯ" },
  { id: "mgr-a6", category: "ช่วงรับกะ - ระหว่างวัน (13:00 - 17:00)", label: "รับเข้าสินค้า" },
  { id: "mgr-a7", category: "ช่วงรับกะ - ระหว่างวัน (13:00 - 17:00)", label: "สั่งซื้อสินค้าเข้ามาจำหน่ายในร้าน" },
  { id: "mgr-a8", category: "ช่วงปิดร้าน - สรุปงาน (17:00 - 21:00)", label: "ควบคุมการปิดกะแคชเชียร์ ตรวจสอบยอดเงินให้ตรงกับระบบ POS" },
  { id: "mgr-a9", category: "ช่วงปิดร้าน - สรุปงาน (17:00 - 21:00)", label: "ควบคุมดูแลพนักงานสต็อกในการเก็บเนื้อสดเข้าตู้แช่หลังร้านและล้างทำความสะอาดอุปกรณ์ให้ถูกสุขลักษณะ" },
  { id: "mgr-a10", category: "ช่วงปิดร้าน - สรุปงาน (17:00 - 21:00)", label: "(หน้าที่หลัก: สรุปยอดขาย) รวบรวมข้อมูลยอดขายจากเครื่อง POS ทั้งหมด ตรวจสอบความถูกต้องของบัญชีรายรับ-รายจ่าย" },
  { id: "mgr-a11", category: "ช่วงปิดร้าน - สรุปงาน (17:00 - 21:00)", label: "จัดทำรายงานสรุปยอดขายประจำวัน (Daily Sales Report) พร้อมทั้งแนบข้อเสนอแนะเรื่องโปรโมชั่นหรือแผนจัดการของเสีย เพื่อส่งรายงานให้ผู้บริหาร" },
];

// Fallback Checklist หากเป็นตำแหน่งอื่น
const DEFAULT_STORE_MORNING_ITEMS: Omit<ChecklistItem, "completedAt">[] = [
  { id: "def-m1", category: "ช่วงก่อนเปิดร้าน", label: "สแกนนิ้วเข้างาน แต่งกายเรียบร้อยตามมาตรฐานร้าน" },
  { id: "def-m2", category: "ช่วงก่อนเปิดร้าน", label: "ตรวจเช็กความพร้อมของพื้นที่ปฏิบัติงานและอุปกรณ์" },
  { id: "def-m3", category: "ช่วงระหว่างกะ", label: "ดูแลการให้บริการลูกค้าและรักษาความสะอาดพื้นที่ขาย" },
  { id: "def-m4", category: "ช่วงระหว่างกะ", label: "ตรวจสอบสต็อกสินค้าและเติมสินค้าที่พร่อง" },
  { id: "def-m5", category: "ช่วงส่งมอบกะ", label: "ส่งมอบงานและรายงานปัญหาที่พบให้กะถัดไปทราบ" },
];

const DEFAULT_STORE_AFTERNOON_ITEMS: Omit<ChecklistItem, "completedAt">[] = [
  { id: "def-a1", category: "ช่วงรับกะ", label: "สแกนนิ้วเข้างาน รับมอบงานและข้อมูลสำคัญจากกะเช้า" },
  { id: "def-a2", category: "ช่วงระหว่างกะ", label: "ดูแลความเรียบร้อยของหน้าร้านและให้บริการลูกค้า" },
  { id: "def-a3", category: "ช่วงปิดร้าน", label: "จัดเก็บสินค้าและทำความสะอาดอุปกรณ์ให้ถูกสุขอนามัย" },
  { id: "def-a4", category: "ช่วงปิดร้าน", label: "ตรวจสอบความปลอดภัยและปิดระบบไฟฟ้าก่อนเลิกงาน" },
];

function getChecklistTemplate(position: string | undefined, shift: ShiftType): Omit<ChecklistItem, "completedAt">[] {
  if (shift === "both") {
    const morning = getChecklistTemplate(position, "morning").map((item) => ({
      ...item,
      id: `${item.id}-both-m`,
      category: `กะเช้า • ${item.category || "หน้าที่ประจำกะ"}`,
    }));
    const afternoon = getChecklistTemplate(position, "afternoon").map((item) => ({
      ...item,
      id: `${item.id}-both-a`,
      category: `กะบ่าย • ${item.category || "หน้าที่ประจำกะ"}`,
    }));
    return [...morning, ...afternoon];
  }
  const pos = (position || "").toLowerCase();
  if (pos.includes("แคชเชียร์") || pos.includes("cashier")) {
    return shift === "morning" ? CASHIER_MORNING_ITEMS : CASHIER_AFTERNOON_ITEMS;
  }
  if (pos.includes("สต็อก") || pos.includes("จัดเรียง") || pos.includes("stock")) {
    return shift === "morning" ? STOCK_MORNING_ITEMS : STOCK_AFTERNOON_ITEMS;
  }
  if (pos.includes("ผช.") || pos.includes("ผู้ช่วย") || pos.includes("assistant")) {
    return shift === "morning" ? ASST_MANAGER_MORNING_ITEMS : ASST_MANAGER_AFTERNOON_ITEMS;
  }
  if (pos.includes("ผู้จัดการ") || pos.includes("manager")) {
    return shift === "morning" ? MANAGER_MORNING_ITEMS : MANAGER_AFTERNOON_ITEMS;
  }
  if (pos.includes("กรรมการ") || pos.includes("director") || pos.includes("executive")) {
    return shift === "morning" ? MANAGER_MORNING_ITEMS : MANAGER_AFTERNOON_ITEMS;
  }
  return shift === "morning" ? DEFAULT_STORE_MORNING_ITEMS : DEFAULT_STORE_AFTERNOON_ITEMS;
}

// ─── Position Constants ───────────────────────────────────────────────────────
const STAFF_POSITIONS = [
  "แคชเชียร์",
  "พนักงานสต็อก/จัดเรียง",
];

const MANAGEMENT_POSITIONS = [
  "ผู้ช่วยผู้จัดการร้าน",
  "ผู้จัดการร้าน",
  "กรรมการ",
];

// ─── LocalStorage Helpers ─────────────────────────────────────────────────────
const DEFAULT_POSITIONS: Position[] = [
  { id: "pos-1", name: "แคชเชียร์" },
  { id: "pos-2", name: "พนักงานสต็อก/จัดเรียง" },
  { id: "pos-3", name: "ผู้ช่วยผู้จัดการร้าน" },
  { id: "pos-4", name: "ผู้จัดการร้าน" },
  { id: "pos-5", name: "กรรมการ" },
];

function getPositions(): Position[] {
  try {
    const raw = localStorage.getItem("app_positions_v3");
    if (!raw) {
      localStorage.setItem("app_positions_v3", JSON.stringify(DEFAULT_POSITIONS));
      return DEFAULT_POSITIONS;
    }
    const current: Position[] = JSON.parse(raw);
    let updated = false;
    for (const def of DEFAULT_POSITIONS) {
      if (!current.some((p) => p.name === def.name)) {
        current.push(def);
        updated = true;
      }
    }
    if (updated) {
      localStorage.setItem("app_positions_v3", JSON.stringify(current));
    }
    return current;
  } catch {
    return DEFAULT_POSITIONS;
  }
}

function savePositions(positions: Position[]) {
  localStorage.setItem("app_positions_v3", JSON.stringify(positions));
}

function getUsers(): User[] {
  try {
    return JSON.parse(localStorage.getItem("app_users") ?? "[]");
  } catch {
    return [];
  }
}
function saveUsers(users: User[]) {
  localStorage.setItem("app_users", JSON.stringify(users));
}
function getSessions(): ShiftSession[] {
  try {
    return JSON.parse(localStorage.getItem("app_sessions") ?? "[]");
  } catch {
    return [];
  }
}
function saveSessions(sessions: ShiftSession[]) {
  localStorage.setItem("app_sessions", JSON.stringify(sessions));
}
function getNotifications(): Notification[] {
  try {
    return JSON.parse(localStorage.getItem("app_notifications") ?? "[]");
  } catch {
    return [];
  }
}
function saveNotifications(notifs: Notification[]) {
  localStorage.setItem("app_notifications", JSON.stringify(notifs));
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" });
}

// Seed default accounts for Eater Egg Fresh Mart
function ensureDefaultManager() {
  const users = getUsers();
  let updated = false;
  if (!users.find((u) => u.email === "director@factory.com")) {
    users.push({ id: uid(), name: "ท่านกรรมการบริหาร", email: "director@factory.com", password: "director123", role: "manager", position: "กรรมการ" });
    updated = true;
  }
  if (!users.find((u) => u.email === "manager@factory.com")) {
    users.push({ id: uid(), name: "ผู้จัดการร้าน", email: "manager@factory.com", password: "manager123", role: "manager", position: "ผู้จัดการร้าน" });
    updated = true;
  }
  if (!users.find((u) => u.email === "asst@factory.com")) {
    users.push({ id: uid(), name: "ผู้ช่วยผู้จัดการ", email: "asst@factory.com", password: "123", role: "manager", position: "ผู้ช่วยผู้จัดการร้าน" });
    updated = true;
  }
  if (!users.find((u) => u.email === "cashier@factory.com")) {
    users.push({ id: uid(), name: "สมศรี ใจดี", email: "cashier@factory.com", password: "123", role: "employee", position: "แคชเชียร์" });
    updated = true;
  }
  if (!users.find((u) => u.email === "stock@factory.com")) {
    users.push({ id: uid(), name: "สมชาย มั่นคง", email: "stock@factory.com", password: "123", role: "employee", position: "พนักงานสต็อก/จัดเรียง" });
    updated = true;
  }
  if (updated) {
    saveUsers(users);
  }
  getPositions();
}

// ─── Components ───────────────────────────────────────────────────────────────

function Badge({ children, color = "muted" }: { children: React.ReactNode; color?: "green" | "amber" | "blue" | "muted" | "red" }) {
  const cls = {
    green: "bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold",
    amber: "bg-amber-50 text-amber-800 border-amber-300 font-semibold",
    blue: "bg-blue-50 text-blue-800 border-blue-300 font-semibold",
    muted: "bg-slate-100 text-slate-700 border-slate-300 font-medium",
    red: "bg-red-50 text-red-800 border-red-300 font-semibold",
  }[color];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs border font-mono ${cls}`}>
      {children}
    </span>
  );
}

function getShiftBadge(shift: ShiftType) {
  if (shift === "morning") return <Badge color="amber">กะเช้า</Badge>;
  if (shift === "afternoon") return <Badge color="blue">กะบ่าย</Badge>;
  return <Badge color="green">กะควบ</Badge>;
}

function getShiftName(shift: ShiftType) {
  if (shift === "morning") return "กะเช้า";
  if (shift === "afternoon") return "กะบ่าย";
  return "กะควบ";
}

function Divider() {
  return <div className="h-px bg-slate-200 w-full" />;
}

// ─── Staff Portal (เข้าสู่ระบบพนักงานทั่วไป: URL / ) ─────────────────────────────
function StaffAuthPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");

  function handleLogin() {
    if (!form.email.trim() || !form.password.trim()) {
      setError("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }
    const users = getUsers();
    const user = users.find(
      (u) => u.email.toLowerCase() === form.email.trim().toLowerCase() && u.password === form.password
    );
    if (!user) {
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      return;
    }

    setError("");
    onLogin(user);
  }

  function handleRegister() {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    const users = getUsers();
    if (users.find((u) => u.email.toLowerCase() === form.email.trim().toLowerCase())) {
      setError("อีเมลนี้มีผู้ใช้งานแล้วในระบบ");
      return;
    }
    const newUser: User = {
      id: uid(),
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password.trim(),
      role: "employee",
      position: STAFF_POSITIONS[0],
    };
    saveUsers([...users, newUser]);
    setError("");
    onLogin(newUser);
  }

  const inp =
    "w-full bg-slate-50/60 hover:bg-slate-50 focus:bg-white border border-slate-400 focus:border-slate-900 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all";

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-[390px] bg-white border border-slate-300 rounded-2xl p-6 sm:p-8 shadow-sm">
        {/* Brand Header */}
        <header className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-slate-900 text-white mb-3 shadow-xs">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Eater Egg Fresh Mart</h1>
          <p className="text-xs text-slate-600 mt-1 font-medium">ระบบบันทึกและตรวจสอบเช็คลิสต์พนักงาน</p>
        </header>

        {/* Login / Register Tabs */}
        <div role="tablist" aria-label="ตัวเลือกการเข้าสู่ระบบ" className="flex bg-slate-100/80 p-1 rounded-xl mb-5">
          {(["login", "register"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`staff-${t}-tab`}
              aria-selected={tab === t}
              aria-controls={`staff-${t}-panel`}
              onClick={() => {
                setTab(t);
                setError("");
              }}
              className={`flex-1 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${tab === t ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
            >
              {t === "login" ? "เข้าสู่ระบบพนักงาน" : "สมัครสมาชิก"}
            </button>
          ))}
        </div>

        {/* Form Panel */}
        <div role="tabpanel" id={`staff-${tab}-panel`} aria-labelledby={`staff-${tab}-tab`} className="space-y-4">
          {tab === "register" && (
            <div>
              <label htmlFor="staff-name" className="block text-xs font-semibold text-slate-800 mb-1.5">
                ชื่อ-นามสกุล
              </label>
              <input
                id="staff-name"
                className={inp}
                placeholder="ระบุชื่อ-นามสกุล"
                autoComplete="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
          )}

          <div>
            <label htmlFor="staff-email" className="block text-xs font-semibold text-slate-800 mb-1.5">
              อีเมล
            </label>
            <input
              id="staff-email"
              className={inp}
              placeholder="name@factory.com"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="staff-password" className="block text-xs font-semibold text-slate-800 mb-1.5">
              รหัสผ่าน
            </label>
            <input
              id="staff-password"
              className={inp}
              placeholder="รหัสผ่าน"
              type="password"
              autoComplete={tab === "login" ? "current-password" : "new-password"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && (tab === "login" ? handleLogin() : handleRegister())}
            />
          </div>

          {error && (
            <div role="alert" className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 text-center font-semibold my-2">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="button"
            onClick={tab === "login" ? handleLogin : handleRegister}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-black text-white text-sm font-semibold rounded-xl shadow-xs transition-all mt-3 cursor-pointer"
          >
            {tab === "login" ? "เข้าสู่ระบบ" : "ยืนยันการสมัครสมาชิก"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin / Management Portal (สำหรับฝ่ายบริหาร เข้าผ่าน URL: /admin ) ──────────
function AdminAuthPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    position: MANAGEMENT_POSITIONS[1], // default "ผู้จัดการร้าน"
  });
  const [error, setError] = useState("");

  function handleLogin() {
    if (!form.email.trim() || !form.password.trim()) {
      setError("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }
    const users = getUsers();
    const user = users.find(
      (u) => u.email.toLowerCase() === form.email.trim().toLowerCase() && u.password === form.password
    );
    if (!user) {
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      return;
    }

    // Set executive position chosen on login and ensure role is manager
    const updatedUsers = users.map((u) =>
      u.id === user.id ? { ...u, role: "manager" as Role, position: form.position } : u
    );
    saveUsers(updatedUsers);
    const activeUser: User = { ...user, role: "manager", position: form.position };

    setError("");
    onLogin(activeUser);
  }

  function handleRegister() {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    const users = getUsers();
    if (users.find((u) => u.email.toLowerCase() === form.email.trim().toLowerCase())) {
      setError("อีเมลนี้มีผู้ใช้งานแล้วในระบบ");
      return;
    }
    const newUser: User = {
      id: uid(),
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password.trim(),
      role: "manager",
      position: form.position,
    };
    saveUsers([...users, newUser]);
    setError("");
    onLogin(newUser);
  }

  const inp =
    "w-full bg-slate-50/60 hover:bg-slate-50 focus:bg-white border border-slate-400 focus:border-indigo-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-indigo-700 focus:ring-4 focus:ring-indigo-600/10 transition-all";

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-[420px] bg-white border border-slate-300 rounded-2xl p-6 sm:p-8 shadow-sm">
        {/* Executive Header */}
        <header className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-700 text-white mb-3 shadow-xs">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2l8 4-8 4-8-4 8-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 10l8 4 8-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 16l8 4 8-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-bold mb-2 font-mono">
            <span>/admin</span>
            <span>•</span>
            <span>ฝ่ายบริหารและควบคุมสาขา</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Eater Egg Fresh Mart</h1>
          <p className="text-xs text-slate-600 mt-1 font-medium">ระบบแดชบอร์ดสำหรับผู้จัดการและคณะกรรมการ</p>
        </header>

        {/* Login / Register Tabs */}
        <div role="tablist" aria-label="ตัวเลือกการเข้าสู่ระบบฝ่ายบริหาร" className="flex bg-slate-100/80 p-1 rounded-xl mb-5">
          {(["login", "register"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`admin-${t}-tab`}
              aria-selected={tab === t}
              aria-controls={`admin-${t}-panel`}
              onClick={() => {
                setTab(t);
                setError("");
              }}
              className={`flex-1 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${tab === t ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
            >
              {t === "login" ? "เข้าสู่ระบบฝ่ายบริหาร" : "ลงทะเบียนฝ่ายบริหาร"}
            </button>
          ))}
        </div>

        {/* Form Panel */}
        <div role="tabpanel" id={`admin-${tab}-panel`} aria-labelledby={`admin-${tab}-tab`} className="space-y-4">
          {tab === "register" && (
            <div>
              <label htmlFor="admin-name" className="block text-xs font-semibold text-slate-800 mb-1.5">
                ชื่อ-นามสกุล
              </label>
              <input
                id="admin-name"
                className={inp}
                placeholder="ระบุชื่อ-นามสกุล"
                autoComplete="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
          )}

          <div>
            <label htmlFor="admin-email" className="block text-xs font-semibold text-slate-800 mb-1.5">
              อีเมลฝ่ายบริหาร
            </label>
            <input
              id="admin-email"
              className={inp}
              placeholder="manager@factory.com"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-xs font-semibold text-slate-800 mb-1.5">
              รหัสผ่าน
            </label>
            <input
              id="admin-password"
              className={inp}
              placeholder="รหัสผ่าน"
              type="password"
              autoComplete={tab === "login" ? "current-password" : "new-password"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && (tab === "login" ? handleLogin() : handleRegister())}
            />
          </div>

          {/* Position Selector for Management (3 options) */}
          <div>
            <label htmlFor="admin-position" className="block text-xs font-semibold text-slate-800 mb-1.5 flex items-center justify-between">
              <span>ตำแหน่งฝ่ายบริหาร</span>
              <span className="text-[10px] text-indigo-800 font-semibold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">3 ตำแหน่ง</span>
            </label>
            <select
              id="admin-position"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              className="w-full bg-slate-50/60 hover:bg-slate-50 focus:bg-white border border-slate-400 focus:border-indigo-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 cursor-pointer focus-visible:outline-2 focus-visible:outline-indigo-700 focus:ring-4 focus:ring-indigo-600/10 transition-all"
            >
              <option value="ผู้ช่วยผู้จัดการร้าน">ผู้ช่วยผู้จัดการร้าน</option>
              <option value="ผู้จัดการร้าน">ผู้จัดการร้าน</option>
              <option value="กรรมการ">กรรมการ</option>
            </select>
          </div>

          {error && (
            <div role="alert" className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 text-center font-semibold my-2">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="button"
            onClick={tab === "login" ? handleLogin : handleRegister}
            className="w-full py-2.5 bg-indigo-700 hover:bg-indigo-800 active:bg-indigo-900 text-white text-sm font-semibold rounded-xl shadow-xs transition-all mt-3 cursor-pointer"
          >
            {tab === "login" ? "เข้าสู่ระบบฝ่ายบริหาร" : "บันทึกข้อมูลฝ่ายบริหาร"}
          </button>
        </div>

        {/* Management Demo Accounts (Clickable Pills) */}
        {tab === "login" && (
          <div className="mt-6 pt-5 border-t border-slate-200">
            <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2.5">
              คลิกเพื่อทดสอบระบบด่วน:
            </p>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setForm({ ...form, email: "asst@factory.com", password: "123", position: "ผู้ช่วยผู้จัดการร้าน" });
                  setError("");
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-300 hover:border-slate-500 hover:bg-slate-50 transition-all group cursor-pointer text-left"
              >
                <div>
                  <span className="block text-xs font-bold text-slate-900">ผู้ช่วยผู้จัดการ</span>
                  <span className="block text-[11px] text-slate-600 font-mono font-medium">asst@factory.com</span>
                </div>
                <span className="text-[11px] text-indigo-800 font-bold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">เลือก</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setForm({ ...form, email: "manager@factory.com", password: "manager123", position: "ผู้จัดการร้าน" });
                  setError("");
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-300 hover:border-slate-500 hover:bg-slate-50 transition-all group cursor-pointer text-left"
              >
                <div>
                  <span className="block text-xs font-bold text-slate-900">ผู้จัดการร้าน</span>
                  <span className="block text-[11px] text-slate-600 font-mono font-medium">manager@factory.com</span>
                </div>
                <span className="text-[11px] text-indigo-800 font-bold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">เลือก</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setForm({ ...form, email: "director@factory.com", password: "director123", position: "กรรมการ" });
                  setError("");
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-300 hover:border-slate-500 hover:bg-slate-50 transition-all group cursor-pointer text-left"
              >
                <div>
                  <span className="block text-xs font-bold text-slate-900">ท่านกรรมการบริหาร</span>
                  <span className="block text-[11px] text-slate-600 font-mono font-medium">director@factory.com</span>
                </div>
                <span className="text-[11px] text-indigo-800 font-bold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">เลือก</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shift Select Page (Clean Minimalist Shift Cards) ──────────────────────────
function ShiftSelectPage({
  user,
  onSelect,
  onLogout,
}: {
  user: User;
  onSelect: (shift: ShiftType) => void;
  onLogout: () => void;
}) {
  const now = new Date();
  const hour = now.getHours();
  const initialShift: ShiftType = hour < 14 ? "morning" : "afternoon";

  const shifts: {
    id: ShiftType;
    title: string;
    subTitle: string;
    time: string;
    tagline: string;
    isCurrent: boolean;
  }[] = [
      {
        id: "morning",
        title: "เช้า",
        subTitle: "กะเช้า",
        time: "08:00 – 16:00",
        tagline: "เปิดร้าน รับสินค้า ตรวจนับสต็อก และบริการลูกค้าช่วงเช้า",
        isCurrent: hour >= 6 && hour < 14,
      },
      {
        id: "afternoon",
        title: "บ่าย",
        subTitle: "กะบ่าย",
        time: "16:00 – 00:00",
        tagline: "ดูแลลูกค้าหน้าร้าน เติมสต็อก สรุปยอดเงิน และปิดร้าน",
        isCurrent: hour >= 14 && hour < 22,
      },
      {
        id: "both",
        title: "ควบ",
        subTitle: "ควบสองกะ",
        time: "08:00 – 00:00",
        tagline: "ควงกะปฏิบัติงานต่อเนื่องตลอดวัน ทั้งรอบเช้าและรอบบ่าย",
        isCurrent: false,
      },
    ];

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col justify-between px-4 py-6 sm:py-10">
      {/* Clean Top Profile Bar */}
      <header className="w-full max-w-4xl mx-auto mb-6 flex items-center justify-between gap-4 p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm select-none">
            {user.name.slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold text-slate-900">{user.name}</h1>
              <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                {user.position || "พนักงาน"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Eater Egg Fresh Mart</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="text-xs text-slate-500 hover:text-red-600 transition-colors px-3 py-1.5 rounded-xl border border-slate-200 hover:border-red-200 hover:bg-red-50/40 font-semibold cursor-pointer"
        >
          ออกจากระบบ
        </button>
      </header>

      {/* Main Area: Clean Header & 3 Shift Cards */}
      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col items-center justify-center py-4">
        {/* Step Indicator & Title */}
        <div className="text-center mb-8">
          <span className="inline-block text-[11px] font-bold text-slate-500 tracking-wider uppercase bg-slate-100 border border-slate-200 px-3 py-1 rounded-full mb-3">
            ขั้นตอนที่ 1 จาก 2 • เลือกกะการทำงาน
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            เลือกกะการทำงาน
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
            เลือกช่วงเวลาที่คุณต้องการปฏิบัติงานเพื่อเข้าสู่การเลือกหน้าที่
          </p>
        </div>

        {/* 3 Shift Cards */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-5">
          {shifts.map((s) => (
            <div
              key={s.id}
              onClick={() => onSelect(s.id)}
              className="group bg-white border border-slate-200/90 hover:border-slate-400 rounded-3xl p-6 sm:p-7 shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between cursor-pointer"
            >
              <div>
                {/* Top Bar inside Card */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="w-11 h-11 rounded-2xl bg-slate-100 group-hover:bg-slate-900 group-hover:text-white text-slate-700 flex items-center justify-center transition-colors">
                    {s.id === "morning" ? (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="4" />
                        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                      </svg>
                    ) : s.id === "afternoon" ? (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                      </svg>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {s.isCurrent && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        เวลานี้
                      </span>
                    )}
                    <span className="text-xs font-semibold text-slate-500 font-mono bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-full">
                      {s.subTitle}
                    </span>
                  </div>
                </div>

                {/* Big Clean Title */}
                <div className="my-2">
                  <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                    {s.title}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 mt-1 font-mono flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>{s.time}</span>
                  </p>
                </div>

                <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                  {s.tagline}
                </p>
              </div>

              {/* Bottom Action Button */}
              <div className="mt-6 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(s.id);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 group-hover:bg-slate-800 active:bg-black text-white text-xs sm:text-sm font-semibold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>เลือกกะ{s.title}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <footer className="text-center text-[11px] text-slate-600 font-medium py-2">
        Eater Egg Fresh Mart • Checklist System
      </footer>
    </div>
  );
}

// ─── Position Select Page (Clean Minimalist Position Cards) ───────────────────
function PositionSelectPage({
  user,
  shift,
  onSelectPosition,
  onBack,
  onLogout,
}: {
  user: User;
  shift: ShiftType;
  onSelectPosition: (position: string) => void;
  onBack: () => void;
  onLogout: () => void;
}) {
  const isMorning = shift === "morning";
  const isAfternoon = shift === "afternoon";
  const shiftTitle = isMorning ? "กะเช้า" : isAfternoon ? "กะบ่าย" : "กะควบ (2 กะ)";
  const shiftHours = isMorning ? "08:00 – 16:00" : isAfternoon ? "16:00 – 00:00" : "08:00 – 00:00";

  const availablePositions = user.role === "manager" ? MANAGEMENT_POSITIONS : STAFF_POSITIONS;

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col justify-between px-4 py-6 sm:py-10">
      {/* Top Header Card */}
      <header className="w-full max-w-4xl mx-auto mb-6 flex items-center justify-between gap-4 p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 rounded-xl border border-slate-300 hover:border-slate-500 hover:bg-slate-50 flex items-center justify-center text-slate-700 transition-all cursor-pointer"
            title="ย้อนกลับไปเลือกกะ"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900">{user.name}</h1>
            <p className="text-[11px] text-slate-600 font-medium">
              กะที่เลือก: <span className="font-bold text-slate-900">{shiftTitle} ({shiftHours})</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="text-xs text-slate-600 hover:text-red-700 transition-colors px-3 py-1.5 rounded-xl border border-slate-300 hover:border-red-300 hover:bg-red-50/40 font-semibold cursor-pointer"
        >
          ออกจากระบบ
        </button>
      </header>

      {/* Main Section */}
      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col items-center justify-center py-4">
        {/* Step Indicator & Title */}
        <div className="text-center mb-8">
          <span className="inline-block text-[11px] font-bold text-slate-700 tracking-wider uppercase bg-slate-100 border border-slate-300 px-3 py-1 rounded-full mb-3">
            ขั้นตอนที่ 2 จาก 2 • เลือกตำแหน่งหน้าที่
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            เลือกตำแหน่งงาน
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-md mx-auto">
            เลือกหน้าที่ที่คุณปฏิบัติงานในกะนี้ เพื่อเริ่มต้นตรวจเช็คงาน
          </p>
        </div>

        {/* Position Cards Grid */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
          {availablePositions.map((pos) => {
            const isCashier = pos === "แคชเชียร์";
            const itemCount = getChecklistTemplate(pos, shift).length;

            return (
              <div
                key={pos}
                onClick={() => onSelectPosition(pos)}
                className="group bg-white border border-slate-300 hover:border-slate-500 rounded-3xl p-6 sm:p-7 shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 group-hover:bg-slate-900 group-hover:text-white text-slate-700 flex items-center justify-center transition-colors">
                      {isCashier ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="2" y="4" width="20" height="16" rx="2" />
                          <line x1="2" y1="10" x2="22" y2="10" />
                          <circle cx="7" cy="15" r="1" />
                          <circle cx="12" cy="15" r="1" />
                          <circle cx="17" cy="15" r="1" />
                        </svg>
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                          <line x1="12" y1="22.08" x2="12" y2="12" />
                        </svg>
                      )}
                    </div>

                    <span className="text-xs font-bold font-mono text-slate-700 bg-slate-50 border border-slate-300 px-3 py-1 rounded-full">
                      {itemCount} รายการเช็คลิสต์
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
                    {pos}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                    {isCashier
                      ? "รับผิดชอบงานจุดชำระเงิน ตรวจสอบระบบแคชเชียร์ นับเงินทอน และดูแลบริการลูกค้าหน้าร้าน"
                      : "รับผิดชอบการจัดเรียงสินค้า ตรวจนับสต็อก เติมสินค้าตู้แช่ และตรวจสอบความสดใหม่"}
                  </p>

                  <div className="space-y-2 py-3 border-t border-slate-200 text-xs text-slate-700">
                    {isCashier ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                          <span>ตรวจเงินสด ลิ้นชัก และอุปกรณ์รับชำระ</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                          <span>ดูแลความสะอาดรอบจุดเคาน์เตอร์</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                          <span>ตรวจรับสินค้าสดและเติมตู้แช่</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                          <span>ตรวจเช็คป้ายราคาและวันหมดอายุ</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Bottom Action Button */}
                <div className="mt-6 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPosition(pos);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-900 group-hover:bg-slate-800 active:bg-black text-white text-xs sm:text-sm font-semibold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>เลือกหน้าที่{pos}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-slate-600 hover:text-slate-900 font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>ต้องการเปลี่ยนกะ? กลับไปเลือกกะ</span>
          </button>
        </div>
      </div>

      <footer className="text-center text-[11px] text-slate-600 font-medium py-2">
        Eater Egg Fresh Mart • Checklist System
      </footer>
    </div>
  );
}

// ─── Checklist Page (Clean Minimalist Task List with Filter Tabs) ─────────────
function ChecklistPage({
  session,
  onUpdate,
  onEndShift,
  onOpenDashboard,
}: {
  session: ShiftSession;
  onUpdate: (s: ShiftSession) => void;
  onEndShift: () => void;
  onOpenDashboard?: () => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");
  const { dialogRef: confirmDialogRef, handleKeyDown: handleConfirmKeyDown } = useModalFocusTrap(showConfirm, () => setShowConfirm(false));

  const total = session.items.length;
  const done = session.items.filter((i) => i.completedAt).length;
  const allDone = done === total;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const filteredItems = session.items.filter((i) => {
    if (filter === "pending") return !i.completedAt;
    if (filter === "done") return !!i.completedAt;
    return true;
  });

  function toggleItem(id: string) {
    if (session.completedAt) return;
    const updated = session.items.map((item) =>
      item.id === id ? { ...item, completedAt: item.completedAt ? null : new Date().toISOString() } : item
    );
    const allComplete = updated.every((i) => i.completedAt);
    let updatedSession = { ...session, items: updated };
    if (allComplete && !session.notified) {
      const completedAt = new Date().toISOString();
      updatedSession = { ...updatedSession, completedAt, notified: true };
      const notifs = getNotifications();
      notifs.push({
        id: uid(),
        shiftSessionId: session.id,
        userName: session.userName,
        userPosition: session.userPosition,
        shift: session.shift,
        completedAt,
        read: false,
      });
      saveNotifications(notifs);
    }
    onUpdate(updatedSession);
  }

  function endShift() {
    setShowConfirm(false);
    onEndShift();
  }

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col items-center px-4 py-6 sm:py-10">
      {/* Off-screen live status update for assistive tech (SC 4.1.3) */}
      <div aria-live="polite" className="sr-only">
        ความคืบหน้างาน {done} จาก {total} รายการ ({progress}%)
      </div>

      <div className="w-full max-w-2xl space-y-4">
        {/* Header Card */}
        <header className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                {getShiftBadge(session.shift)}
                {session.userPosition && (
                  <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-300">
                    {session.userPosition}
                  </span>
                )}
                {allDone && (
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-300">
                    ครบถ้วน 100%
                  </span>
                )}
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">{session.userName}</h1>
              <p className="text-xs text-slate-600 font-mono mt-0.5">เริ่มงานเวลา {fmtTime(session.startedAt)}</p>
            </div>

            <div className="flex items-center gap-2">
              {onOpenDashboard && (
                <button
                  type="button"
                  onClick={onOpenDashboard}
                  className="text-xs px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 hover:bg-indigo-100 transition-colors font-semibold flex items-center gap-1.5 min-h-[36px] cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  แดชบอร์ด
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                className="text-xs px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:border-red-400 hover:text-red-700 hover:bg-red-50/40 transition-colors min-h-[36px] inline-flex items-center font-semibold cursor-pointer"
              >
                จบกะงาน
              </button>
            </div>
          </div>

          {/* Minimalist Progress Indicator */}
          <div className="pt-4">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-slate-800">
                ความคืบหน้า: <span className="font-mono">{done}/{total}</span> รายการ
              </span>
              <span className="font-mono font-bold text-slate-900">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-900 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </header>

        {/* Filter Tabs */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex bg-slate-200 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${filter === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
            >
              ทั้งหมด ({total})
            </button>
            <button
              type="button"
              onClick={() => setFilter("pending")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${filter === "pending" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
            >
              ที่ต้องทำ ({total - done})
            </button>
            <button
              type="button"
              onClick={() => setFilter("done")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${filter === "done" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
            >
              เสร็จแล้ว ({done})
            </button>
          </div>

          {allDone && (
            <span className="hidden sm:inline-flex text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-3 py-1 rounded-full">
              ตรวจครบทุกข้อแล้ว
            </span>
          )}
        </div>

        {/* Checklist Items */}
        <div className="space-y-2.5" role="group" aria-label="รายการตรวจสอบประจำกะ">
          {filteredItems.map((item, idx) => {
            const isDone = !!item.completedAt;
            const originalIndex = session.items.findIndex((i) => i.id === item.id);
            const prevItem = idx > 0 ? filteredItems[idx - 1] : null;
            const showCategoryHeader = item.category && (!prevItem || prevItem.category !== item.category);

            return (
              <div key={item.id} className="space-y-2">
                {showCategoryHeader && (
                  <div className="pt-3 pb-1 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500" aria-hidden="true" />
                    <h2 className="text-xs font-bold text-slate-700 tracking-wide">{item.category}</h2>
                  </div>
                )}
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isDone}
                  onClick={() => toggleItem(item.id)}
                  className={`w-full flex items-start gap-3.5 p-4 rounded-2xl border text-left transition-all duration-150 focus-visible:outline-2 focus-visible:outline-slate-900 shadow-2xs cursor-pointer ${isDone
                    ? "bg-slate-50/80 border-slate-200"
                    : "bg-white border-slate-300 hover:border-slate-500 hover:shadow-xs"
                    }`}
                >
                  <div
                    className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isDone
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-500 bg-white hover:border-slate-800"
                      }`}
                  >
                    {isDone && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-mono text-slate-600 font-semibold pt-0.5 select-none" aria-hidden="true">
                        {String(originalIndex + 1).padStart(2, "0")}
                      </span>
                      <p className={`text-sm leading-relaxed ${isDone ? "text-slate-500 line-through" : "text-slate-900 font-medium"}`}>
                        {item.label}
                      </p>
                    </div>
                    {isDone && item.completedAt && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-mono text-slate-600 pl-6 font-medium">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span>เสร็จเมื่อ {fmtTime(item.completedAt)}</span>
                      </div>
                    )}
                  </div>
                </button>
              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="p-8 text-center bg-white border border-slate-200/90 rounded-2xl">
              <p className="text-sm font-semibold text-slate-700">ไม่มีรายการในหมวดนี้</p>
              <p className="text-xs text-slate-600 mt-1 font-medium">
                {filter === "pending" ? "คุณทำครบทุกรายการแล้ว" : "ยังไม่มีรายการที่เสร็จสมบูรณ์"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center z-50 px-4"
          onClick={() => setShowConfirm(false)}
          onKeyDown={handleConfirmKeyDown}
        >
          <div
            ref={confirmDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-shift-title"
            tabIndex={-1}
            className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 w-full max-w-sm focus-visible:outline-2 focus-visible:outline-emerald-700 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-shift-title" className="text-base font-bold text-slate-900 mb-2">
              ยืนยันการจบกะงาน?
            </h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {allDone
                ? "คุณได้ทำการตรวจสอบครบถ้วนทั้ง 100% แล้ว ต้องการบันทึกและจบกะงานใช่หรือไม่?"
                : `ยังมีรายการที่ยังไม่เสร็จอีก ${total - done} รายการ คุณต้องการจบกะงานตอนนี้เลยหรือไม่?`}
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={endShift}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs cursor-pointer"
              >
                จบกะงาน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Manager Dashboard ────────────────────────────────────────────────────────
function ManagerDashboard({
  user,
  onLogout,
  activeSession,
  onStartChecklist,
  onUpdateSession,
  onEndShift,
  onOpenChecklistPage,
}: {
  user: User;
  onLogout: () => void;
  activeSession: ShiftSession | null;
  onStartChecklist: (shift: ShiftType) => void;
  onUpdateSession: (session: ShiftSession) => void;
  onEndShift: () => void;
  onOpenChecklistPage: () => void;
}) {
  const [notifications, setNotifications] = useState<Notification[]>(getNotifications);
  const [sessions, setSessions] = useState<ShiftSession[]>(getSessions);
  const [positions, setPositions] = useState<Position[]>(getPositions);
  const [usersList, setUsersList] = useState<User[]>(getUsers);
  const [newPositionName, setNewPositionName] = useState("");
  const [positionMsg, setPositionMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [staffMsg, setStaffMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [staffSearch, setStaffSearch] = useState("");
  const [staffFilter, setStaffFilter] = useState<"all" | "unassigned" | "assigned">("all");
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({ name: "", email: "", password: "", position: "" });

  // Permissions: Assistant Manager cannot assign or select positions for staff (only Store Manager and Directors can)
  const isAssistant = user.position?.includes("ผู้ช่วย") || false;
  const canManagePositions = !isAssistant;

  const [activeTab, setActiveTab] = useState<"my-checklist" | "staff" | "inbox" | "history" | "positions">(
    isAssistant ? "my-checklist" : "staff"
  );
  const [selectedSession, setSelectedSession] = useState<ShiftSession | null>(null);
  const { dialogRef: sessionDialogRef, handleKeyDown: handleSessionKeyDown } = useModalFocusTrap(!!selectedSession, () => setSelectedSession(null));
  const { dialogRef: addStaffDialogRef, handleKeyDown: handleAddStaffKeyDown } = useModalFocusTrap(showAddStaffModal, () => setShowAddStaffModal(false));

  const unread = notifications.filter((n) => !n.read).length;
  const employees = usersList.filter((u) => u.role === "employee");
  const unassignedEmployees = employees.filter((u) => !u.position);

  useEffect(() => {
    const interval = setInterval(() => {
      const latestNotifs = getNotifications();
      setNotifications((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(latestNotifs)) return latestNotifs;
        return prev;
      });
      const latestSessions = getSessions();
      setSessions((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(latestSessions)) return latestSessions;
        return prev;
      });
      const latestPositions = getPositions();
      setPositions((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(latestPositions)) return latestPositions;
        return prev;
      });
      const latestUsers = getUsers();
      setUsersList((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(latestUsers)) return latestUsers;
        return prev;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  function markRead(id: string) {
    const updated = notifications.map((n) => n.id === id ? { ...n, read: true } : n);
    saveNotifications(updated);
    setNotifications(updated);
  }

  function markAllRead() {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    saveNotifications(updated);
    setNotifications(updated);
  }

  function handleUpdateUserPosition(userId: string, newPos: string) {
    if (!canManagePositions) {
      setStaffMsg({
        text: "ผู้ช่วยผู้จัดการร้านไม่สามารถเลือกหรือเปลี่ยนตำแหน่งให้พนักงานได้ (สิทธิ์เฉพาะผู้จัดการร้านและกรรมการ)",
        type: "error",
      });
      return;
    }
    const users = getUsers();
    const updated = users.map((u) => (u.id === userId ? { ...u, position: newPos || undefined } : u));
    saveUsers(updated);
    setUsersList(updated);
    const target = users.find((u) => u.id === userId);
    setStaffMsg({
      text: `อัปเดตตำแหน่งของ "${target?.name || "พนักงาน"}" เป็น "${newPos || "ยังไม่กำหนด"}" สำเร็จ`,
      type: "success",
    });
    setTimeout(() => setStaffMsg(null), 3000);
  }

  function handleDeleteStaff(userId: string) {
    if (!canManagePositions) {
      setStaffMsg({ text: "ผู้ช่วยผู้จัดการร้านไม่มีสิทธิ์ลบบัญชีพนักงาน", type: "error" });
      return;
    }
    const users = getUsers();
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    if (target.id === user.id) {
      alert("ไม่สามารถลบบัญชีของตัวเองได้");
      return;
    }
    if (!confirm(`ยืนยันการลบบัญชีของ "${target.name}" หรือไม่?`)) return;
    const updated = users.filter((u) => u.id !== userId);
    saveUsers(updated);
    setUsersList(updated);
    setStaffMsg({ text: `ลบบัญชีพนักงาน "${target.name}" เรียบร้อยแล้ว`, type: "success" });
    setTimeout(() => setStaffMsg(null), 3000);
  }

  function handleAddStaff() {
    if (!newStaffForm.name.trim() || !newStaffForm.email.trim() || !newStaffForm.password.trim()) {
      setStaffMsg({ text: "กรุณากรอกข้อมูลพนักงานให้ครบถ้วน", type: "error" });
      return;
    }
    const users = getUsers();
    if (users.some((u) => u.email.toLowerCase() === newStaffForm.email.trim().toLowerCase())) {
      setStaffMsg({ text: "อีเมลนี้มีอยู่ในระบบแล้ว", type: "error" });
      return;
    }
    const newUser: User = {
      id: uid(),
      name: newStaffForm.name.trim(),
      email: newStaffForm.email.trim(),
      password: newStaffForm.password.trim(),
      role: "employee",
      position: canManagePositions ? (newStaffForm.position || undefined) : undefined,
    };
    const updated = [...users, newUser];
    saveUsers(updated);
    setUsersList(updated);
    setNewStaffForm({ name: "", email: "", password: "", position: "" });
    setShowAddStaffModal(false);
    setStaffMsg({ text: `เพิ่มพนักงาน "${newUser.name}" เรียบร้อยแล้ว`, type: "success" });
    setTimeout(() => setStaffMsg(null), 3000);
  }

  function handleAddPosition() {
    if (!canManagePositions) return;
    const trimmed = newPositionName.trim();
    if (!trimmed) return;
    if (positions.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setPositionMsg({ text: "มีชื่อตำแหน่งนี้อยู่แล้วในระบบ", type: "error" });
      return;
    }
    const updated = [...positions, { id: uid(), name: trimmed }];
    savePositions(updated);
    setPositions(updated);
    setNewPositionName("");
    setPositionMsg({ text: `เพิ่มตำแหน่ง "${trimmed}" เรียบร้อยแล้ว`, type: "success" });
    setTimeout(() => setPositionMsg(null), 3000);
  }

  function handleDeletePosition(posId: string) {
    if (!canManagePositions) return;
    const pos = positions.find((p) => p.id === posId);
    if (!pos) return;
    const users = getUsers();
    const assignedCount = users.filter((u) => u.position === pos.name).length;
    if (assignedCount > 0) {
      if (!confirm(`มีพนักงาน ${assignedCount} คนอยู่ในตำแหน่ง "${pos.name}" คุณแน่ใจหรือไม่ว่าต้องการลบตำแหน่งนี้?`)) {
        return;
      }
    }
    const updated = positions.filter((p) => p.id !== posId);
    savePositions(updated);
    setPositions(updated);
    setPositionMsg({ text: `ลบตำแหน่ง "${pos.name}" เรียบร้อยแล้ว`, type: "success" });
    setTimeout(() => setPositionMsg(null), 3000);
  }

  const completedSessions = sessions
    .filter((s) => s.completedAt)
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
      emp.email.toLowerCase().includes(staffSearch.toLowerCase()) ||
      (emp.position && emp.position.toLowerCase().includes(staffSearch.toLowerCase()));
    if (!matchesSearch) return false;
    if (staffFilter === "unassigned") return !emp.position;
    if (staffFilter === "assigned") return Boolean(emp.position);
    return true;
  });

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-100 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between pb-4 border-b border-slate-200 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${user.position?.includes("กรรมการ")
                  ? "bg-amber-500"
                  : user.position?.includes("ผู้ช่วย")
                    ? "bg-blue-500"
                    : "bg-emerald-500"
                  }`}
                aria-hidden="true"
              />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {user.position?.includes("กรรมการ")
                  ? "คณะกรรมการบริหาร (Executive Board)"
                  : user.position?.includes("ผู้ช่วย")
                    ? "ฝ่ายบริหารสาขา (Assistant Store Manager)"
                    : "ผู้จัดการสาขา (Store Manager)"}
              </p>
            </div>
            <div className="flex items-center gap-2.5 mt-1 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">{user.name}</h1>
              {user.position && (
                <Badge
                  color={
                    user.position.includes("กรรมการ")
                      ? "amber"
                      : user.position.includes("ผู้ช่วย")
                        ? "blue"
                        : "green"
                  }
                >
                  {user.position}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeSession ? (
              <button
                type="button"
                onClick={onOpenChecklistPage}
                className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors flex items-center gap-1.5 shadow-sm min-h-[36px]"
              >
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span>เช็คลิสต์ที่ทำอยู่ ({activeSession.items.filter((i) => i.completedAt).length}/{activeSession.items.length})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab("my-checklist")}
                className="text-xs px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold transition-colors flex items-center gap-1.5 min-h-[36px]"
              >
                <span>ทำเช็คลิสต์กะของฉัน</span>
              </button>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="text-xs text-slate-600 hover:text-red-600 transition-colors px-3.5 py-2 rounded-lg border border-slate-200 hover:border-red-300 min-h-[36px] inline-flex items-center font-medium"
            >
              ออกจากระบบ
            </button>
          </div>
        </header>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" role="region" aria-label="สถิติภาพรวม">
          {[
            { label: "พนักงานทั้งหมด", value: employees.length, color: "text-slate-900" },
            { label: "รอกำหนดตำแหน่ง", value: unassignedEmployees.length, color: unassignedEmployees.length > 0 ? "text-amber-700 font-bold" : "text-slate-600" },
            { label: "แจ้งเตือนงานเสร็จ", value: unread, color: unread > 0 ? "text-amber-700 font-bold" : "text-slate-600" },
            { label: "กะที่เสร็จวันนี้", value: completedSessions.filter((s) => s.completedAt && new Date(s.completedAt).toDateString() === new Date().toDateString()).length, color: "text-emerald-700" },
          ].map((stat) => (
            <div key={stat.label} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 sm:p-4">
              <p className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</p>
              <p className="text-[11px] font-medium text-slate-600 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label="หมวดหมู่ข้อมูลผู้จัดการ" className="flex bg-slate-100 border border-slate-200 rounded-lg p-1 flex-wrap sm:flex-nowrap gap-1">
          {(["my-checklist", "staff", "inbox", "positions", "history"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`${t}-tab`}
              aria-selected={activeTab === t}
              aria-controls={`${t}-panel`}
              onClick={() => setActiveTab(t)}
              className={`flex-1 py-2 px-2 text-xs sm:text-sm font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${activeTab === t ? "bg-white text-slate-900 shadow-sm font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
            >
              {t === "my-checklist" && (
                <>
                  <span>เช็คลิสต์กะของฉัน</span>
                  {activeSession && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                  )}
                </>
              )}
              {t === "staff" && (isAssistant ? "รายชื่อพนักงาน" : "จัดการพนักงาน & ตำแหน่ง")}
              {t === "inbox" && "กล่องแจ้งเตือน"}
              {t === "positions" && (isAssistant ? "เกณฑ์เช็คลิสต์แต่ละตำแหน่ง" : "ตำแหน่ง & เช็คลิสต์")}
              {t === "history" && "ประวัติกะ"}

              {t === "staff" && unassignedEmployees.length > 0 && canManagePositions && (
                <span
                  className="bg-amber-600 text-white text-[10px] font-bold font-mono rounded-full px-1.5 py-0.2 flex items-center justify-center"
                  aria-label={`รอกำหนดตำแหน่ง ${unassignedEmployees.length} คน`}
                >
                  {unassignedEmployees.length}
                </span>
              )}
              {t === "inbox" && unread > 0 && (
                <span
                  className="bg-amber-600 text-white text-[10px] font-bold font-mono rounded-full w-4 h-4 flex items-center justify-center"
                  aria-label={`ยังไม่อ่าน ${unread} รายการ`}
                >
                  {unread}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Panels */}
        <div role="tabpanel" id={`${activeTab}-panel`} aria-labelledby={`${activeTab}-tab`}>
          {/* MY CHECKLIST TAB (เช็คลิสต์ประจำกะของผู้ช่วยผู้จัดการ / ผู้บริหาร) */}
          {activeTab === "my-checklist" && (
            <div className="space-y-4">
              {/* Info Header */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge color={isAssistant ? "blue" : "green"}>{user.position || "ฝ่ายบริหาร"}</Badge>
                    <span className="text-xs text-emerald-950 font-bold">เช็คลิสต์การปฏิบัติงานประจำกะ</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    {isAssistant
                      ? "รายการตรวจสอบประจำกะสำหรับ ผู้ช่วยผู้จัดการร้าน (ควบคุมเงินสด, นำส่งธนาคาร, รับเข้าสินค้า และดูแลการขาย)"
                      : "รายการตรวจสอบมาตรฐานประจำกะสำหรับ ผู้จัดการสาขา"}
                  </p>
                </div>

                {activeSession && (
                  <button
                    type="button"
                    onClick={onOpenChecklistPage}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 font-semibold transition-colors flex items-center gap-1.5 shadow-2xs whitespace-nowrap"
                  >
                    <span>เปิดแบบเต็มจอ</span>
                  </button>
                )}
              </div>

              {!activeSession ? (
                /* Shift Selection for Assistant / Manager */
                <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4 shadow-2xs">
                  <div className="text-center max-w-md mx-auto mb-4">
                    <h2 className="text-base font-bold text-slate-900">เลือกกะการปฏิบัติงานเพื่อเริ่มเช็คลิสต์</h2>
                    <p className="text-xs text-slate-500 mt-1">
                      คลิกเพื่อเปิดรายการตรวจสอบงานประจำวันตามกะที่คุณรับผิดชอบ
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Morning Shift Card */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 hover:border-amber-400 hover:bg-amber-50/20 transition-all flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 text-xs font-bold font-mono">
                            กะเช้า (05:30 - 15:00)
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-600">
                            {getChecklistTemplate(user.position, "morning").length} รายการ
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 font-semibold mb-1.5">หน้าที่หลักในกะเช้า:</p>
                        <ul className="text-[11px] text-slate-600 space-y-1 list-disc list-inside">
                          {getChecklistTemplate(user.position, "morning").slice(0, 4).map((item) => (
                            <li key={item.id} className="line-clamp-1">{item.label}</li>
                          ))}
                          {getChecklistTemplate(user.position, "morning").length > 4 && (
                            <li className="text-slate-500 italic">และอีก {getChecklistTemplate(user.position, "morning").length - 4} รายการ...</li>
                          )}
                        </ul>
                      </div>
                      <button
                        type="button"
                        onClick={() => onStartChecklist("morning")}
                        className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>เริ่มทำเช็คลิสต์กะเช้า</span>
                      </button>
                    </div>

                    {/* Afternoon Shift Card */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 hover:border-blue-400 hover:bg-blue-50/20 transition-all flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-100 text-blue-900 text-xs font-bold font-mono">
                            กะบ่าย (13:00 - 21:00)
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-600">
                            {getChecklistTemplate(user.position, "afternoon").length} รายการ
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 font-semibold mb-1.5">หน้าที่หลักในกะบ่าย:</p>
                        <ul className="text-[11px] text-slate-600 space-y-1 list-disc list-inside">
                          {getChecklistTemplate(user.position, "afternoon").slice(0, 4).map((item) => (
                            <li key={item.id} className="line-clamp-1">{item.label}</li>
                          ))}
                          {getChecklistTemplate(user.position, "afternoon").length > 4 && (
                            <li className="text-slate-500 italic">และอีก {getChecklistTemplate(user.position, "afternoon").length - 4} รายการ...</li>
                          )}
                        </ul>
                      </div>
                      <button
                        type="button"
                        onClick={() => onStartChecklist("afternoon")}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>เริ่มทำเช็คลิสต์กะบ่าย</span>
                      </button>
                    </div>

                    {/* Both Shifts Card */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 hover:border-emerald-400 hover:bg-emerald-50/20 transition-all flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-900 text-xs font-bold font-mono">
                            รวบสองกะ (ทั้งวัน)
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-600">
                            {getChecklistTemplate(user.position, "both").length} รายการ
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 font-semibold mb-1.5">หน้าที่ครอบคลุมทั้งวัน:</p>
                        <ul className="text-[11px] text-slate-600 space-y-1 list-disc list-inside">
                          {getChecklistTemplate(user.position, "both").slice(0, 4).map((item) => (
                            <li key={item.id} className="line-clamp-1">{item.label}</li>
                          ))}
                          {getChecklistTemplate(user.position, "both").length > 4 && (
                            <li className="text-slate-500 italic">และอีก {getChecklistTemplate(user.position, "both").length - 4} รายการ...</li>
                          )}
                        </ul>
                      </div>
                      <button
                        type="button"
                        onClick={() => onStartChecklist("both")}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>เริ่มทำเช็คลิสต์รวบสอง</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Live In-Dashboard Checklist Runner */
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5 shadow-2xs">
                  {/* Progress header */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        {getShiftBadge(activeSession.shift)}
                        <span className="text-xs text-slate-500 font-mono">
                          เริ่ม {fmtTime(activeSession.startedAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-slate-800">
                          {activeSession.items.filter((i) => i.completedAt).length} / {activeSession.items.length} รายการ
                        </span>
                        <button
                          type="button"
                          onClick={onEndShift}
                          className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-semibold transition-colors"
                        >
                          จบกะงาน
                        </button>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                        style={{
                          width: `${(activeSession.items.filter((i) => i.completedAt).length / activeSession.items.length) * 100
                            }%`,
                        }}
                      />
                    </div>
                    {activeSession.items.every((i) => i.completedAt) && (
                      <p className="text-xs text-emerald-700 font-bold mt-1">
                        ✓ ทำเช็คลิสต์ครบ 100% แล้ว (ส่งข้อมูลเข้าระบบเรียบร้อย)
                      </p>
                    )}
                  </div>

                  {/* Checklist Item Cards */}
                  <div className="space-y-2.5">
                    {activeSession.items.map((item, idx) => {
                      const isDone = !!item.completedAt;
                      const prevItem = idx > 0 ? activeSession.items[idx - 1] : null;
                      const showCat = item.category && (!prevItem || prevItem.category !== item.category);

                      function toggleDashboardItem(id: string) {
                        if (!activeSession) return;
                        const currentSession = activeSession;
                        const updatedItems = currentSession.items.map((it) => {
                          if (it.id !== id) return it;
                          return { ...it, completedAt: it.completedAt ? null : new Date().toISOString() };
                        });
                        const updatedSession: ShiftSession = { ...currentSession, items: updatedItems };
                        if (updatedItems.every((it) => it.completedAt) && !currentSession.notified) {
                          updatedSession.notified = true;
                          const notif: Notification = {
                            id: uid(),
                            shiftSessionId: currentSession.id,
                            userName: currentSession.userName,
                            userPosition: currentSession.userPosition,
                            shift: currentSession.shift,
                            completedAt: new Date().toISOString(),
                            read: false,
                          };
                          saveNotifications([...getNotifications(), notif]);
                        }
                        onUpdateSession(updatedSession);
                      }

                      return (
                        <div key={item.id} className="space-y-1.5">
                          {showCat && (
                            <p className="text-xs font-bold text-slate-800 pt-3 pb-1 border-b border-slate-100 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-600" />
                              <span>{item.category}</span>
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleDashboardItem(item.id)}
                            className={`w-full text-left p-3.5 rounded-xl border flex items-start gap-3 transition-all ${isDone
                              ? "bg-emerald-50/70 border-emerald-300 text-slate-600"
                              : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-900"
                              }`}
                          >
                            <div
                              className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${isDone ? "border-emerald-600 bg-emerald-600" : "border-slate-400 bg-white"
                                }`}
                            >
                              {isDone && (
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2">
                                  <path d="M2 5l2.5 2.5L8 3" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2">
                                <span className="text-xs font-mono text-slate-400">{String(idx + 1).padStart(2, "0")}</span>
                                <p className={`text-xs sm:text-sm font-medium ${isDone ? "line-through text-slate-500" : "text-slate-900"}`}>
                                  {item.label}
                                </p>
                              </div>
                              {isDone && item.completedAt && (
                                <p className="text-[10px] font-mono text-emerald-700 font-semibold mt-1">
                                  เสร็จเมื่อ {fmtTime(item.completedAt)}
                                </p>
                              )}
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STAFF MANAGEMENT TAB */}
          {activeTab === "staff" && (
            <div className="space-y-4">
              {/* Permission Banner for Assistant Manager */}
              {!canManagePositions && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950">
                  <div>
                    <p className="font-bold text-amber-900">สิทธิ์ผู้ช่วยผู้จัดการร้าน (Assistant Store Manager)</p>
                    <p className="text-amber-800 mt-0.5">
                      ท่านสามารถตรวจสอบรายชื่อและสถานะของพนักงานได้ แต่<strong>ไม่สามารถเลือกหรือกำหนดตำแหน่งงานให้พนักงานได้</strong> (สิทธิ์การกำหนดตำแหน่งสงวนไว้เฉพาะผู้จัดการร้านและกรรมการ)
                    </p>
                  </div>
                </div>
              )}

              {/* Alert message */}
              {staffMsg && (
                <div role="status" className={`p-3 rounded-lg text-xs font-semibold border ${staffMsg.type === "success" ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-red-50 border-red-300 text-red-700"}`}>
                  {staffMsg.text}
                </div>
              )}

              {/* Top controls: Search, Filter, Add button */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="flex flex-1 gap-2">
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อ, อีเมล หรือตำแหน่ง..."
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-400 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder:text-slate-500 focus:border-emerald-600 focus:bg-white focus-visible:outline-2 focus-visible:outline-emerald-700 transition-colors"
                  />
                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setStaffFilter("all")}
                      className={`px-2.5 py-1.5 rounded-md font-medium transition-all ${staffFilter === "all" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-600"}`}
                    >
                      ทั้งหมด ({employees.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStaffFilter("unassigned")}
                      className={`px-2.5 py-1.5 rounded-md font-medium transition-all ${staffFilter === "unassigned" ? "bg-white text-amber-900 shadow-2xs font-bold" : "text-slate-600"}`}
                    >
                      รอกำหนด ({unassignedEmployees.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStaffFilter("assigned")}
                      className={`px-2.5 py-1.5 rounded-md font-medium transition-all ${staffFilter === "assigned" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-600"}`}
                    >
                      มีตำแหน่งแล้ว ({employees.length - unassignedEmployees.length})
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(true)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5 min-h-[36px]"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  เพิ่มพนักงานใหม่
                </button>
              </div>

              {/* Employees List */}
              {filteredEmployees.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm bg-slate-50 border border-slate-200 rounded-xl">
                  {staffSearch ? "ไม่พบพนักงานที่ตรงกับการค้นหา" : "ยังไม่มีพนักงานในระบบ"}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredEmployees.map((emp) => {
                    const empSessions = sessions.filter((s) => s.userId === emp.id);
                    const lastSession = empSessions[empSessions.length - 1];

                    return (
                      <div
                        key={emp.id}
                        className={`p-4 rounded-xl border transition-all ${!emp.position ? "bg-amber-50/40 border-amber-300" : "bg-white border-slate-200 hover:border-slate-300"
                          }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Employee Info */}
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs flex-shrink-0 mt-0.5">
                              {emp.name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-slate-900">{emp.name}</p>
                                {!emp.position && (
                                  <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded font-bold font-mono">
                                    รอกำหนดตำแหน่ง
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 font-mono">{emp.email}</p>
                              {lastSession && (
                                <p className="text-[11px] text-slate-400 mt-1">
                                  เข้ากะล่าสุด: {getShiftName(lastSession.shift)} ({fmtDate(lastSession.startedAt)})
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Position Selector & Actions */}
                          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                            <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                              <label htmlFor={`pos-select-${emp.id}`} className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                                ตำแหน่ง:
                              </label>
                              {canManagePositions ? (
                                <select
                                  id={`pos-select-${emp.id}`}
                                  value={emp.position || ""}
                                  onChange={(e) => handleUpdateUserPosition(emp.id, e.target.value)}
                                  aria-label={`เลือกตำแหน่งงานสำหรับ ${emp.name}`}
                                  className="text-xs font-medium bg-white border border-slate-400 rounded-lg px-2.5 py-1.5 text-slate-900 focus:border-emerald-600 focus-visible:outline-2 focus-visible:outline-emerald-700 cursor-pointer shadow-2xs min-w-[170px]"
                                >
                                  <option value="">-- ยังไม่กำหนดตำแหน่ง --</option>
                                  {positions.map((p) => (
                                    <option key={p.id} value={p.name}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <div className="flex items-center gap-1.5 min-w-[170px]">
                                  <span className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${emp.position ? "bg-slate-50 text-slate-800 border-slate-200" : "bg-amber-50 text-amber-800 border-amber-200 italic"}`}>
                                    {emp.position || "รอกำหนดตำแหน่ง"}
                                  </span>
                                  <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5" title="ผู้ช่วยไม่สามารถเลือกตำแหน่งให้พนักงานได้">
                                    เฉพาะผู้จัดการกำหนด
                                  </span>
                                </div>
                              )}
                            </div>

                            {canManagePositions && (
                              <button
                                type="button"
                                onClick={() => handleDeleteStaff(emp.id)}
                                aria-label={`ลบพนักงาน ${emp.name}`}
                                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors min-h-[32px] inline-flex items-center gap-1 font-medium"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                ลบ
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* INBOX TAB */}
          {activeTab === "inbox" && (
            <div>
              {notifications.length > 0 && unread > 0 && (
                <div className="flex justify-end mb-3">
                  <button type="button" onClick={markAllRead} className="text-xs px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors min-h-[32px] inline-flex items-center font-medium shadow-xs">
                    อ่านทั้งหมด
                  </button>
                </div>
              )}
              {notifications.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-slate-400" aria-hidden="true">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </div>
                  <p className="text-sm">ไม่มีการแจ้งเตือน</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {[...notifications].reverse().map((notif) => {
                    const sess = sessions.find((s) => s.id === notif.shiftSessionId);
                    return (
                      <div key={notif.id} className={`p-4 rounded-xl border transition-all ${!notif.read ? "bg-amber-50/70 border-amber-300" : "bg-slate-50/60 border-slate-200"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {!notif.read && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600" aria-hidden="true" />
                                  <span>ยังไม่อ่าน</span>
                                </span>
                              )}
                              <p className="text-sm font-bold text-slate-900">{notif.userName}</p>
                              {notif.userPosition && <Badge color="muted">{notif.userPosition}</Badge>}
                              {getShiftBadge(notif.shift)}
                            </div>
                            <p className="text-xs text-slate-600">ตรวจสอบงานครบทุกรายการแล้ว</p>
                            <p className="text-[10px] font-mono text-slate-500 mt-1">{fmtDate(notif.completedAt)} {fmtTime(notif.completedAt)}</p>
                          </div>
                          <div className="flex gap-2">
                            {sess && (
                              <button type="button" onClick={() => { setSelectedSession(sess); markRead(notif.id); }}
                                className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors min-h-[32px] inline-flex items-center font-medium shadow-xs">
                                ดูรายละเอียด
                              </button>
                            )}
                            {!notif.read && (
                              <button type="button" onClick={() => markRead(notif.id)}
                                className="text-xs px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors min-h-[32px] inline-flex items-center font-semibold">
                                อ่านแล้ว
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === "history" && (
            <div className="space-y-3">
              {completedSessions.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-sm">ยังไม่มีประวัติกะ</div>
              ) : (
                completedSessions.map((sess) => (
                  <button type="button" key={sess.id} onClick={() => setSelectedSession(sess)} className="w-full text-left p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/70 hover:border-slate-300 transition-all focus-visible:outline-2 focus-visible:outline-emerald-600 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-sm font-bold text-slate-900">{sess.userName}</p>
                          {sess.userPosition && <Badge color="muted">{sess.userPosition}</Badge>}
                          {getShiftBadge(sess.shift)}
                          <Badge color="green">{sess.items.filter((i) => i.completedAt).length}/{sess.items.length}</Badge>
                        </div>
                        <p className="text-[10px] font-mono text-slate-500">{fmtDate(sess.completedAt!)} {fmtTime(sess.startedAt)} → {fmtTime(sess.completedAt!)}</p>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-slate-400" aria-hidden="true">
                        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* POSITIONS & CHECKLIST TEMPLATE TAB */}
          {activeTab === "positions" && (
            <div className="space-y-6">
              {/* Permission Banner or Add position form */}
              {!canManagePositions ? (
                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-center gap-2">
                  <span>ผู้ช่วยผู้จัดการร้านสามารถตรวจสอบเกณฑ์เช็คลิสต์ของแต่ละตำแหน่งได้ แต่<strong>ไม่สามารถเพิ่มหรือลบตำแหน่งได้</strong> (สงวนสิทธิ์เฉพาะผู้จัดการร้านและกรรมการ)</span>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5">
                  <h2 className="text-sm font-bold text-slate-900 mb-1">เพิ่มตำแหน่งงานใหม่ในร้าน</h2>
                  <p className="text-xs text-slate-500 mb-3">เมื่อสร้างตำแหน่งแล้ว คุณสามารถมอบหมายตำแหน่งนี้ให้กับพนักงานในแท็บ "จัดการพนักงาน"</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="เช่น เจ้าหน้าที่ความปลอดภัย (จป.)"
                      value={newPositionName}
                      onChange={(e) => setNewPositionName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddPosition()}
                      className="flex-1 bg-white border border-slate-400 rounded-lg px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-emerald-600 focus-visible:outline-2 focus-visible:outline-emerald-700 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={handleAddPosition}
                      disabled={!newPositionName.trim()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5 min-h-[38px]"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                      เพิ่มตำแหน่ง
                    </button>
                  </div>
                  {positionMsg && (
                    <p role="status" className={`text-xs mt-2.5 font-semibold ${positionMsg.type === "success" ? "text-emerald-700" : "text-red-700"}`}>
                      {positionMsg.text}
                    </p>
                  )}
                </div>
              )}

              {/* Positions List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-slate-900">รายการตำแหน่งงานทั้งหมด ({positions.length})</h2>
                </div>
                {positions.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-sm bg-slate-50 border border-slate-200 rounded-xl">
                    ยังไม่มีตำแหน่งงานในระบบ
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {positions.map((pos) => {
                      const users = getUsers();
                      const count = users.filter((u) => u.position === pos.name).length;
                      const morningItems = getChecklistTemplate(pos.name, "morning").length;
                      const afternoonItems = getChecklistTemplate(pos.name, "afternoon").length;
                      return (
                        <div
                          key={pos.id}
                          className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/60 transition-colors shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 flex-shrink-0">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">{pos.name}</p>
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                                <span>พนักงาน: <strong className="text-slate-700">{count} คน</strong></span>
                                <span>•</span>
                                <span>เช็คลิสต์: กะเช้า {morningItems} / กะบ่าย {afternoonItems} ข้อ</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {canManagePositions && (
                              <button
                                type="button"
                                onClick={() => handleDeletePosition(pos.id)}
                                aria-label={`ลบตำแหน่ง ${pos.name}`}
                                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors min-h-[32px] inline-flex items-center font-medium"
                              >
                                ลบ
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAddStaffModal && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 px-4"
          onClick={() => setShowAddStaffModal(false)}
          onKeyDown={handleAddStaffKeyDown}
        >
          <div
            ref={addStaffDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-staff-modal-title"
            tabIndex={-1}
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-6 sm:p-7 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 id="add-staff-modal-title" className="text-base font-bold text-slate-900">
                เพิ่มพนักงานใหม่เข้าร้าน
              </h2>
              <button
                type="button"
                onClick={() => setShowAddStaffModal(false)}
                aria-label="ปิดหน้าต่าง"
                className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-emerald-700"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อ-นามสกุล</label>
                <input
                  type="text"
                  placeholder="เช่น สมศรี ใจดี"
                  value={newStaffForm.name}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-400 rounded-lg px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-emerald-600 focus:bg-white focus-visible:outline-2 focus-visible:outline-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">อีเมลพนักงาน</label>
                <input
                  type="email"
                  placeholder="name@factory.com"
                  value={newStaffForm.email}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-400 rounded-lg px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-emerald-600 focus:bg-white focus-visible:outline-2 focus-visible:outline-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">รหัสผ่านเริ่มต้น</label>
                <input
                  type="password"
                  placeholder="รหัสผ่านเข้าสู่ระบบ"
                  value={newStaffForm.password}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, password: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-400 rounded-lg px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-emerald-600 focus:bg-white focus-visible:outline-2 focus-visible:outline-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">กำหนดตำแหน่งงาน</label>
                {canManagePositions ? (
                  <select
                    value={newStaffForm.position}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, position: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-400 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:bg-white focus-visible:outline-2 focus-visible:outline-emerald-700 cursor-pointer"
                  >
                    <option value="">-- ยังไม่กำหนดตำแหน่ง (กำหนดภายหลังได้) --</option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-500 flex items-center justify-between">
                    <span>รอผู้จัดการกำหนดตำแหน่ง</span>
                    <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">ผู้ช่วยไม่สามารถเลือกตำแหน่งได้</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowAddStaffModal(false)}
                className="flex-1 py-2.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleAddStaff}
                className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                บันทึกพนักงาน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 px-4"
          onClick={() => setSelectedSession(null)}
          onKeyDown={handleSessionKeyDown}>
          <div ref={sessionDialogRef} role="dialog" aria-modal="true" aria-labelledby="session-detail-title" tabIndex={-1}
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl p-6 sm:p-8 focus-visible:outline-2 focus-visible:outline-emerald-700"
            onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 id="session-detail-title" className="text-base font-bold text-slate-900">{selectedSession.userName}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {selectedSession.userPosition && <Badge color="muted">{selectedSession.userPosition}</Badge>}
                    {getShiftBadge(selectedSession.shift)}
                    <span className="text-xs font-mono text-slate-500">{fmtDate(selectedSession.startedAt)}</span>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedSession(null)} aria-label="ปิดรายละเอียดกะ" className="p-2 -mr-2 text-slate-500 hover:text-slate-800 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-emerald-700">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>
              <Divider />
              <div className="mt-4 space-y-2.5">
                {selectedSession.items.map((item, idx) => {
                  const prevItem = idx > 0 ? selectedSession.items[idx - 1] : null;
                  const showCat = item.category && (!prevItem || prevItem.category !== item.category);
                  return (
                    <div key={item.id} className="space-y-1.5">
                      {showCat && (
                        <p className="text-[11px] font-bold text-slate-700 pt-2 pb-0.5">{item.category}</p>
                      )}
                      <div className={`flex items-start gap-3 p-3 rounded-lg border ${item.completedAt ? "bg-emerald-50/60 border-emerald-200" : "bg-slate-50/70 border-slate-200"}`}>
                        <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${item.completedAt ? "border-emerald-600 bg-emerald-600" : "border-slate-400 bg-white"}`}>
                          {item.completedAt && <svg width="8" height="8" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </div>
                        <div className="flex-1">
                          <div className="flex gap-2">
                            <span className="text-[10px] font-mono text-slate-500">{String(idx + 1).padStart(2, "0")}</span>
                            <p className="text-xs font-medium text-slate-900">{item.label}</p>
                          </div>
                          {item.completedAt && (
                            <p className="text-[10px] font-mono text-emerald-700 font-semibold mt-0.5">{fmtTime(item.completedAt)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to detect if current URL is /admin or #admin
function isAdminRoute(): boolean {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  return path.includes("/admin") || hash.includes("admin");
}

// ─── App Root ─────────────────────────────────────────────────────────────────
type Page = "auth" | "shift-select" | "position-select" | "checklist" | "manager";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [page, setPage] = useState<Page>("auth");
  const [selectedShift, setSelectedShift] = useState<ShiftType | null>(null);
  const [activeSession, setActiveSession] = useState<ShiftSession | null>(null);
  const [isAdminPath, setIsAdminPath] = useState<boolean>(() => isAdminRoute());

  useEffect(() => {
    ensureDefaultManager();
    document.documentElement.lang = "th";

    function checkRoute() {
      setIsAdminPath(isAdminRoute());
    }

    window.addEventListener("popstate", checkRoute);
    window.addEventListener("hashchange", checkRoute);
    return () => {
      window.removeEventListener("popstate", checkRoute);
      window.removeEventListener("hashchange", checkRoute);
    };
  }, []);

  // Keep currentUser synced with storage updates in case Manager reassigns position
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      const users = getUsers();
      const fresh = users.find((u) => u.id === currentUser.id);
      if (fresh && fresh.position !== currentUser.position) {
        setCurrentUser(fresh);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [currentUser]);

  function handleLogin(user: User, shift?: ShiftType) {
    setCurrentUser(user);
    if (user.role === "manager") {
      if (!isAdminRoute()) {
        try {
          window.history.pushState(null, "", "/admin");
        } catch {
          window.location.hash = "admin";
        }
        setIsAdminPath(true);
      }
      setPage("manager");
    } else {
      if (shift) {
        setSelectedShift(shift);
        setPage("position-select");
      } else {
        setPage("shift-select");
      }
    }
  }

  function handleShiftSelect(shift: ShiftType) {
    setSelectedShift(shift);
    setPage("position-select");
  }

  function handlePositionSelect(position: string) {
    if (!currentUser || !selectedShift) return;
    let activeUser = currentUser;
    if (position !== activeUser.position) {
      activeUser = { ...activeUser, position };
      setCurrentUser(activeUser);
      const users = getUsers().map((u) => (u.id === activeUser.id ? { ...u, position } : u));
      saveUsers(users);
    }
    const template = getChecklistTemplate(position, selectedShift);
    const session: ShiftSession = {
      id: uid(),
      userId: activeUser.id,
      userName: activeUser.name,
      userPosition: position,
      shift: selectedShift,
      startedAt: new Date().toISOString(),
      completedAt: null,
      items: template.map((i) => ({ ...i, completedAt: null })),
      notified: false,
    };
    const sessions = getSessions();
    saveSessions([...sessions, session]);
    setActiveSession(session);
    setPage(activeUser.role === "manager" ? "manager" : "checklist");
  }

  function handleBackToShiftSelect() {
    setSelectedShift(null);
    setPage("shift-select");
  }

  function handleSessionUpdate(updated: ShiftSession) {
    const sessions = getSessions().map((s) => s.id === updated.id ? updated : s);
    saveSessions(sessions);
    setActiveSession(updated);
  }

  function handleEndShift() {
    setActiveSession(null);
    setSelectedShift(null);
    setPage(currentUser?.role === "manager" ? "manager" : "shift-select");
  }

  function handleLogout() {
    const wasManager = currentUser?.role === "manager";
    setCurrentUser(null);
    setActiveSession(null);
    setSelectedShift(null);
    setPage("auth");

    if (wasManager) {
      if (!isAdminRoute()) {
        try {
          window.history.pushState(null, "", "/admin");
        } catch {
          window.location.hash = "admin";
        }
      }
      setIsAdminPath(true);
    } else {
      if (isAdminRoute()) {
        try {
          window.history.pushState(null, "", "/");
        } catch {
          window.location.hash = "";
        }
      }
      setIsAdminPath(false);
    }
  }

  return (
    <>
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-emerald-700 focus:text-white focus:font-bold focus:rounded-lg focus:shadow-lg focus-visible:outline-2 focus-visible:outline-emerald-950 focus:ring-2 focus:ring-emerald-700"
      >
        ข้ามไปยังเนื้อหาหลัก
      </a>

      {/* Semantic main landmark with white background */}
      <main id="main-content" tabIndex={-1} className="min-h-screen bg-white text-slate-900 focus-visible:outline-none">
        {page === "auth" && (
          isAdminPath ? (
            <AdminAuthPage onLogin={handleLogin} />
          ) : (
            <StaffAuthPage onLogin={handleLogin} />
          )
        )}
        {page === "shift-select" && currentUser && (
          <ShiftSelectPage user={currentUser} onSelect={handleShiftSelect} onLogout={handleLogout} />
        )}
        {page === "position-select" && currentUser && selectedShift && (
          <PositionSelectPage
            user={currentUser}
            shift={selectedShift}
            onSelectPosition={handlePositionSelect}
            onBack={handleBackToShiftSelect}
            onLogout={handleLogout}
          />
        )}
        {page === "checklist" && activeSession && (
          <ChecklistPage
            session={activeSession}
            onUpdate={handleSessionUpdate}
            onEndShift={handleEndShift}
            onOpenDashboard={currentUser?.role === "manager" ? () => setPage("manager") : undefined}
          />
        )}
        {page === "manager" && currentUser && (
          <ManagerDashboard
            user={currentUser}
            onLogout={handleLogout}
            activeSession={activeSession}
            onStartChecklist={handleShiftSelect}
            onUpdateSession={handleSessionUpdate}
            onEndShift={handleEndShift}
            onOpenChecklistPage={() => setPage("checklist")}
          />
        )}
      </main>
    </>
  );
}
