// File: screens/MenuScreen.jsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, ScrollView, SafeAreaView, Dimensions, ActivityIndicator,
  Modal
} from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, fetchMenus } from '../services/firebase';
import { useCart } from '../services/CartContext';

const { width } = Dimensions.get('window');

// 🟢 Helper Function สำหรับดึง TableNumber จาก Route หรือ URL (ไว้ด้านนอกเพื่อความสะอาด)
const getTableNumberFromUrl = (route) => {
  if (route.params?.tableNumber) {
    return String(route.params.tableNumber);
  }
  if (typeof window !== 'undefined' && window.location) {
    const fullPath = window.location.pathname + window.location.hash + window.location.search;
    const match = fullPath.match(/table[=/]([a-zA-Z0-9]+)/i);
    if (match && match[1]) {
      return match[1];
    }
  }
  return "1";
};

// 🟢 Helper Function สำหรับดึง SessionToken จาก Route หรือ URL
const getSessionTokenFromUrl = (route) => {
  // เช็กจาก route.params ก่อน
  if (route.params?.session) return String(route.params.session).trim();
  if (route.params?.sessionToken) return String(route.params.sessionToken).trim();

  // เช็กจาก URL Browser (สำหรับ Web)
  if (typeof window !== 'undefined' && window.location) {
    try {
      // ดึงตรงๆ ผ่าน URLSearchParams
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('session') || urlParams.get('sessionToken');
      if (token) return token.trim();

      // สำรองกรณี URL มี Hash Router (#)
      const match = window.location.href.match(/[?&](?:session|sessionToken)=([a-zA-Z0-9\-_]+)/i);
      if (match && match[1]) return match[1].trim();
    } catch (e) {
      console.error("Error parsing URL params:", e);
    }
  }
  return null;
};

