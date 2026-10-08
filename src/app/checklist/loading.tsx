import { LoadingSpinner } from "../loading";

export default function ChecklistLoading() {
  return (
    <LoadingSpinner
      text="กำลังโหลดรายการเช็คลิสต์..."
      subtitle="กำลังเตรียมหัวข้อการตรวจงานและสถานะประจำกะ"
    />
  );
}
