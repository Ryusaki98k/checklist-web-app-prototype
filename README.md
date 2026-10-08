# Eater Egg Fresh Mart - Operations, Checklist & Audit Portal
> **ระบบดิจิทัลบริหารจัดการเช็คลิสต์ SOP, ควบคุมอุณหภูมิตู้แช่, Gamification และตรวจสอบมาตรฐานสาขา**

---

## 📌 ภาพรวมโครงการ (Project Overview)

**Eater Egg Fresh Mart Portal** เป็นเว็บแอปพลิเคชันระดับองค์กรที่พัฒนาขึ้นเพื่อยกระดับการปฏิบัติงานของร้านสะดวกซื้อและซูเปอร์มาร์เก็ตอาหารสด (Fresh Mart) แทนที่การจดบันทึกลงบนกระดาษแบบดั้งเดิมด้วยระบบดิจิทัลแบบเรียลไทม์ 

ระบบออกแบบมาเพื่อรองรับโครงสร้างการทำงานของธุรกิจค้าปลีกในประเทศไทยโดยเฉพาะ เช่น โครงสร้างกะการทำงาน (กะเช้า, กะบ่าย, กะควบ), การตรวจนับเงินทอน (Register Float), การส่งมอบกะงาน (Shift Handover), การตรวจเช็คอุณหภูมิห่วงโซ่ความเย็น (Cold Chain), ตลอดจนระบบลงนามอนุมัติแบบสองระดับ (ผู้ช่วยผู้จัดการร้านตรวจรับรองเบื้องต้น และผู้จัดการร้านอนุมัติขั้นสุดท้าย)

---

## 🚀 ฟังก์ชันการทำงานหลัก (Key Features)

### 1. 📋 ดิจิทัลเช็คลิสต์และการควบคุม SOP ประจำกะ (Shift Checklists & SOP)
- **แยกตามรอบกะการทำงาน**: รองรับกะเช้า (`morning`), กะบ่าย (`afternoon`) และกะควบตลอดวัน (`morning_afternoon` หรือ `both`)
- **แยกหน้าที่ตามตำแหน่งงาน**: รายการเช็คลิสต์เฉพาะสำหรับ แคชเชียร์ (Cashier), พนักงานสต็อก/จัดเรียง (Stock/Merchandiser) และผู้ช่วยผู้จัดการร้าน (Assistant Manager)
- **ตรวจจับความล่าช้าอัตโนมัติ (Automated Lateness Detection)**: ตรวจสอบเวลาที่ทำเครื่องหมายเสร็จสิ้นเทียบกับช่วงเวลาที่กำหนดของงาน (Time Window) หากเกินเวลาจะแสดงป้าย `(ล่าช้า)` สีแดง และเปิดหน้าต่างให้ระบุสาเหตุ
- **กฎเหล็กการปิดกะ 100%**: พนักงานต้องดำเนินการเช็คลิสต์ให้ครบทุกข้อก่อนส่งมอบงานปิดกะ
- **การแยกสถานะต่อผู้ใช้อย่างปลอดภัย (User-Isolated State)**: รองรับการสลับบัญชีผู้ใช้บนอุปกรณ์แท็บเล็ต/สมาร์ตโฟนส่วนกลางของสาขา ข้อมูลงานไม่ปะปนกัน

### 2. ❄️ การควบคุมอุณหภูมิตู้แช่และห่วงโซ่ความเย็น (Refrigerator & Cold Chain Control)
- บันทึกค่าอุณหภูมิตู้แช่เย็น (Chiller: มาตรฐาน 0°C – 4°C) และตู้แช่แข็ง (Freezer)
- **จำกัดค่าอุณหภูมิปลอดภัย (Input Clamping & Overflow Guard)**: กำหนดช่วงอุณหภูมิที่สามารถป้อนได้ระหว่าง -100°C ถึง 100°C ป้องกันข้อผิดพลาดจากการพิมพ์และปัญหา Integer Overflow
- แจ้งเตือนทันทีเมื่ออุณหภูมิออกนอกเกณฑ์มาตรฐาน (Out of range warning)
- **ส่งออกข้อมูลตู้แช่ (Data Export)**: รองรับการดาวน์โหลดข้อมูลบันทึกอุณหภูมิตู้แช่ของแต่ละสาขาตามวันที่ระบุออกมาเป็นไฟล์ CSV หรือ Excel ได้ทันที
- **จัดการการตั้งค่าตู้แช่ระดับสาขา (Branch Refrigerator Management)**: ผู้ดูแลระบบและผู้จัดการสามารถปรับแต่งรายการตู้แช่ เกณฑ์อุณหภูมิ และสถานะการใช้งานของตู้แช่แต่ละตู้ได้อย่างยืดหยุ่น