const MenuScreen = ({ route, navigation }) => {
  const tableNumber = getTableNumberFromUrl(route);
  const currentUrlToken = getSessionTokenFromUrl(route); // 🟢 ดึง Token มารอไว้ระดับ Top-level

  const [menu, setMenu] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('อาหารตามสั่ง');

  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(true);
  const [sessionError, setSessionError] = useState('');

  const { cart, addToCart } = useCart();

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  const categories = ['อาหารตามสั่ง', 'เครื่องดื่ม', 'ของทานเล่น'];

  // 🟢 ฟังก์ชันดึงข้อมูลเมนู
  const handleRefresh = async () => {
  try {
    setIsLoading(true);
    setSearchQuery(''); // 🟢 ล้างช่องค้นหาให้กลับมาเป็นค่าว่าง (รีเซ็ตการค้นหา)
    const data = await fetchMenus();
    setMenu(data);
  } catch (error) {
    console.error("Error fetching menu: ", error);
  } finally {
    setIsLoading(false);
  }
};

  useEffect(() => {
    handleRefresh(); // ดึงรายการเมนูเมื่อเริ่มโหลดหน้า

    const docId = `table_${tableNumber}`;
    const tableRef = doc(db, 'Table', docId);

    const unsub = onSnapshot(tableRef, (docSnap) => {
      if (docSnap.exists()) {
        const tableData = docSnap.data();

        // 🟢 ดึง Token จาก DB (ดักไว้ทั้ง S ตัวใหญ่และตัวเล็ก กันพลาด)
        const dbSessionToken = String(
          tableData.SessionToken || tableData.sessionToken || ''
        ).trim();

        // 🟢 ดึง Token จาก URL/Params
        const urlToken = String(currentUrlToken || '').trim();

        // 🐞 คุณสามารถ uncomment สองบรรทัดนี้เพื่อดูค่าใน Console F12 ได้ครับ
        // console.log("DB Token:", dbSessionToken);
        // console.log("URL Token:", urlToken);

        if (tableData.status === 'available') {
          // เงื่อนไขที่ 1: โต๊ะยังไม่ได้เปิดใช้งาน
          setSessionError('โต๊ะนี้ยังไม่ได้เปิดใช้งาน หรือเซสชันสั่งอาหารสิ้นสุดลงแล้ว กรุณาติดต่อพนักงานบริการ');
        } else if (!dbSessionToken || !urlToken || urlToken !== dbSessionToken) {
          // 🟢 เงื่อนไขที่ 2: บล็อกทันทีถ้า
          // - ใน DB ไม่มี SessionToken
          // - ใน URL ไม่มี SessionToken
          // - Token ใน URL ไม่ตรงกับ ใน DB (เช่น SESS-MYJF9DW !== SESS-GNA6OMO)
          setSessionError('QR Code หรือลิงก์นี้หมดอายุแล้ว (มีการเปิดรอบใหม่) กรุณาสแกน QR Code ล่าสุดที่โต๊ะ');
        } else {
          // ผ่านการตรวจสอบทั้งหมด
          setSessionError('');
        }
      } else {
        setSessionError('ไม่พบข้อมูลหมายเลขโต๊ะนี้ในระบบร้านอาหาร');
      }
      setIsValidating(false);
      setIsLoading(false);
    }, (error) => {
      console.error("Table snapshot error:", error);
      setSessionError('การเชื่อมต่อกับเซิร์ฟเวอร์โต๊ะขัดข้อง');
      setIsValidating(false);
      setIsLoading(false);
    });

    return () => unsub();
  }, [tableNumber, currentUrlToken]);

  const handleOpenModal = (item) => {
    setSelectedItem(item);
    setQuantity(1);
    setNote('');
    setModalVisible(true);
  };

  const handleAddToCart = () => {
    if (!selectedItem) return;
    addToCart(selectedItem, quantity, note);
    setModalVisible(false);
  };

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const filteredMenu = menu.filter(item => {
    const isCategoryMatch = item.Category === activeCategory;
    const isSearchMatch = item.MenuName ? item.MenuName.includes(searchQuery) : false;
    return isCategoryMatch && isSearchMatch;
  });

  if (isValidating || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4b8df8" />
        <Text style={styles.loadingText}>กำลังตรวจสอบสถานะ โต๊ะ {tableNumber}...</Text>
      </View>
    );
  }

  if (sessionError) {
    return (
      <SafeAreaView style={styles.errorSafeArea}>
        <View style={styles.errorCardContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>ไม่สามารถเข้าหน้าสั่งอาหารได้</Text>
          <Text style={styles.errorSubtitle}>โต๊ะหมายเลข : {tableNumber}</Text>
          <Text style={styles.errorTextDetails}>{sessionError}</Text>
          <TouchableOpacity style={styles.errorCloseBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.errorCloseBtnText}>ย้อนกลับ</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.tableInfo}>โต๊ะหมายเลข : {tableNumber}</Text>
          <View style={styles.headerTop}>
            <Text style={styles.title}>เมนูอาหาร</Text>
            <TouchableOpacity
              style={styles.historyBtn}
              onPress={() => navigation.navigate('OrderHistory', { tableNumber, sessionToken: currentUrlToken })}
            >
              <Text style={styles.historyText}>🕒 ประวัติการสั่ง</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="ค้นหาเมนู..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          <View style={styles.categoryRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryTabs}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catBtn, activeCategory === cat && styles.catBtnActive]}
                  onPress={() => setActiveCategory(cat)}
                >
                  <Text style={[styles.catBtnText, activeCategory === cat && styles.catBtnTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh}>
              <Text style={styles.refreshIcon}>🔄</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.menuGrid}>
          {filteredMenu.map((item) => {
            const isAvailable = item.Status !== false && item.Status !== 'false' && item.status !== false;

            return (
              <View style={styles.menuCard} key={item.id}>
                {item.Image ? (
                  <Image source={{ uri: item.Image }} style={[styles.menuImage, !isAvailable && { opacity: 0.4 }]} />
                ) : (
                  <View style={[styles.menuImage, { backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ color: '#888', fontSize: 12 }}>ไม่มีรูปภาพ</Text>
                  </View>
                )}
                <Text style={styles.menuName}>{item.MenuName}</Text>
                <Text style={styles.menuPrice}>ราคา: {item.Price || 0} บาท</Text>

                <TouchableOpacity
                  style={[styles.orderBtn, !isAvailable && { backgroundColor: '#aaa' }]}
                  onPress={() => isAvailable && handleOpenModal(item)}
                  disabled={!isAvailable}
                >
                  <Text style={styles.orderBtnText}>
                    {isAvailable ? 'order now' : 'หมด / ไม่พร้อมขาย'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={modalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{selectedItem?.MenuName}</Text>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>ระบุจำนวน</Text>
              <View style={styles.qtyContainer}>
                <TouchableOpacity onPress={() => setQuantity(q => Math.max(1, q - 1))}>
                  <Text style={styles.qtyActionBtn}>➖</Text>
                </TouchableOpacity>
                <Text style={styles.qtyValueText}>{quantity}</Text>
                <TouchableOpacity onPress={() => setQuantity(q => q + 1)}>
                  <Text style={styles.qtyActionBtn}>➕</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>เพิ่มเติม</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="..."
                value={note}
                onChangeText={setNote}
              />
            </View>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>ย้อนกลับ</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleAddToCart}>
                <Text style={styles.modalConfirmBtnText}>เพิ่มลงตะกร้า</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <TouchableOpacity
        style={styles.floatingCart}
        onPress={() => navigation.navigate('Cart', { tableNumber, sessionToken: currentUrlToken })}
      >
        <Text style={styles.cartIcon}>🛒</Text>
        {totalCartCount > 0 && (
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{totalCartCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
};


const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#e5e5e5' },
  container: { flex: 1, padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#e5e5e5' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#333', fontWeight: '500' },
  header: { marginBottom: 20 },
  tableInfo: { fontSize: 16, color: '#333', marginBottom: 8, fontWeight: 'bold' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, color: '#222', fontWeight: 'bold' },
  historyBtn: { backgroundColor: 'white', borderColor: '#ccc', borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20 },
  historyText: { fontSize: 14, color: '#333' },
  searchInput: { backgroundColor: 'white', width: '100%', padding: 12, borderRadius: 8, fontSize: 16, marginBottom: 16 },

  // 🟢 สไตล์สำหรับแถบหมวดหมู่และปุ่มรีเฟรช
  categoryRow: { flexDirection: 'row', alignItems: 'center' },
  categoryTabs: { flex: 1, flexDirection: 'row' },
  catBtn: { backgroundColor: '#f0f0f0', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, marginRight: 10 },
  catBtnActive: { backgroundColor: '#8bb4f6' },
  catBtnText: { fontSize: 14, color: '#555' },
  catBtnTextActive: { color: '#000', fontWeight: 'bold' },
  refreshBtn: { backgroundColor: 'white', borderWidth: 1, borderColor: '#ccc', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, marginLeft: 8, justifyContent: 'center', alignItems: 'center' },
  refreshIcon: { fontSize: 16 },

  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  menuCard: { backgroundColor: 'white', width: (width / 2) - 24, borderRadius: 12, padding: 12, marginBottom: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  menuImage: { width: '100%', height: 100, borderRadius: 8, marginBottom: 8, backgroundColor: '#ccc' },
  menuName: { fontSize: 14, color: '#222', fontWeight: 'bold', textAlign: 'center' },
  menuPrice: { fontSize: 14, color: '#4b8df8', marginBottom: 12 },
  orderBtn: { backgroundColor: '#4b8df8', paddingVertical: 8, width: '100%', borderRadius: 20, alignItems: 'center' },
  orderBtnText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  floatingCart: { position: 'absolute', bottom: 20, right: 20, backgroundColor: '#8ee98e', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4 },
  cartIcon: { fontSize: 24 },
  cartBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: 'red', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cartBadgeText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '85%', backgroundColor: '#eeeeee', borderRadius: 25, padding: 22, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#222', marginBottom: 20 },
  modalRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10 },
  modalLabel: { fontSize: 18, color: '#222', fontWeight: 'bold' },
  qtyContainer: { flexDirection: 'row', alignItems: 'center' },
  qtyActionBtn: { fontSize: 22, paddingHorizontal: 12 },
  qtyValueText: { fontSize: 20, fontWeight: 'bold', marginHorizontal: 15 },
  modalInput: { backgroundColor: '#d9d9d9', width: '60%', borderRadius: 15, paddingHorizontal: 12, height: 38, fontSize: 16 },
  modalButtonRow: { flexDirection: 'row', marginTop: 30, width: '100%', justifyContent: 'space-around' },
  modalCancelBtn: { backgroundColor: '#8e8e8e', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 15, width: '45%', alignItems: 'center' },
  modalCancelBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  modalConfirmBtn: { backgroundColor: '#4caf50', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 15, width: '45%', alignItems: 'center' },
  modalConfirmBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  errorSafeArea: { flex: 1, backgroundColor: '#e5e5e5', justifyContent: 'center', alignItems: 'center' },
  errorCardContainer: { width: '85%', backgroundColor: 'white', borderRadius: 20, padding: 24, alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorTitle: { fontSize: 18, fontWeight: 'bold', color: '#d9534f', textAlign: 'center' },
  errorSubtitle: { fontSize: 15, fontWeight: '600', color: '#333', marginTop: 4 },
  errorTextDetails: { fontSize: 13, color: '#666', textAlign: 'center', marginTop: 8, marginBottom: 24, paddingHorizontal: 10, lineHeight: 18 },
  errorCloseBtn: { backgroundColor: '#4b8df8', paddingVertical: 10, paddingHorizontal: 30, borderRadius: 20 },
  errorCloseBtnText: { color: 'white', fontSize: 14, fontWeight: 'bold' }
});

export default MenuScreen;