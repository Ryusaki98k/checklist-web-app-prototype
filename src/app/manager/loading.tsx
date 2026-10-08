import { LoadingSpinner } from "../loading";

export default function ManagerLoading() {
  return (
    <LoadingSpinner
      text="กำลังโหลดระบบจัดการสาขา..."
      subtitle="กำลังเชื่อมต่อข้อมูลและเตรียมความพร้อมของแดชบอร์ด"
    />
  );
}