### 3. 🔔 ระบบแจ้งเตือนเรียลไทม์และการส่งข้อมูลแบบ Beacon (Realtime & Resilient Sync)
- เชื่อมต่อผ่าน Supabase Realtime Channels และตารางเชื่อมโยง `notification_reads`
- อัปเดตตัวเลขแจ้งเตือนที่กระดิ่งทันทีโดยไม่ต้องกดรีเฟรชหน้าจอ
- **Beacon Endpoint (`/api/checklist/batch-sync`)**: รองรับการส่ง Flush ข้อมูลเช็คลิสต์ที่ค้างอยู่ใน Buffer ก่อนการสลับหน้าหรือปิดแท็บผ่าน Navigator Beacon ป้องกันข้อมูลงานสูญหาย
- แจ้งเตือนตลอดวงจรการทำงาน: เมื่อเริ่มกะ, เมื่อทำเช็คลิสต์ครบ 100%, เมื่อส่งมอบกะ, เมื่อผู้ช่วยผู้จัดการตรวจรับรอง และเมื่อผู้จัดการอนุมัติสำเร็จ

### 4. 🎮 ระบบสร้างแรงจูงใจ (Gamification, Points & Streaks)
- **ระบบคะแนน (Points Economy)**: รับคะแนนเมื่อปิดกะตรงเวลา, ไม่ทำงานล่าช้า, หรือได้รับคะแนนพิเศษจากผู้จัดการ
- **สถิติความสม่ำเสมอ (Daily Streaks & Tier Badges)**: บันทึกวันทำงานสมบูรณ์แบบต่อเนื่อง พร้อมเหรียญเกียรติยศระดับชั้น (Bronze, Silver, Gold, Platinum, Diamond)
- **ระบบอนุมัติแบบอนุโลม (Streak Exception Approval)**: ในหน้าต่างอนุมัติกะของแดชบอร์ด มีระบบยืนยันเพื่อเลือกอนุมัติตามปกติ หรืออนุมัติแบบอนุโลม (Exception) กรณีมีเหตุจำเป็น ช่วยรักษาสถิติการทำงานต่อเนื่อง (Streak Count) ไว้ไม่ให้ถูกรีเซ็ตเป็น 0 โดยบันทึกสถานะเป็น Flawed แทน
- **ลีดเดอร์บอร์ดต้นสัปดาห์ (Weekly Kickoff Leaderboard)**: แสดงหน้าต่างสรุปอันดับผลงานของสัปดาห์ก่อนหน้าทันทีที่เข้าสู่ระบบครั้งแรกของสัปดาห์ เพื่อสร้างขวัญกำลังใจ
- **ตารางอันดับสำหรับพนักงานทั่วไป (Employee Leaderboard Modal)**: พนักงานทุกคนสามารถกดดูตารางอันดับผ่านป้ายสตรีคคะแนนของตนเอง พร้อมตัวเลือกสลับดูเฉพาะ "สาขาของฉัน (My Branch)" หรือ "ทุกสาขา (All Branches)"

### 5. 🛡️ พอร์ทัลกำกับดูแลและแยกสิทธิ์ตามบทบาท (Role Boundaries & Audit Portal)
- แบ่งระดับการเข้าถึงตามสิทธิ์อย่างเคร่งครัด (Strict Role Separation):
  - **Employee**: เข้าสู่ระบบด้วย Username/Password ปฏิบัติงานและบันทึกเช็คลิสต์ประจำกะ
  - **Assistant Manager**: ปฏิบัติงานเช็คลิสต์ตนเอง + ตรวจสอบรับรองกะพนักงานทั่วไปเบื้องต้น + บันทึกการลาพนักงาน (จำกัดไม่ให้เข้าถึงหน้าจอ Executive)
  - **Store Manager**: ตรวจสอบรายละเอียดงาน, อนุมัติขั้นสุดท้าย, ปฏิบัติงานเฉพาะกะปิดร้าน (`night` store closing SOP), ตรวจสอบสถานะการเข้ากะสด และจัดการการลา
  - **General Manager / Committee / Owner**: สิทธิ์การตรวจสอบและการกำกับดูแลโดยเฉพาะ (Audit & Governance) — ถูกตัดออกจากงานเช็คลิสต์ประจำวันและปุ่มอนุมัติกะ เพื่อรักษาความเป็นกลาง พร้อมหน้าจอเจาะลึกข้อมูลรายสาขา (`/executive/branches`)
  - **Central Admin**: จัดการข้อมูลสาขา, สิทธิ์บัญชีพนักงาน (เพิ่มผู้ใช้ใหม่/เปลี่ยนบทบาท), งานแม่แบบ, และการตั้งค่าตู้แช่
