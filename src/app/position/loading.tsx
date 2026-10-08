import { LoadingSpinner } from "../loading";

export default function PositionLoading() {
  return (
    <LoadingSpinner
      text="กำลังโหลดหน้าเลือกตำแหน่งงาน..."
      subtitle="กรุณารอสักครู่ ระบบกำลังประมวลผลข้อมูล"
    />
  );
}
