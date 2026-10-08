import { LoadingSpinner } from "../loading";

export default function AdminLoading() {
  return (
    <LoadingSpinner
      text="กำลังโหลดระบบดูแลส่วนกลาง (Admin)..."
      subtitle="กำลังเตรียมข้อมูลสิทธิ์และระบบบริหารจัดการ"
    />
  );
}
