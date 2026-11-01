// File: G:\ProjectJin\services\firebase.js
import { initializeApp } from "firebase/app";
// ➕ เพิ่มการนำเข้า getFirestore และคำสั่งสำหรับ CRUD
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA1yjyMB93HWDfBdj6wSuBu70B10cpVoKk",
  authDomain: "login-a7fa2.firebaseapp.com",
  projectId: "login-a7fa2",
  storageBucket: "login-a7fa2.firebasestorage.app",
  messagingSenderId: "22242929867",
  appId: "1:22242929867:web:d901fbe58633961a6c7f4e",
  measurementId: "G-8V3QB0EVFJ"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// 1. ฟังก์ชันดึงข้อมูลเมนูอาหาร (ที่มีอยู่เดิม)
export const fetchMenus = async () => {
  const menuCollection = collection(db, 'Menu'); // ใช้อักษรตัวใหญ่ Menu
  const menuSnapshot = await getDocs(menuCollection);
  const menuList = menuSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  return menuList;
};

// 2. ➕ ฟังก์ชันเพิ่มเมนูใหม่เข้าคอลเลกชัน Menu
export const addMenu = async (menuData) => {
  try {
    const menuCollection = collection(db, 'Menu');
    const docRef = await addDoc(menuCollection, menuData);
    return docRef.id;
  } catch (error) {
    console.error("Error adding menu: ", error);
    throw error;
  }
};

// 3. ➕ ฟังก์ชันแก้ไข/อัปเดตข้อมูลเมนูอาหารเดิมตาม ID
export const updateMenu = async (id, updatedData) => {
  try {
    const menuDocRef = doc(db, 'Menu', id);
    await updateDoc(menuDocRef, updatedData);
  } catch (error) {
    console.error("Error updating menu: ", error);
    throw error;
  }
};

// 4. ➕ ฟังก์ชันลบเมนูอาหารออกจากระบบถาวร
export const deleteMenu = async (id) => {
  try {
    const menuDocRef = doc(db, 'Menu', id);
    await deleteDoc(menuDocRef);
  } catch (error) {
    console.error("Error deleting menu: ", error);
    throw error;
  }
};