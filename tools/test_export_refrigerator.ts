import { generateRefrigeratorCSV, generateRefrigeratorExcelXML, getAssessmentText } from "../src/utils/exportRefrigeratorData";
import { RefrigeratorTaskItem } from "../src/services/types";

async function run() {
  console.log("=== Testing Refrigerator CSV & Excel Export Generation ===");

  const mockTasks: RefrigeratorTaskItem[] = [
    {
      taskId: "task-1",
      refrigeratorId: "ref-1",
      name: "ตู้แช่เครื่องดื่ม 1 (Beverage 1)",
      minTemperature: 0,
      maxTemperature: 4,
      targetTemperature: 4,
      disableCheck: false,
      taskDate: "2026-10-01",
      completed: true,
      completedAt: "2026-10-01T08:30:00.000Z",
      completedByUserId: "user-1",
      completedByUserName: "สมชาย มั่นคง",
      temperature: 2.5,
      isOkay: true,
      comment: "ความเย็นปกติ พร้อมใช้งาน",
    },
    {
      taskId: "task-2",
      refrigeratorId: "ref-2",
      name: "ตู้แช่แซนด์วิชและข้าวกล่อง (Sandwich/Ready Meals)",
      minTemperature: 1,
      maxTemperature: 5,
      targetTemperature: 5,
      disableCheck: false,
      taskDate: "2026-10-01",
      completed: true,
      completedAt: "2026-10-01T09:15:00.000Z",
      completedByUserId: "user-2",
      completedByUserName: "กัญญาภัทร พิมพา",
      temperature: 6.8, // Over temperature limit
      isOkay: false,
      comment: "อุณหภูมิเกิน แจ้งช่างซ่อมบำรุงแล้ว",
    },
    {
      taskId: "task-3",
      refrigeratorId: "ref-3",
      name: "ตู้แช่ไอศกรีม (Ice Cream Freezer)",
      minTemperature: -20,
      maxTemperature: -15,
      targetTemperature: -18,
      disableCheck: false,
      taskDate: "2026-10-01",
      completed: false,
      completedAt: null,
      completedByUserId: null,
      completedByUserName: null,
      temperature: null,
      isOkay: true,
      comment: null,
    },
    {
      taskId: "task-4",
      refrigeratorId: "ref-4",
      name: "ตู้แช่สำรองหลังร้าน (Backstore Backup)",
      minTemperature: 0,
      maxTemperature: 4,
      targetTemperature: 4,
      disableCheck: true,
      taskDate: "2026-10-01",
      completed: false,
      completedAt: null,
      completedByUserId: null,
      completedByUserName: null,
      temperature: null,
      isOkay: true,
      comment: "ปิดปรับปรุงชั่วคราว",
    }
  ];

  // Test 1: Assessment Logic
  console.log("Test 1: Testing assessment status calculations...");
  const assess1 = getAssessmentText(mockTasks[0]);
  if (assess1.status !== "normal" || !assess1.text.includes("ปกติ")) {
    throw new Error(`Expected normal assessment for task 1, got: ${JSON.stringify(assess1)}`);
  }

  const assess2 = getAssessmentText(mockTasks[1]);
  if (assess2.status !== "danger" || !assess2.text.includes("อุณหภูมิสูงเกินเกณฑ์")) {
    throw new Error(`Expected danger assessment for task 2, got: ${JSON.stringify(assess2)}`);
  }

  const assess3 = getAssessmentText(mockTasks[2]);
  if (assess3.status !== "warning" || !assess3.text.includes("รอดำเนินการ")) {
    throw new Error(`Expected warning assessment for task 3, got: ${JSON.stringify(assess3)}`);
  }

  const assess4 = getAssessmentText(mockTasks[3]);
  if (assess4.status !== "disabled" || !assess4.text.includes("ปิดใช้งาน")) {
    throw new Error(`Expected disabled assessment for task 4, got: ${JSON.stringify(assess4)}`);
  }
  console.log("✓ Assessment logic passed!");

  // Test 2: CSV Generation
  console.log("Test 2: Generating CSV output...");
  const csv = generateRefrigeratorCSV(mockTasks, "สาขาสยามสแควร์", "2026-10-01");
  console.log("CSV Preview (first 500 chars):\n" + csv.slice(0, 500) + "\n...");

  if (!csv.includes("รายงานผลการตรวจสอบอุณหภูมิและอุปกรณ์ตู้แช่ประจำวัน")) {
    throw new Error("CSV missing title header");
  }
  if (!csv.includes("สาขาสยามสแควร์") || !csv.includes("2026-10-01")) {
    throw new Error("CSV missing branch or date metadata");
  }
  if (!csv.includes("ตู้แช่เครื่องดื่ม 1") || !csv.includes("6.8") || !csv.includes("ความเย็นปกติ พร้อมใช้งาน")) {
    throw new Error("CSV missing task row contents");
  }
  console.log("✓ CSV Generation verified!");

  // Test 3: Excel XML Generation
  console.log("Test 3: Generating Excel SpreadsheetML XML output...");
  const xml = generateRefrigeratorExcelXML(mockTasks, "สาขาสยามสแควร์", "2026-10-01");
  console.log("Excel XML Preview (first 500 chars):\n" + xml.slice(0, 500) + "\n...");

  if (!xml.startsWith('<?xml version="1.0"?>')) {
    throw new Error("Excel XML missing XML declaration");
  }
  if (!xml.includes("urn:schemas-microsoft-com:office:spreadsheet")) {
    throw new Error("Excel XML missing SpreadsheetML namespace");
  }
  if (!xml.includes("StatusPass") || !xml.includes("StatusDanger") || !xml.includes("StatusWarning")) {
    throw new Error("Excel XML missing status color styles");
  }
  if (!xml.includes("ตู้แช่แซนด์วิชและข้าวกล่อง") || !xml.includes("</Workbook>")) {
    throw new Error("Excel XML missing data rows or proper closing tags");
  }
  console.log("✓ Excel XML Generation verified!");

  console.log("=== All Refrigerator Export Tests Passed Successfully! ===");
  process.exit(0);
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
