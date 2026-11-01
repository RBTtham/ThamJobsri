// File: G:\ProjectJin\services\tableService.js
import { db } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

// ฟังก์ชันสุ่มสร้าง SessionToken (เช่น SESS-X8K2M1)
export const generateSessionToken = () => {
  return 'SESS-' + Math.random().toString(36).substring(2, 9).toUpperCase();
};

// สำหรับลูกค้าสแกนเข้ามา (หาจากเลขโต๊ะ)
export const checkTableSession = async (tableNumber) => {
  try {
    const docId = `table_${tableNumber}`;
    const tableRef = doc(db, 'Table', docId); // 🟢 เปลี่ยนจาก Tables เป็น Table
    const docSnap = await getDoc(tableRef);

    if (docSnap.exists()) {
      const tableData = docSnap.data();
      if (tableData.status === 'occupied') {
        return { success: true, isOpen: true, tableData };
      } else {
        return { success: true, isOpen: false, message: 'โต๊ะนี้ยังไม่ได้เปิดใช้งาน กรุณาติดต่อพนักงานบริการ' };
      }
    } else {
      return { success: false, isOpen: false, message: 'ไม่พบข้อมูลหมายเลขโต๊ะนี้ในระบบ' };
    }
  } catch (error) {
    console.error("Error in checkTableSession:", error);
    return { success: false, isOpen: false, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์' };
  }
};

/**
 * 🧹 สำหรับพนักงานเคลียร์โต๊ะ
 */
export const clearTableSession = async (docId) => {
  try {
    const tableRef = doc(db, 'Table', docId); // 🟢 เปลี่ยนจาก Tables เป็น Table
    
    await updateDoc(tableRef, {
      status: 'available',
      openedAt: '',
      SessionToken: '' // 🟢 เคลียร์ SessionToken ออก
    });

    return { success: true };
  } catch (error) {
    console.error("Error in clearTableSession:", error);
    return { success: false, message: error.message };
  }
};

/**
 * 🟢 สำหรับพนักงานเปิดโต๊ะใหม่
 */
export const openTableSession = async (docId, customToken = null) => {
  try {
    const tableRef = doc(db, 'Table', docId); // 🟢 เปลี่ยนจาก Tables เป็น Table
    const token = customToken || generateSessionToken();
    
    await updateDoc(tableRef, {
      status: 'occupied',
      openedAt: new Date().toISOString(),
      SessionToken: token // 🟢 บันทึก SessionToken
    });

    return { success: true, sessionToken: token };
  } catch (error) {
    console.error("Error in openTableSession:", error);
    return { success: false, message: error.message };
  }
};