- **ประวัติการทำงานย้อนหลัง (Audit History)**: ดูประวัติย้อนหลัง 14 วันผ่านระบบแคช และสามารถเลือกค้นหาย้อนหลังวันใดก็ได้ผ่านปฏิทิน (Date Picker)
- **ล็อกเวลามาตรฐานประเทศไทย**: ผูกติดกับ Timezone `Asia/Bangkok` (UTC+7) เสมอ

### 6. ⏰ ระบบงานอัตโนมัติตามกำหนดเวลา (Vercel Cron Jobs)
- **ระบบปิดกะและแจ้งเตือนพนักงานค้างกะ/ขาดงาน (`/api/cron/end-shifts`)**: ทำงานทุกวันเวลา 23:55 น. (เวลาไทย) สแกนตรวจจับพนักงานที่เปิดกะทิ้งไว้และพนักงานที่ขาดงาน พร้อมปิดกะค้างให้อัตโนมัติ (ยกเว้นพนักงานที่ได้รับการอนุมัติการลา)
- **สร้างงานตู้แช่และตรวจจับตู้แช่ขาดตรวจ (`/api/cron/daily-refrigerators`)**: ทำงานทุกคืนเวลา 00:05 น. (เวลาไทย) สร้างงานตรวจตู้แช่รอบใหม่ประจำวัน และมาร์กตู้แช่ที่ขาดตรวจเมื่อวานเป็นสถานะไม่ผ่านพร้อมส่งแจ้งเตือน
- **รีเซ็ตและประเมินรอบคะแนนรายเดือน (`/api/cron/reset-scores`)**: ทำงานทุกวันที่ 1 ของเดือนเวลา 00:00 น. ทำการสรุปและรีเซ็ตคะแนนสะสมรอบเดือนใหม่ตามเกณฑ์ที่ผู้ดูแลระบบกำหนด
- **ทำความสะอาดข้อมูลประวัติ (`/api/cron/cleanup-data`)**: ทำงานทุกวันอาทิตย์เวลา 23:50 น. (เวลาไทย) เพื่อลบข้อมูลประวัติที่เก่ากว่า 14 วัน รักษาประสิทธิภาพและความสะอาดของฐานข้อมูล

### 7. 👥 ระบบตรวจสอบสถานะพนักงานและการเข้ากะสาขา (Staff Shift Attendance & Presence)
- **ศูนย์รวมสถานะพนักงานและการจัดการการลา (Unified Hub - `/manager/staff-status`)**: ตรวจสอบสถานะการเข้ากะสดและจัดการการลาได้ในหน้าเดียวแบบไร้รอยต่อ สลับแท็บได้ทันใจ
- **ตรวจสอบการเข้ากะสดแบบ Real-time**: ตรวจสอบว่าพนักงานคนใดกำลังเข้ากะ (`On Duty`), ออกกะ (`Off Duty`), หรือลางาน (`On Leave`)
- **ข้อมูลกะงานที่กำลังทำ**: แสดงรอบกะ, หน้าที่ประจำกะ, เวลาเริ่มกะ, ระยะเวลาที่ทำมาแล้ว และความคืบหน้าการเช็คลิสต์งาน
- **สถิติจำนวนกะที่ปฏิบัติงาน**: บันทึกจำนวนกะที่เข้าทำในวันนี้และยอดรวมจำนวนกะสะสมทั้งหมดที่เคยปฏิบัติงานมา

### 8. 🌐 การเปลี่ยนผ่านหน้าจอและระบบป้องกัน Race Condition (Global UI Transitions & Locks)
- **Global Loading Overlay**: หน้าต่างโหลดระหว่างการเปลี่ยนหน้า (`/loading`, `GlobalLoadingOverlay`) แจ้งเตือนสถานะการประมวลผลขณะสลับบทบาทหรือเปลี่ยนเส้นทาง
- **Global Button Disabler**: ปิดการทำงานของปุ่มกดทั้งหมดโดยอัตโนมัติขณะที่การทำงานเบื้องหลังยังไม่เสร็จสิ้น ป้องกันปัญหาการกดซ้ำ (Double Submits) และ Race Conditions
- **Resilient Polling for Shift Approval**: ระบบอัปเดตสถานะการอนุมัติกะแบบ Interval Polling ช่วยให้ปุ่มอนุมัติอัปเดตสถานะทันทีตามฐานข้อมูลจริงโดยไม่เกิดปัญหาปุ่มกระพริบหรือคืนค่าก่อนเวลา
- **Adaptive Responsive Header**: ปรับแต่งแถบนำทางส่วนบน (Top Navigation Bar) ให้ยืดหยุ่น ยุบปุ่ม Logout เป็นไอคอนและซ่อน Badge ที่ไม่จำเป็นบนหน้าจอขนาดเล็ก ป้องกันการแสดงผลล้นขอบจอ

