// File: services/tableHelper.js

/**
 * 🟢 ฟังก์ชันดึงหมายเลขโต๊ะ (รองรับทั้ง 10 โต๊ะแบบ Dynamic)
 * ลำดับการตรวจสอบ:
 * 1. ตรวจสอบจาก Navigation Params (ส่งมาจากหน้าก่อนหน้า)
 * 2. ตรวจสอบจาก URL Path (เช่น /table/5)
 * 3. ตรวจสอบจาก URL Query String (เช่น ?table=5)
 */
export const getTableNumber = (route) => {
  // 1. ดึงจาก Navigation Params
  if (route?.params?.tableNumber) {
    return String(route.params.tableNumber);
  }

  // 2. ดึงจาก URL บนเว็บบราวเซอร์จริง
  if (typeof window !== 'undefined' && window.location) {
    const pathname = window.location.pathname;
    const pathParts = pathname.split('/');
    
    // กรณี URL แบบ /table/1 ถึง /table/10
    const tableIndex = pathParts.indexOf('table');
    if (tableIndex !== -1 && pathParts[tableIndex + 1]) {
      return String(pathParts[tableIndex + 1]);
    }

    // กรณี URL แบบ ?table=1 ถึง ?table=10
    const searchParams = new URLSearchParams(window.location.search);
    const queryTable = searchParams.get('table');
    if (queryTable) {
      return String(queryTable);
    }
  }

  // หากไม่พบข้อมูล (กรณีเข้าแอปโดยไม่ได้สแกน QR Code)
  return null; 
};