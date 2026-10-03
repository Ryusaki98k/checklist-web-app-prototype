import { RefrigeratorTaskItem } from "../services/types";

function escapeXML(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeCSV(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export function getAssessmentText(t: RefrigeratorTaskItem): { text: string; status: "normal" | "danger" | "warning" | "disabled" } {
  if (t.disableCheck) {
    return { text: "ปิดใช้งานตู้ชั่วคราว", status: "disabled" };
  }
  if (!t.completed) {
    return { text: "รอดำเนินการ (ยังไม่ตรวจ)", status: "warning" };
  }
  if (t.temperature !== null && t.temperature !== undefined && t.temperature > t.maxTemperature) {
    return { text: `อุณหภูมิสูงเกินเกณฑ์ (${t.temperature}°C > ${t.maxTemperature}°C)`, status: "danger" };
  }
  if (
    t.temperature !== null &&
    t.temperature !== undefined &&
    t.minTemperature !== undefined &&
    t.temperature < t.minTemperature
  ) {
    return { text: `อุณหภูมิต่ำกว่าเกณฑ์ (${t.temperature}°C < ${t.minTemperature}°C)`, status: "danger" };
  }
  if (!t.isOkay) {
    return { text: "พบปัญหา/ชำรุด", status: "danger" };
  }
  return { text: "ปกติ ผ่านเกณฑ์", status: "normal" };
}

function formatInspectionTime(isoStr?: string | null): string {
  if (!isoStr) return "-";
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น.";
  } catch {
    return "-";
  }
}

/**
 * Generate UTF-8 BOM CSV text for Microsoft Excel & Google Sheets
 */
export function generateRefrigeratorCSV(
  tasks: RefrigeratorTaskItem[],
  branchName: string,
  dateStr: string
): string {
  const rows: string[] = [];

  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;
  const pending = tasks.filter((t) => !t.completed && !t.disableCheck).length;
  const issues = tasks.filter((t) => {
    const assessment = getAssessmentText(t);
    return assessment.status === "danger";
  }).length;
  const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Metadata Header Block
  rows.push([escapeCSV("รายงานผลการตรวจสอบอุณหภูมิและอุปกรณ์ตู้แช่ประจำวัน")].join(","));
  rows.push([escapeCSV("สาขา:"), escapeCSV(branchName || "สาขาหลัก"), escapeCSV("วันที่ตรวจสอบ:"), escapeCSV(dateStr)].join(","));
  rows.push([
    escapeCSV("สรุปผลการตรวจสอบ:"),
    escapeCSV(`ตู้แช่ทั้งหมด ${total} ตู้`),
    escapeCSV(`ตรวจแล้ว ${done} ตู้ (${completionPct}%)`),
    escapeCSV(`รอดำเนินการ ${pending} ตู้`),
    escapeCSV(`พบปัญหา/เกินเกณฑ์ ${issues} ตู้`),
  ].join(","));
  rows.push([escapeCSV("เวลาที่ออกรายงาน:"), escapeCSV(new Date().toLocaleString("th-TH"))].join(","));
  rows.push(""); // Empty separator row

  // Table Column Headers
  const headers = [
    "ลำดับ",
    "วันที่ตรวจ",
    "สาขา",
    "ชื่อตู้แช่",
    "อุณหภูมิที่วัดได้ (°C)",
    "เกณฑ์ต่ำสุด (°C)",
    "เกณฑ์สูงสุด (°C)",
    "เกณฑ์มาตรฐาน (°C)",
    "ผลการประเมิน",
    "สถานะการตรวจ",
    "ผู้บันทึกผล",
    "เวลาบันทึก",
    "หมายเหตุ / ปัญหาที่พบ",
  ];
  rows.push(headers.map(escapeCSV).join(","));

  // Data Rows
  tasks.forEach((t, idx) => {
    const assessment = getAssessmentText(t);
    const row = [
      idx + 1,
      t.taskDate,
      branchName || "สาขาหลัก",
      t.name,
      t.temperature !== null && t.temperature !== undefined ? t.temperature : "-",
      t.minTemperature,
      t.maxTemperature,
      `${t.minTemperature}°C ถึง ${t.maxTemperature}°C`,
      assessment.text,
      t.completed ? "ตรวจแล้ว" : "ยังไม่ตรวจ",
      t.completedByUserName || "-",
      formatInspectionTime(t.completedAt),
      t.comment || "-",
    ];
    rows.push(row.map(escapeCSV).join(","));
  });

  return rows.join("\r\n");
}

/**
 * Generate SpreadsheetML (.xls) XML for rich Microsoft Excel formatting with styles and colors
 */
export function generateRefrigeratorExcelXML(
  tasks: RefrigeratorTaskItem[],
  branchName: string,
  dateStr: string
): string {
  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;
  const pending = tasks.filter((t) => !t.completed && !t.disableCheck).length;
  const issues = tasks.filter((t) => {
    const assessment = getAssessmentText(t);
    return assessment.status === "danger";
  }).length;
  const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;

  let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Segoe UI" ss:Size="14" ss:Bold="1" ss:Color="#451A03"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="MetaLabel">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#78350F"/>
  </Style>
  <Style ss:ID="MetaValue">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1E293B"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#78350F" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#451A03"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#451A03"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#451A03"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#451A03"/>
   </Borders>
  </Style>
  <Style ss:ID="CellNormal">
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="CellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="StatusPass">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#166534"/>
   <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#86EFAC"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#86EFAC"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#86EFAC"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#86EFAC"/>
   </Borders>
  </Style>
  <Style ss:ID="StatusDanger">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#991B1B"/>
   <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FCA5A5"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FCA5A5"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FCA5A5"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FCA5A5"/>
   </Borders>
  </Style>
  <Style ss:ID="StatusWarning">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#92400E"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FDE68A"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FDE68A"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FDE68A"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FDE68A"/>
   </Borders>
  </Style>
  <Style ss:ID="StatusDisabled">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#64748B"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="ข้อมูลตู้แช่_${escapeXML(dateStr)}">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="45"/>
   <Column ss:Width="80"/>
   <Column ss:Width="100"/>
   <Column ss:Width="150"/>
   <Column ss:Width="120"/>
   <Column ss:Width="90"/>
   <Column ss:Width="90"/>
   <Column ss:Width="110"/>
   <Column ss:Width="170"/>
   <Column ss:Width="90"/>
   <Column ss:Width="120"/>
   <Column ss:Width="80"/>
   <Column ss:Width="180"/>

   <!-- Title -->
   <Row ss:Height="28">
    <Cell ss:MergeAcross="12" ss:StyleID="Title"><Data ss:Type="String">รายงานผลการตรวจสอบอุณหภูมิและอุปกรณ์ตู้แช่ประจำวัน</Data></Cell>
   </Row>

   <!-- Meta 1 -->
   <Row>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">สาขา:</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXML(branchName || "สาขาหลัก")}</Data></Cell>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">วันที่ตรวจสอบ:</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXML(dateStr)}</Data></Cell>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">เวลาที่ออกรายงาน:</Data></Cell>
    <Cell ss:MergeAcross="3" ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXML(new Date().toLocaleString("th-TH"))}</Data></Cell>
   </Row>

   <!-- Meta 2: Summary Stats -->
   <Row>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">สรุปผล:</Data></Cell>
    <Cell ss:MergeAcross="11" ss:StyleID="MetaValue"><Data ss:Type="String">ตู้แช่ทั้งหมด ${total} ตู้ | ตรวจแล้ว ${done} ตู้ (${completionPct}%) | รอดำเนินการ ${pending} ตู้ | ผิดปกติ ${issues} ตู้</Data></Cell>
   </Row>

   <!-- Empty row -->
   <Row ss:Height="10"/>

   <!-- Table Headers -->
   <Row ss:Height="24">
    <Cell ss:StyleID="Header"><Data ss:Type="String">ลำดับ</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">วันที่ตรวจ</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">สาขา</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">ชื่อตู้แช่</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">อุณหภูมิที่วัดได้ (°C)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">เกณฑ์ต่ำสุด (°C)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">เกณฑ์สูงสุด (°C)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">เกณฑ์มาตรฐาน</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">ผลการประเมิน</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">สถานะการตรวจ</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">ผู้บันทึกผล</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">เวลาบันทึก</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">หมายเหตุ / ปัญหาที่พบ</Data></Cell>
   </Row>
