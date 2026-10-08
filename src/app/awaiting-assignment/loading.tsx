import { LoadingSpinner } from "../loading";

export default function AwaitingAssignmentLoading() {
  return (
    <LoadingSpinner
      text="กำลังโหลดข้อมูลการจัดสรรสาขา..."
      subtitle="กรุณารอสักครู่ ระบบกำลังประมวลผลข้อมูล"
    />
  );
}