### 9. 📖 ศูนย์รวมเอกสารและคู่มือปฏิบัติงานในระบบ (Integrated Documentation Portal)
- เข้าถึงคู่มือ `GUIDE.md` และ `README.md` ได้ทันทีผ่านการ์ดบนหน้า Portal Page หรือหน้าเว็บเฉพาะ `/guide` และ `/readme`
- หน้าต่าง Interactive Reader Modal รองรับการกระโดดตามบทบาทพนักงาน, สารบัญนำทาง, ค้นหาแบบเรียลไทม์ และธีม Dark/Light Mode

### 10. 📋 ระบบบันทึกการลาพนักงานและการพิจารณาสตรีค (Employee Leave Management & Streak Decisions)
- บันทึกการลาโดยผู้ช่วยผู้จัดการและผู้จัดการร้าน (`/manager/leaves` หรือแท็บ "จัดการการลา")
- ประเภทการลา 3 แบบ: ลาป่วย (`sick`), ลากิจ (`personal`), และอื่นๆ (`other`) ที่บังคับระบุเหตุผล
- ดุลยพินิจผู้บริหารในการรักษาสตรีค (`Streak Protected`) หรือตัดสตรีค (`Break Streak`) พร้อมระบบกู้คืนสตรีคอัตโนมัติหากยกเลิกรายการลา

---

## 🛠 เทคโนโลยีที่ใช้งาน (Tech Stack)

| ส่วนประกอบ | เทคโนโลยีที่เลือกใช้ | รายละเอียด |
| :--- | :--- | :--- |
| **Framework** | [Next.js](https://nextjs.org/) (v16.3.8 App Router) | สถาปัตยกรรม Server Components, Server Actions และ Turbopack |
| **Language** | TypeScript (v5) | ปลอดภัยด้าน Type ตลอดทั้งแอปพลิเคชัน |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) (v4) | CSS ตัวแปรสี Brand Token ระบบสีอบอุ่น พร้อมรองรับ Dark/Light Mode |
| **Database** | PostgreSQL (Supabase) | โครงสร้างความสัมพันธ์แบบ Normalization (`branch_tasks`, `notification_reads`) รองรับ Transaction Pooler, RLS, และ Realtime |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team/) (v1.0.0-rc.4) | Type-safe ORM พร้อม Drizzle Kit สำหรับจัดการ Schema Migrations |
| **Auth & Client** | Supabase SSR (Username/Password) | ยืนยันตัวตนด้วยชื่อผู้ใช้และรหัสผ่าน จัดการ Session Cookie ปลอดภัย |
| **Architecture** | Dependency Injection (DI) Service Container | รวม Business Logic ไว้ที่ `src/services/` เพื่อความสะดวกในการทดสอบและบำรุงรักษา |
| **Background Cron**| Vercel Cron Jobs | ทำงานเบื้องหลังผ่าน Serverless Route Handlers (4 Endpoints) |

---

## 📁 โครงสร้างโปรเจกต์ (Project Architecture)