`;

  tasks.forEach((t, idx) => {
    const assessment = getAssessmentText(t);
    let statusStyle = "StatusPass";
    if (assessment.status === "danger") statusStyle = "StatusDanger";
    else if (assessment.status === "warning") statusStyle = "StatusWarning";
    else if (assessment.status === "disabled") statusStyle = "StatusDisabled";

    xml += `   <Row ss:Height="22">
    <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXML(t.taskDate)}</Data></Cell>
    <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${escapeXML(branchName || "สาขาหลัก")}</Data></Cell>
    <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${escapeXML(t.name)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="${t.temperature !== null && t.temperature !== undefined ? "Number" : "String"}">${escapeXML(t.temperature !== null && t.temperature !== undefined ? t.temperature : "-")}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${t.minTemperature}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${t.maxTemperature}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXML(`${t.minTemperature}°C ถึง ${t.maxTemperature}°C`)}</Data></Cell>
    <Cell ss:StyleID="${statusStyle}"><Data ss:Type="String">${escapeXML(assessment.text)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXML(t.completed ? "ตรวจแล้ว" : "ยังไม่ตรวจ")}</Data></Cell>
    <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${escapeXML(t.completedByUserName || "-")}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXML(formatInspectionTime(t.completedAt))}</Data></Cell>
    <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${escapeXML(t.comment || "-")}</Data></Cell>
   </Row>\n`;
  });

  xml += `  </Table>
 </Worksheet>
</Workbook>`;

  return xml;
}

/**
 * Triggers a browser download of the generated file
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Helper to export refrigerator data at a specific day as CSV (with UTF-8 BOM for Excel)
 */
export function exportRefrigeratorDataAsCSV(
  tasks: RefrigeratorTaskItem[],
  branchName: string,
  dateStr: string
) {
  const csvContent = "\uFEFF" + generateRefrigeratorCSV(tasks, branchName, dateStr);
  const cleanBranch = (branchName || "branch").replace(/[^a-zA-Z0-9_\u0E00-\u0E7F]/g, "_");
  const filename = `refrigerator_${cleanBranch}_${dateStr}.csv`;
  downloadFile(csvContent, filename, "text/csv;charset=utf-8;");
}

/**
 * Helper to export refrigerator data at a specific day as native Excel XML (.xls)
 */
export function exportRefrigeratorDataAsExcel(
  tasks: RefrigeratorTaskItem[],
  branchName: string,
  dateStr: string
) {
  const xmlContent = generateRefrigeratorExcelXML(tasks, branchName, dateStr);
  const cleanBranch = (branchName || "branch").replace(/[^a-zA-Z0-9_\u0E00-\u0E7F]/g, "_");
  const filename = `refrigerator_${cleanBranch}_${dateStr}.xls`;
  downloadFile(xmlContent, filename, "application/vnd.ms-excel;charset=utf-8;");
}
