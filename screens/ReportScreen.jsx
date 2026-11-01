// File: screens/ReportScreen.jsx
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, SafeAreaView, 
  ActivityIndicator, TouchableOpacity, Dimensions, Modal, Platform 
} from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase'; 

export default function ReportScreen({ navigation }) {
  const [isLoading, setIsLoading] = useState(true);
  const [totalSales, setTotalSales] = useState(0);
  const [totalDishes, setTotalDishes] = useState(0); 
  const [dishBreakdown, setDishBreakdown] = useState([]); 
  const [selectedCategory, setSelectedCategory] = useState('ยอดขาย');

  // 🟢 State ควบคุม Modal เมนู 3 ขีด (Hamburger Menu)
  const [sideMenuVisible, setSideMenuVisible] = useState(false);

  // 🟢 เพิ่ม 'ยอดรายการ' ในปุ่มเลือกหมวดหมู่
  const categories = ['อาหารตามสั่ง', 'เครื่องดื่ม', 'ของทานเล่น', 'ยอดขาย', 'ยอดรายการ'];

  const loadOrderReports = async () => {
    try {
      setIsLoading(true);
      const menuCollection = collection(db, 'Menu');
      const menuSnapshot = await getDocs(menuCollection);
      const menuMap = {};

      menuSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const docId = doc.id;
        const menuIdKey = data.MenuID || docId;
        menuMap[menuIdKey] = {
          name: data.MenuName || data.name || menuIdKey,
          category: data.Category || data.category || 'อาหารตามสั่ง'
        };
      });

      const reportCollection = collection(db, 'Report');
      const reportSnapshot = await getDocs(reportCollection);
      
      let sumAmount = 0;
      let sumDishes = 0;
      const dishMap = {}; 

      reportSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const menuID = data.MenuID || 'Unknown';
        const qty = Number(data.Quantity) || 0;
        const price = Number(data.Price) || 0;
        const revenue = Number(data.TotalRevenue) !== undefined ? Number(data.TotalRevenue) : (price * qty);

        sumAmount += revenue;
        sumDishes += qty;

        const menuItemInfo = menuMap[menuID] || {
          name: `เมนู (${menuID})`,
          category: 'อาหารตามสั่ง'
        };

        if (dishMap[menuID]) {
          dishMap[menuID].qty += qty;
          dishMap[menuID].revenue += revenue;
        } else {
          dishMap[menuID] = {
            id: menuID,
            name: menuItemInfo.name,
            category: menuItemInfo.category,
            qty: qty,
            revenue: revenue
          };
        }
      });

      const breakdownArray = Object.values(dishMap);

      setTotalSales(sumAmount);
      setTotalDishes(sumDishes);
      setDishBreakdown(breakdownArray);
    } catch (error) {
      console.error("Error fetching report: ", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrderReports();
  }, []);

  // 🟢 กรองข้อมูลและจัดเรียงตามหมวดหมู่ที่เลือก
  const filteredDishes = dishBreakdown
    .filter(dish => {
      if (selectedCategory === 'ยอดขาย' || selectedCategory === 'ยอดรายการ') return true;
      return dish.category === selectedCategory;
    })
    .sort((a, b) => {
      if (selectedCategory === 'ยอดรายการ') {
        // หากเลือก 'ยอดรายการ' ให้เรียงตามจำนวนที่ขายได้ (qty) มากไปน้อย
        return b.qty - a.qty || b.revenue - a.revenue;
      }
      // กรณีอื่นๆ เรียงตามยอดขาย (revenue) มากไปน้อย
      return b.revenue - a.revenue || b.qty - a.qty;
    });

  const handleLogout = () => {
    setSideMenuVisible(false);
    if (Platform.OS === 'web') {
      localStorage.removeItem('userRole');
    }
    navigation.navigate('RoleSelection');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4b8df8" />
        <Text style={styles.loadingText}>กำลังประมวลผลรายงาน...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 👑 Top Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.adminTitle}>รายงานยอดขาย</Text>
          <Text style={styles.adminSubtitle}>ผู้ดูแลระบบ</Text>
        </View>

        <View style={styles.topRightRow}>
          <TouchableOpacity style={styles.whitePillBtn} onPress={loadOrderReports}>
            <Text style={styles.pillBtnText}>🔄 รีเฟรช</Text>
          </TouchableOpacity>

          {/* ☰ ปุ่ม 3 ขีด ด้านขวา */}
          <TouchableOpacity 
            style={styles.hamburgerBtn} 
            onPress={() => setSideMenuVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.hamburgerIcon}>☰</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* แถบเลือกหมวดหมู่ */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryTabs}>
          {categories.map(cat => (
            <TouchableOpacity 
              key={cat} 
              style={[styles.catBtn, selectedCategory === cat && styles.catBtnActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.catBtnText, selectedCategory === cat && styles.catBtnTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.summaryGridRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.cardHeaderLabel}>รายได้รวมจากทุกเมนู (รายเดือน)</Text>
            <View style={styles.valueRow}>
              <Text style={styles.greenIcon}>💰</Text>
              <Text style={styles.priceValueText}>฿ {totalSales.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.cardHeaderLabel}>จำนวนรายการที่ขายได้</Text>
            <View style={styles.valueRow}>
              <Text style={styles.blueIcon}>📊</Text>
              <Text style={styles.qtyValueText}>{totalDishes.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          {selectedCategory === 'ยอดรายการ' ? 'ยอดรายการทุกเมนู' : 'ยอดสั่งซื้อทุกเมนู'}
        </Text>

        {filteredDishes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>ไม่มีข้อมูลรายการเมนูในหมวดหมู่นี้</Text>
          </View>
        ) : (
          filteredDishes.map((dish, index) => {
            let rankBgColor = '#ffffff';
            if (index === 0) rankBgColor = '#ffcc00';
            else if (index === 1) rankBgColor = '#ffffff';
            else if (index === 2) rankBgColor = '#ffb366';

            return (
              <View key={index} style={styles.menuReportCard}>
                <View style={[styles.rankCircle, { backgroundColor: rankBgColor }]}>
                  <Text style={styles.rankNumberText}>{index + 1}</Text>
                </View>

                <View style={styles.menuDetailsBox}>
                  <Text style={styles.menuNameTitle}>{dish.name}</Text>
                  <Text style={styles.menuSubDetails}>
                    {dish.category} 
                    {selectedCategory === 'ยอดรายการ' ? (
                      <Text style={styles.qtyBlueText}> รายได้: ฿{dish.revenue.toLocaleString()}</Text>
                    ) : (
                      <Text style={styles.qtyBlueText}> จำนวน: {dish.qty.toLocaleString()} รายการ</Text>
                    )}
                  </Text>
                </View>

                {/* แสดงผลด้านขวา: หากเลือก ยอดรายการ จะแสดงเป็นจำนวนรายการที่ขายได้ */}
                <View style={styles.revenueBox}>
                  {selectedCategory === 'ยอดรายการ' ? (
                    <>
                      <Text style={styles.revenuePriceText}>{dish.qty.toLocaleString()} รายการ</Text>
                      <Text style={styles.revenueLabelText}>จำนวนขายได้</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.revenuePriceText}>฿{dish.revenue.toLocaleString()}</Text>
                      <Text style={styles.revenueLabelText}>รายได้</Text>
                    </>
                  )}
                </View>
              </View>
            );
          })
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* 🟢 Modal เมนู 3 ขีด (Hamburger Popup) */}
      <Modal visible={sideMenuVisible} transparent={true} animationType="fade">
        <TouchableOpacity 
          style={styles.sideMenuOverlay} 
          activeOpacity={1} 
          onPress={() => setSideMenuVisible(false)}
        >
          <View style={styles.sideMenuCard} onStartShouldSetResponder={() => true}>
            
            <View style={styles.sideMenuHeader}>
              <View style={styles.sideMenuTitleRow}>
                <Text style={styles.sideMenuHeaderIcon}>☰</Text>
                <Text style={styles.sideMenuTitle}>เมนูระบบ</Text>
              </View>
              <TouchableOpacity onPress={() => setSideMenuVisible(false)}>
                <Text style={styles.closeMenuBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.menuItemRow}
              onPress={() => {
                setSideMenuVisible(false);
                navigation.navigate('ReportDetail');
              }}
            >
              <Text style={styles.menuItemText}>📄 รายละเอียด</Text>
              <Text style={styles.menuItemArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItemRow}
              onPress={() => {
                setSideMenuVisible(false);
                navigation.navigate('Admin');
              }}
            >
              <Text style={styles.menuItemText}>🍲 จัดการเมนูอาหาร</Text>
              <Text style={styles.menuItemArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItemRow}
              onPress={() => {
                setSideMenuVisible(false);
                navigation.navigate('UserManagement');
              }}
            >
              <Text style={styles.menuItemText}>🔑 รหัสผู้ใช้</Text>
              <Text style={styles.menuItemArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItemRow, { borderBottomWidth: 0 }]}
              onPress={handleLogout}
            >
              <Text style={[styles.menuItemText, { color: '#e11d48' }]}>🚪 ออกจากระบบ</Text>
              <Text style={[styles.menuItemArrow, { color: '#e11d48' }]}>›</Text>
            </TouchableOpacity>

          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 15, color: '#333' },
  container: { flex: 1, paddingHorizontal: 16 },

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f0f0', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#e0e0e0', marginBottom: 12 },
  adminTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  adminSubtitle: { fontSize: 13, color: '#666' },
  
  topRightRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  whitePillBtn: { backgroundColor: '#fff', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ccc' },
  pillBtnText: { fontSize: 12, fontWeight: 'bold', color: '#333' },

  hamburgerBtn: { backgroundColor: '#ffffff', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#bbb' },
  hamburgerIcon: { fontSize: 20, color: '#222', fontWeight: 'bold' },

  sideMenuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-start', alignItems: 'flex-end', padding: 16, paddingTop: 60 },
  sideMenuCard: { width: 280, backgroundColor: '#ffffff', borderRadius: 16, padding: 16, elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10 },
  sideMenuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#eee', marginBottom: 6 },
  sideMenuTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sideMenuHeaderIcon: { fontSize: 18, color: '#111' },
  sideMenuTitle: { fontSize: 16, fontWeight: 'bold', color: '#111' },
  closeMenuBtn: { fontSize: 20, color: '#666', fontWeight: 'bold', padding: 4 },
  
  menuItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  menuItemText: { fontSize: 15, fontWeight: '600', color: '#222' },
  menuItemArrow: { fontSize: 18, color: '#888', fontWeight: 'bold' },

  categoryTabs: { flexDirection: 'row', marginVertical: 8, flexGrow: 0 },
  catBtn: { backgroundColor: '#e0e0e0', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12, marginRight: 8 },
  catBtnActive: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#ccc' },
  catBtnText: { fontSize: 13, color: '#666' },
  catBtnTextActive: { color: '#000', fontWeight: 'bold' },

  summaryGridRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginVertical: 14 },
  summaryCard: { flex: 1, backgroundColor: '#dddddd', borderRadius: 16, padding: 14, justifyContent: 'center' },
  cardHeaderLabel: { fontSize: 12, color: '#444', fontWeight: '600', marginBottom: 6 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  greenIcon: { fontSize: 22 },
  blueIcon: { fontSize: 22 },
  priceValueText: { fontSize: 20, fontWeight: 'bold', color: '#111' },
  qtyValueText: { fontSize: 20, fontWeight: 'bold', color: '#111' },

  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#222', marginTop: 10, marginBottom: 12 },

  menuReportCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dddddd', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 12 },
  rankCircle: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginRight: 14, elevation: 2 },
  rankNumberText: { fontSize: 16, fontWeight: 'bold', color: '#222' },
  menuDetailsBox: { flex: 1 },
  menuNameTitle: { fontSize: 15, fontWeight: 'bold', color: '#111', marginBottom: 3 },
  menuSubDetails: { fontSize: 12, color: '#666' },
  qtyBlueText: { color: '#2b7fff', fontWeight: '500', marginLeft: 4 },

  revenueBox: { alignItems: 'flex-end' },
  revenuePriceText: { fontSize: 16, fontWeight: 'bold', color: '#2b7fff' },
  revenueLabelText: { fontSize: 12, color: '#555', marginTop: 1 },

  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 14 }
});