```text
checklist-web-app/
├── drizzle/                    # ไฟล์ SQL Migrations ที่สร้างโดย Drizzle Kit
├── public/                     # Static assets (ไอคอน, รูปภาพโลโก้)
├── src/
│   ├── actions/                # Next.js Server Actions (เรียกใช้ Services)
│   │   ├── auth.ts             # จัดการยืนยันตัวตน (Username/Password), ดึงรายชื่อผู้ใช้
│   │   ├── branch.ts           # จัดการสาขา, มอบหมายพนักงานและงานผ่าน junction tables
│   │   ├── checklist.ts        # จัดการ Shift Session, บันทึกการติ๊กงาน, รีเซ็ตข้อมูล
│   │   ├── manager.ts          # ดึงข้อมูลรอบกะรออนุมัติ, ตรวจสอบประวัติย้อนหลัง, ตรวจสอบการเข้ากะพนักงาน
│   │   ├── notifications.ts    # ส่ง/อ่านการแจ้งเตือน
│   │   ├── points.ts           # บันทึกคะแนนและธุรกรรมแต้ม
│   │   ├── refrigerator.ts     # บันทึกอุณหภูมิตู้แช่ (จำกัด -100°C ถึง 100°C), ส่งออก CSV/Excel, ตั้งค่าตู้แช่
│   │   └── task.ts             # จัดการแม่แบบงาน (Master Tasks)
│   ├── app/                    # Next.js App Router (เส้นทางและหน้าจอ)
│   │   ├── (auth)/login/       # หน้าเข้าสู่ระบบและเลือกช่องทาง (Username/Password)
│   │   │   ├── employee/       # เข้าสู่ระบบพนักงานสาขา (Floor Staff)
│   │   │   ├── manager/        # เข้าสู่ระบบผู้จัดการและผู้ช่วยผู้จัดการร้าน (Store Management)
│   │   │   └── executive/      # เข้าสู่ระบบฝ่ายบริหารและกรรมการ (Executive & GM)
│   │   ├── admin/              # หน้าจอ Central Admin (จัดการผู้ใช้, สาขา, งาน, ตู้แช่)
│   │   ├── api/
│   │   │   ├── checklist/
│   │   │   │   └── batch-sync/ # Beacon/Keepalive Endpoint บันทึก Buffer ก่อนปิดหน้า
│   │   │   ├── cron/           # Vercel Cron Job Endpoints
│   │   │   │   ├── cleanup-data/       # ลบข้อมูลเก่าเกิน 14 วัน
│   │   │   │   ├── daily-refrigerators/# ตรวจสอบตู้แช่และแจ้งเตือนตู้แช่ขาดตรวจประจำวัน
│   │   │   │   ├── end-shifts/         # ปิดกะค้างและแจ้งเตือนคนค้างกะ/ขาดงานแบบครบวงจร
│   │   │   │   └── reset-scores/       # สรุปและรีเซ็ตคะแนนรอบเดือนใหม่ทุกวันที่ 1
│   │   │   └── manager/
│   │   │       └── approve-session/    # Endpoint สำหรับอนุมัติกะ
│   │   ├── awaiting-assignment/# หน้ารอการจัดสรรสาขา
│   │   ├── checklist/          # หน้าหลักพนักงานตรวจเช็คลิสต์
│   │   ├── executive/          # พอร์ทัลฝ่ายบริหารและการกำกับดูแล
│   │   │   └── branches/       # หน้าจอตรวจสอบสรุปผลการดำเนินงานรายสาขา
│   │   ├── guide/              # หน้าเว็บอ่านคู่มือ GUIDE.md แบบเต็มจอ
│   │   ├── loading/            # หน้าแสดงสถานะการโหลดกลางของระบบ
│   │   ├── manager/            # เส้นทางสำหรับผู้บริหารและผู้จัดการ
│   │   │   ├── dashboard/      # หน้าจอแดชบอร์ดผู้จัดการ/กรรมการ
│   │   │   ├── leaves/         # หน้าจอระบบบันทึกและจัดการการลาพนักงานสาขา
│   │   │   └── staff-status/   # หน้าจอตรวจสอบสถานะการเข้ากะสดของพนักงานในสาขา
│   │   ├── position/           # หน้าเลือกตำแหน่งก่อนเริ่มงาน (Header แบบยืดหยุ่น)
│   │   ├── readme/             # หน้าเว็บอ่านเอกสาร README.md แบบเต็มจอ
│   │   ├── shift/              # หน้าเลือกรอบกะการทำงาน (Header แบบยืดหยุ่น)
│   │   ├── globals.css         # กำหนดตัวแปร Theme, สี Brand และ Utility
│   │   ├── layout.tsx          # Root Layout ครอบ Loading/AppContext และ GlobalLoadingOverlay
│   │   ├── proxy.ts            # Next.js Proxy Architecture (Supabase Session Refresh)
│   │   └── page.tsx            # Portal Page ประตูหลักพร้อมปุ่มเปิดอ่านคู่มือและเช็คระบบ
│   ├── components/             # React UI Components
│   │   ├── admin/              # Dashboard แอดมิน, จัดการสาขา, งาน, สิทธิ์, จัดการตู้แช่
│   │   ├── auth/               # กล่องฟอร์มล็อกอิน
│   │   ├── common/             # Reusable UI: GlobalButtonDisabler, GlobalLoadingOverlay, PageTransitionWatcher, BrandLogo, PointStreakBadge, RoleSwitcher
│   │   ├── manager/            # Dashboard ผู้บริหาร, ตรวจสอบสถานะเข้ากะ, จัดการการลา, คิวอนุมัติกะ
│   │   └── staff/              # หน้าบันทึกเช็คลิสต์, บันทึกตู้เย็น, เลือกตำแหน่ง, เลือกกะ
│   ├── context/                # Client State Management (AppContext, LoadingContext)
│   ├── data/                   # Fallback data, Storage helpers
│   ├── db/                     # Database Schema & Client
│   │   ├── index.ts            # การเชื่อมต่อ Drizzle กับ PostgreSQL Pooler
│   │   ├── schema.ts           # นิยามตารางฐานข้อมูล, Junction Tables (branch_tasks, notification_reads), Enums
│   │   ├── supabase/proxy.ts   # Supabase Server Client & Cookie Handling สำหรับ Proxy
│   │   └── supabase.ts         # Supabase Client สำหรับฝั่งเซิร์ฟเวอร์และไคลเอนต์
│   ├── services/               # Core Business Logic Layer (Clean Architecture)
│   │   ├── AuthService.ts      # ตรวจสอบชื่อผู้ใช้และรหัสผ่าน
│   │   ├── BranchService.ts    # จัดการสาขาและงานผ่าน junction table
│   │   ├── ChecklistService.ts
│   │   ├── ManagerService.ts   # ดึงคิวอนุมัติ, บันทึกผล, จัดการการลาพนักงาน, ดึงสถานะเข้ากะ
│   │   ├── NotificationService.ts # บันทึกการอ่านผ่าน junction table
│   │   ├── PointService.ts     # คำนวณแต้ม, สตรีค, ลีดเดอร์บอร์ด, รีเซ็ตคะแนนรอบเดือน
│   │   ├── RefrigeratorService.ts # ตรวจจับขอบเขตอุณหภูมิ, ส่งออก CSV/Excel, จัดการตู้แช่
│   │   ├── container.ts        # Service Container (Dependency Injection)
│   │   └── types.ts            # Service Interfaces & BranchEmployeeStatus
│   ├── types/                  # Unified TypeScript Interfaces
│   └── utils/                  # ยูทิลิตี้ (Cache, เข้ารหัส LocalStorage, ฟอร์แมตเวลา, ตัวแปลง Markdown ปลอดภัย)
├── tools/                      # เครื่องมือจัดการและสคริปต์ฐานข้อมูล
│   ├── migration_add_employee_leaves.sql # สคริปต์ SQL Migration สำหรับระบบการลาพนักงาน
│   └── validate_all_sql.ts     # ชุดทดสอบตรวจสอบความถูกต้องของคำสั่ง SQL และ Schema (148 tests)
├── CHANGELOGS.md               # สรุปประวัติการอัปเดตและบันทึกการเปลี่ยนแปลงทั้งหมด
├── GUIDE.md                    # คู่มือ SOP การปฏิบัติงานตามบทบาท (Staff to Owner)
├── README.md                   # เอกสารข้อมูลระบบและคู่มือสถาปัตยกรรมทางเทคนิค
├── drizzle.config.ts           # การตั้งค่า Drizzle Kit
├── next.config.ts              # การตั้งค่า Next.js
├── package.json                # รายการ Dependencies และ Scripts
├── tsconfig.json               # การตั้งค่า TypeScript
└── vercel.json                 # กำหนดค่า Vercel Cron Jobs (4 งานอัตโนมัติ)
```

---

## ⚙️ ข้อกำหนดและการติดตั้ง (Getting Started)

### 1. ข้อกำหนดขั้นต่ำของระบบ (Prerequisites)
- **Node.js**: เวอร์ชัน 20.x ขึ้นไป (แนะนำ LTS)
- **Package Manager**: `npm` เวอร์ชัน 10.x ขึ้นไป
- **ฐานข้อมูล PostgreSQL**: บริการบน [Supabase](https://supabase.com) พร้อมเปิดใช้งาน Transaction Pooler (Port 6543)

### 2. การตั้งค่าตัวแปรสภาพแวดล้อม (Environment Variables)
สร้างไฟล์ `.env` ที่โฟลเดอร์ราก (Root Directory) ของโปรเจกต์:

```env
# 1. การเชื่อมต่อฐานข้อมูล PostgreSQL ผ่าน Supabase Transaction Pooler (สำหรับ Drizzle ORM)
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require

# 2. Supabase API Configuration (สำหรับ Client & Realtime)
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=[YOUR-ANON-PUBLIC-KEY]

# 3. ความปลอดภัยสำหรับ Cron Jobs (Vercel Cron Secret)
CRON_SECRET=your_super_secret_cron_token_here
```

### 3. การติดตั้ง Dependencies
```bash
npm install
```

### 4. การรันในโหมดพัฒนา (Development Mode)
```bash
npm run dev
```
เปิดเบราว์เซอร์ไปที่ [http://localhost:3000](http://localhost:3000)

### 5. การตรวจสอบความถูกต้องของโค้ด (Linting & Type Check)
```bash
# ตรวจสอบ TypeScript Type Safety
npx tsc --noEmit

# ตรวจสอบ Lint ตามมาตรฐาน ESLint
npm run lint
```

### 6. การ Build สำหรับ Production
```bash
npm run build
npm run start
```

---

## 🛠️ คู่มือการบำรุงรักษาและดูแลระบบ (Maintenance Guide)

### 1. การแก้ไขและการอัปเดตโครงสร้างฐานข้อมูล (Database Migrations)
โครงการใช้ **Drizzle ORM** ในการควบคุมโครงสร้างฐานข้อมูล ทุกครั้งที่มีการเปลี่ยนแปลงฟิลด์หรือตาราง:

1. **แก้ไขไฟล์ Schema**: เข้าไปแก้ไขที่ `src/db/schema.ts`
2. **สร้าง Migration File (ทางเลือกที่ 1)**:
   ```bash
   npx drizzle-kit generate
   ```
   ระบบจะสร้างไฟล์ SQL ใหม่อยู่ในโฟลเดอร์ `drizzle/`
3. **พุชการเปลี่ยนแปลงขึ้นฐานข้อมูล Supabase โดยตรง (ทางเลือกที่ 2 - แนะนำสำหรับ Dev/Staging)**:
   ```bash
   npx drizzle-kit push
   ```
4. **เปิดดูตารางฐานข้อมูลผ่านเว็บ (Drizzle Studio)**:
   ```bash
   npx drizzle-kit studio
   ```

> [!WARNING]
> ห้ามแก้ไขไฟล์ SQL ใน `drizzle/` โดยตรงโดยไม่ผ่านการ Generate เพื่อป้องกันปัญหา Migration Drift

---

### 2. การดูแลรักษาระบบงานอัตโนมัติ (Vercel Cron Jobs)
ไฟล์ตั้งค่าอยู่ที่ `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/end-shifts",
      "schedule": "55 16 * * *"
    },
    {
      "path": "/api/cron/cleanup-data",
      "schedule": "50 16 * * 0"
    },
    {
      "path": "/api/cron/daily-refrigerators",
      "schedule": "5 17 * * *"
    },
    {
      "path": "/api/cron/reset-scores",
      "schedule": "0 0 1 * *"
    }
  ]
}
```

#### การแปลงเวลา Timezone สำหรับ Cron
Vercel Cron ทำงานบนมาตรฐานเวลา **UTC (Coordinated Universal Time)** ในขณะที่ประเทศไทยคือ **UTC+7 (Asia/Bangkok)**:
- **Auto End Shifts (`55 16 * * *`)**:
  - เวลา UTC: 16:55 น.
  - เวลาไทย: $16:55 + 7:00 = 23:55$ น. (ห้าทุ่มห้าสิบห้านาทีของทุกคืน)
  - หน้าที่: ตรวจหากะงานประจำวันที่ยังเปิดค้างอยู่ และทำการบันทึกปิดกะให้อัตโนมัติ ป้องกันข้อมูลค้างข้ามวัน
- **Cleanup Old Data (`50 16 * * 0`)**:
  - เวลา UTC: 16:50 น. วันอาทิตย์ (0)
  - เวลาไทย: $16:50 + 7:00 = 23:50$ น. วันอาทิตย์
  - หน้าที่: ลบข้อมูลประวัติงานที่อายุเกิน 14 วัน เพื่อรักษาขนาดฐานข้อมูล
- **Daily Refrigerator Tasks & Verification (`5 17 * * *`)**:
  - เวลา UTC: 17:05 น. (ทุกคืน)
  - เวลาไทย: $17:05 + 7:00 = 00:05$ น. (เที่ยงคืนห้านาทีของวันใหม่)
  - หน้าที่:
    1. ตรวจสอบตู้แช่ที่ขาดการตรวจเช็คเมื่อวาน และทำเครื่องหมายสถานะไม่ผ่าน (`is_okay: false`, ระบุสาเหตุขาดการบันทึก)
    2. ส่งการแจ้งเตือน Realtime ไปยังผู้จัดการสาขา (`manager`), ผู้ช่วยผู้จัดการ (`manager_assistant`) และผู้จัดการทั่วไป (`general_manager`)
    3. สร้างและเตรียมรายการตรวจเช็คตู้แช่ประจำวันรอบใหม่สำหรับวันนี้ทุกสาขาอัตโนมัติ
- **Monthly Score Reset & Tier Maintenance (`0 0 1 * *`)**:
  - เวลา UTC: 00:00 น. วันที่ 1 ของทุกเดือน
  - เวลาไทย: $00:00 + 7:00 = 07:00$ น. วันที่ 1 ของทุกเดือน
  - หน้าที่: สรุปและประเมินผลคะแนนประจำเดือน บันทึกประวัติ และรีเซ็ตคะแนนรอบใหม่สำหรับพนักงานทุกคนตามข้อกำหนด

#### การทดสอบเรียก Cron Endpoint ด้วยตนเอง
หากต้องการทดสอบการทำงานของ Cron แบบ Manual:
```bash
curl -X GET "https://your-domain.vercel.app/api/cron/end-shifts" \
  -H "Authorization: Bearer your_super_secret_cron_token_here"
```

---

### 3. การจัดการระบบแคชและความปลอดภัยของข้อมูลในเครื่อง (Cache & Client Storage)
- **การเข้ารหัสข้อมูลในเบราว์เซอร์**: ข้อมูล Session, รหัสสาขา และสถานะกะที่เก็บใน `localStorage` จะถูกเข้ารหัสผ่าน `src/utils/crypto.ts` เพื่อป้องกันการเปิดดูข้อมูลโดยตรง
- **การล้างแคชสาขา**: เมื่อผู้ดูแลระบบเพิ่มสาขาใหม่หรือมอบหมายพนักงานใหม่ ระบบจะเรียก `invalidateBranchCache()` ใน `src/utils/cache.ts` เพื่อดึงข้อมูลใหม่จากฐานข้อมูลทันที
- **ปุ่มรีเฟรชข้อมูลใน Navbar**: ในหน้าจอผู้จัดการและแอดมิน มีปุ่มรีเฟรชสองระดับ:
  - **Quick Refresh**: โหลดข้อมูลจากหน่วยความจำแคช
  - **Force DB Refresh**: บังคับดึงข้อมูลสดตรงจาก Supabase ทันที

---

### 4. การจัดการกรณีเกิดปัญหาและการแก้ไขเบื้องต้น (Troubleshooting)

| อาการที่พบ | สาเหตุที่เป็นไปได้ | แนวทางแก้ไข |
| :--- | :--- | :--- |
| **ตัวเลขแจ้งเตือนกระดิ่งไม่อัปเดตแบบ Realtime** | การเชื่อมต่อ Supabase Realtime หลุด หรือยังไม่ได้เปิด Realtime บนตาราง `notifications` | 1. ตรวจสอบใน Supabase Dashboard -> Database -> Replication ว่าเปิดการส่งต่อข้อมูลตาราง `notifications` แล้วหรือไม่<br>2. ตรวจสอบ `NEXT_PUBLIC_SUPABASE_URL` และ Key ใน `.env` |
| **บันทึกงานแล้วเวลาไม่ตรงกับเวลาจริง** | เซิร์ฟเวอร์อ่านค่าเวลาเป็น UTC โดยไม่ได้แปลงเป็นเวลาไทย | ฟังก์ชันใน `src/utils/` ได้รับการตั้งค่าให้อ้างอิงเวลา `Asia/Bangkok` ตรวจสอบว่าไม่มีการแปลง Date ไปเป็นสตริงแบบไม่ระบุ Timezone |
| **พนักงานล็อกอินแล้วไม่เห็นรายการงาน** | ยังไม่มีการมอบหมายงาน (Assign Tasks) ให้กับสาขานั้น | ให้ Central Admin เข้าไปที่ `/admin` -> แท็บ "สาขา" -> เลือกสาขาที่ต้องการ -> กด "จัดการงานที่ต้องทำ" แล้วเลือกรายการงานที่ต้องการให้สาขาทำ |
| **พนักงานสลับเครื่องแล้วข้อมูลงานเก่าค้าง** | แคชในเบราว์เซอร์ไม่ถูกลบเมื่อออกจากระบบ | กดปุ่ม "ออกจากระบบ" (Logout) ทุกครั้ง ระบบจะล้างกุญแจ `shift_session` และแคชส่วนบุคคลออกทันที |

---

## 📄 เอกสารคู่มือและการเปลี่ยนแปลงของระบบ (Documentation & Changelogs)

- 👉 **[อ่านคู่มือการใช้งานฉบับสมบูรณ์ (GUIDE.md)](./GUIDE.md)**: ขั้นตอนการปฏิบัติงาน กฎเหล็ก และแนวทางสำหรับแต่ละตำแหน่งงานตั้งแต่พนักงานจนถึงเจ้าของกิจการ
- 👉 **[ดูบันทึกประวัติการเปลี่ยนแปลง (CHANGELOGS.md)](./CHANGELOGS.md)**: รายละเอียดการอัปเดต ฟีเจอร์ใหม่ การปรับปรุงโค้ด และประวัติคอมมิตทั้งหมดตั้งแต่จุดเริ่มต้นการพัฒนา
