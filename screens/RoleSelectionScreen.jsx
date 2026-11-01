import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, 
  Dimensions, Platform, ScrollView, ActivityIndicator, Image 
} from 'react-native';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

const { width } = Dimensions.get('window');

export default function RoleSelectionScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'tables' | 'sales'
  
  // State สำหรับข้อมูลโต๊ะ
  const [tables, setTables] = useState([]);
  const [isLoadingTables, setIsLoadingTables] = useState(true);

  // State สำหรับข้อมูลอันดับยอดขาย
  const [salesRankings, setSalesRankings] = useState([]);
  const [totalSalesCount, setTotalSalesCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [isLoadingSales, setIsLoadingSales] = useState(true);

  // 🟢 1. ดึงข้อมูลสถานะโต๊ะอาหาร (Realtime)
  useEffect(() => {
    const tablesCollection = collection(db, 'Table');
    const unsubscribe = onSnapshot(tablesCollection, (snapshot) => {
      let fetchedTables = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedTables.sort((a, b) => Number(a.tableNumber) - Number(b.tableNumber));
      setTables(fetchedTables);
      setIsLoadingTables(false);
    }, (error) => {
      console.error("Error fetching tables: ", error);
      setIsLoadingTables(false);
    });
    return () => unsubscribe();
  }, []);

  // 🟢 2. ดึงข้อมูลจาก Collection Report และเชื่อม MenuID เข้ากับ Collection Menu
  useEffect(() => {
    if (activeTab === 'sales') {
      setIsLoadingSales(true);

      const menuRef = collection(db, 'Menu');
      const reportRef = collection(db, 'Report');

      // ดึงรายชื่อเมนูเพื่อทำ Mapping (MenuID -> MenuName)
      const unsubscribeMenu = onSnapshot(menuRef, (menuSnap) => {
        const menuNameMap = {};
        menuSnap.docs.forEach((doc) => {
          const data = doc.data();
          menuNameMap[doc.id] = data.MenuName || data.menuName || data.name || 'ไม่ระบุชื่อ';
        });

        // ดึงรายการขายจาก Report
        const unsubscribeReport = onSnapshot(reportRef, (reportSnap) => {
          const itemMap = {};
          let totalQtySum = 0;
          let totalRevenueSum = 0;

          reportSnap.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const menuId = data.MenuID || data.menuId;
            
            // ค้นหาชื่อเมนูจาก MenuID
            const name = menuNameMap[menuId] || data.MenuName || (menuId ? `เมนู (${menuId.substring(0, 5)})` : `รายการ #${docSnap.id.substring(0, 5)}`);

            const qty = Number(data.Quantity || data.quantity || data.TotalOrders || 0);
            const revenue = Number(data.TotalRevenue || data.totalRevenue || (data.Price * qty) || 0);

            if (!itemMap[name]) {
              itemMap[name] = { 
                name, 
                quantity: 0, 
                revenue: 0 
              };
            }
            itemMap[name].quantity += qty;
            itemMap[name].revenue += revenue;

            totalQtySum += qty;
            totalRevenueSum += revenue;
          });

          // เรียงลำดับเมนูตามจำนวนที่ขายได้จากมากไปน้อย
          const rankedArray = Object.values(itemMap).sort((a, b) => b.quantity - a.quantity);

          setSalesRankings(rankedArray);
          setTotalSalesCount(totalQtySum);
          setTotalRevenue(totalRevenueSum);
          setIsLoadingSales(false);
        }, (error) => {
          console.error("Error fetching Report collection: ", error);
          setIsLoadingSales(false);
        });

        return () => unsubscribeReport();
      }, (error) => {
        console.error("Error fetching Menu collection: ", error);
        setIsLoadingSales(false);
      });

      return () => unsubscribeMenu();
    }
  }, [activeTab]);

  const availableCount = tables.filter(t => t.status !== 'occupied').length;
  const occupiedCount = tables.filter(t => t.status === 'occupied').length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mainContainer}>
        
        {/* ----------------- 📍 ฝั่งซ้าย: Sidebar Menu ----------------- */}
        <View style={styles.sidebar}>
          <View style={styles.shopLogoBox}>
            {/* 🟢 แสดงรูปโลโก้แทน 🏮 */}
            <Image 
              source={require('../assets/logoshop.jpg')} // ปรับ path รูปภาพตามโฟลเดอร์ในโปรเจกต์
              style={styles.shopLogoImage}
              resizeMode="contain"
            />
            <Text style={styles.shopNameText}>ร้านยายจุด</Text>
            <Text style={styles.shopSubtitle}>ระบบบริหารจัดการร้านอาหาร</Text>
          </View>

          <View style={styles.menuListGroup}>
            <TouchableOpacity 
              style={[styles.menuItemRow, activeTab === 'login' && styles.menuItemRowActive]} 
              onPress={() => setActiveTab('login')}
              activeOpacity={0.8}
            >
              <View style={[styles.radioDot, activeTab === 'login' && styles.radioDotActive]} />
              <Text style={[styles.menuItemText, activeTab === 'login' && styles.menuItemTextActive]}>
                🔑 เข้าสู่ระบบ
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItemRow, activeTab === 'tables' && styles.menuItemRowActive]} 
              onPress={() => setActiveTab('tables')}
              activeOpacity={0.8}
            >
              <View style={[styles.radioDot, activeTab === 'tables' && styles.radioDotActive]} />
              <Text style={[styles.menuItemText, activeTab === 'tables' && styles.menuItemTextActive]}>
                🪑 สถานะโต๊ะ ({availableCount}/{tables.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItemRow, activeTab === 'sales' && styles.menuItemRowActive]} 
              onPress={() => setActiveTab('sales')}
              activeOpacity={0.8}
            >
              <View style={[styles.radioDot, activeTab === 'sales' && styles.radioDotActive]} />
              <Text style={[styles.menuItemText, activeTab === 'sales' && styles.menuItemTextActive]}>
                📊 อันดับยอดขายทั้งหมด
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sidebarFooter}>
            
          </View>
        </View>

        {/* ----------------- 📍 ฝั่งขวา: Main Content ----------------- */}
        <View style={styles.contentArea}>
          
          {/* TAB 1: เลือกตำแหน่ง */}
          {activeTab === 'login' && (
            <ScrollView style={styles.tabContentContainer} showsVerticalScrollIndicator={false}>
              <Text style={styles.headerPageTitle}>เข้าสู่ระบบตามตำแหน่งการทำงาน</Text>
              <Text style={styles.headerPageSubtitle}>เลือกบทบาทหน้าที่ของคุณเพื่อเข้าสู่ระบบการจัดการ</Text>

              <View style={styles.cardsStack}>
                <TouchableOpacity 
                  style={[styles.roleCard, styles.staffCard]} 
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('Login', { role: 'staff' })}
                >
                  <View style={[styles.iconCircleBox, { backgroundColor: '#3b82f6' }]}>
                    <Text style={styles.cardEmojiIcon}>🛎️</Text>
                  </View>
                  <View style={styles.cardTextContent}>
                    <Text style={styles.roleTitleText}>พนักงานบริการ (Staff)</Text>
                    <Text style={styles.roleSubTitleText}>เปิดโต๊ะ, สแกน QR Code, รับ Order & ชำระเงิน</Text>
                  </View>
                  <Text style={styles.arrowIcon}>➔</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.roleCard, styles.chefCard]} 
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('Login', { role: 'chef' })}
                >
                  <View style={[styles.iconCircleBox, { backgroundColor: '#f59e0b' }]}>
                    <Text style={styles.cardEmojiIcon}>👨‍🍳</Text>
                  </View>
                  <View style={styles.cardTextContent}>
                    <Text style={styles.roleTitleText}>พ่อครัว / ห้องครัว (Chef)</Text>
                    <Text style={styles.roleSubTitleText}>จัดการรายการอาหารสำหรับปรุง และสถานะพร้อมเสิร์ฟ</Text>
                  </View>
                  <Text style={styles.arrowIcon}>➔</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.roleCard, styles.adminCard]} 
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('AdminLogin')}
                >
                  <View style={[styles.iconCircleBox, { backgroundColor: '#ef4444' }]}>
                    <Text style={styles.cardEmojiIcon}>👤</Text>
                  </View>
                  <View style={styles.cardTextContent}>
                    <Text style={styles.roleTitleText}>ผู้ดูแลระบบ (Admin)</Text>
                    <Text style={styles.roleSubTitleText}>จัดการรายการเมนูอาหาร, ราคา และรายงานการขาย</Text>
                  </View>
                  <Text style={styles.arrowIcon}>➔</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* TAB 2: ผังสถานะโต๊ะ */}
          {activeTab === 'tables' && (
            <ScrollView style={styles.tabContentContainer} showsVerticalScrollIndicator={false}>
              <Text style={styles.headerPageTitle}>ผังการจัดโต๊ะ & สถานะการใช้งาน Realtime</Text>
              
              <View style={styles.summaryRow}>
                <View style={[styles.summaryCard, styles.summaryGreen]}>
                  <Text style={styles.summaryLabel}>🟢 โต๊ะว่างพร้อมบริการ</Text>
                  <Text style={styles.summaryValueGreen}>{availableCount}</Text>
                  <Text style={styles.summaryUnit}>จากทั้งหมด {tables.length} โต๊ะ</Text>
                </View>

                <View style={[styles.summaryCard, styles.summaryRed]}>
                  <Text style={styles.summaryLabel}>🔴 โต๊ะมีลูกค้ากำลังใช้งาน</Text>
                  <Text style={styles.summaryValueRed}>{occupiedCount}</Text>
                  <Text style={styles.summaryUnit}>กำลังใช้บริการอยู่</Text>
                </View>
              </View>

              {isLoadingTables ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color="#3b82f6" />
                  <Text style={styles.loadingText}>กำลังอัปเดตข้อมูลสถานะโต๊ะ...</Text>
                </View>
              ) : (
                <View style={styles.tablesGrid}>
                  {tables.map((table) => {
                    const isOccupied = table.status === 'occupied';
                    return (
                      <View 
                        key={table.id} 
                        style={[
                          styles.tableBox, 
                          isOccupied ? styles.tableBoxOccupied : styles.tableBoxAvailable
                        ]}
                      >
                        <Text style={styles.tableBoxNumber}>โต๊ะ {table.tableNumber}</Text>
                        <View style={[styles.badge, isOccupied ? styles.badgeRed : styles.badgeGreen]}>
                          <Text style={[styles.badgeText, isOccupied ? styles.badgeTextRed : styles.badgeTextGreen]}>
                            {isOccupied ? '🔴 มีลูกค้า' : '🟢 ว่างอยู่'}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          )}

          {/* TAB 3: อันดับยอดขายทั้งหมด (Report + Menu Name Mapping) */}
          {activeTab === 'sales' && (
            <ScrollView style={styles.tabContentContainer} showsVerticalScrollIndicator={false}>
              <Text style={styles.headerPageTitle}>📈 สรุปรายงานอันดับยอดขายทุกเมนู</Text>
              <Text style={styles.headerPageSubtitle}>แสดงอันดับยอดขายของทุกรายการอาหารตามข้อมูลคอลเลกชัน Report</Text>

              <View style={styles.summaryRow}>
                <View style={[styles.summaryCard, styles.summaryBlue]}>
                  <Text style={styles.summaryLabel}>🍱 รวมรายการขายทั้งหมด</Text>
                  <Text style={styles.summaryValueBlue}>{totalSalesCount}</Text>
                  <Text style={styles.summaryUnit}>จาน / รายการ</Text>
                </View>

                <View style={[styles.summaryCard, styles.summaryGold]}>
                  <Text style={styles.summaryLabel}>🏆 เมนูขายดีอันดับ #1</Text>
                  <Text style={styles.summaryValueGold} numberOfLines={1}>
                    {salesRankings.length > 0 ? salesRankings[0].name : '-'}
                  </Text>
                  <Text style={styles.summaryUnit}>
                    {salesRankings.length > 0 ? `ขายได้ ${salesRankings[0].quantity} จาน` : 'ยังไม่มีข้อมูล'}
                  </Text>
                </View>
              </View>

              {isLoadingSales ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color="#f59e0b" />
                  <Text style={styles.loadingText}>กำลังดึงข้อมูลรายงานยอดขาย...</Text>
                </View>
              ) : salesRankings.length === 0 ? (
                <View style={styles.emptySalesBox}>
                  <Text style={styles.emptySalesIcon}>📊</Text>
                  <Text style={styles.emptySalesText}>ยังไม่มีรายการยอดขายสะสมในระบบ</Text>
                </View>
              ) : (
                <View style={styles.rankingSection}>
                  
                  {/* Top 3 Podium */}
                  <View style={styles.podiumContainer}>
                    {salesRankings[0] && (
                      <View style={[styles.podiumCard, styles.podiumFirst]}>
                        <View style={styles.crownBadge}><Text style={{fontSize: 22}}>🥇</Text></View>
                        <Text style={styles.podiumRankText}>อันดับ 1</Text>
                        <Text style={styles.podiumTitleText} numberOfLines={2}>{salesRankings[0].name}</Text>
                        <Text style={styles.podiumQtyText}>{salesRankings[0].quantity} จาน</Text>
                      </View>
                    )}

                    {salesRankings[1] && (
                      <View style={[styles.podiumCard, styles.podiumSecond]}>
                        <View style={styles.crownBadge}><Text style={{fontSize: 22}}>🥈</Text></View>
                        <Text style={styles.podiumRankText}>อันดับ 2</Text>
                        <Text style={styles.podiumTitleText} numberOfLines={2}>{salesRankings[1].name}</Text>
                        <Text style={styles.podiumQtyText}>{salesRankings[1].quantity} จาน</Text>
                      </View>
                    )}

                    {salesRankings[2] && (
                      <View style={[styles.podiumCard, styles.podiumThird]}>
                        <View style={styles.crownBadge}><Text style={{fontSize: 22}}>🥉</Text></View>
                        <Text style={styles.podiumRankText}>อันดับ 3</Text>
                        <Text style={styles.podiumTitleText} numberOfLines={2}>{salesRankings[2].name}</Text>
                        <Text style={styles.podiumQtyText}>{salesRankings[2].quantity} จาน</Text>
                      </View>
                    )}
                  </View>

                  {/* ตารางแสดงเมนูอาหารทั้งหมด */}
                  <Text style={styles.subTableTitle}>📋 รายการขายทั้งหมดในระบบ ({salesRankings.length} รายการ)</Text>
                  <View style={styles.tableContainer}>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.tableHeaderCell, { width: 70 }]}>อันดับ</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1 }]}>ชื่อเมนูอาหาร (MenuName)</Text>
                      <Text style={[styles.tableHeaderCell, { width: 140, textAlign: 'right' }]}>จำนวนที่ขายได้</Text>
                    </View>

                    {salesRankings.map((item, index) => (
                      <View key={index} style={[styles.tableDataRow, index % 2 === 1 && styles.tableRowEven]}>
                        <View style={[styles.tableDataCell, { width: 70 }]}>
                          <View style={[
                            styles.rankNumberBadge,
                            index === 0 ? styles.bgGold : index === 1 ? styles.bgSilver : index === 2 ? styles.bgBronze : styles.bgDefault
                          ]}>
                            <Text style={styles.rankNumberText}>{index + 1}</Text>
                          </View>
                        </View>
                        <Text style={[styles.tableDataCell, { flex: 1, fontWeight: 'bold', color: '#1e293b' }]}>
                          {item.name}
                        </Text>
                        <Text style={[styles.tableDataCell, { width: 140, textAlign: 'right', fontWeight: 'bold', color: '#2563eb' }]}>
                          {item.quantity} จาน
                        </Text>
                      </View>
                    ))}
                  </View>

                </View>
              )}
            </ScrollView>
          )}

        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  mainContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: Platform.OS === 'web' ? 280 : 230,
    backgroundColor: '#0f172a',
    paddingVertical: 35,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shopLogoBox: {
    alignItems: 'center',
    marginBottom: 35,
  },
  // 🟢 สไตล์รูปภาพโลโก้ใหม่
  shopLogoImage: {
    width: 85,
    height: 85,
    marginBottom: 12,
  },
  shopNameText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  shopSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  menuListGroup: {
    width: '100%',
    gap: 12,
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'transparent',
  },
  menuItemRowActive: {
    backgroundColor: '#1e293b',
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#475569',
    marginRight: 12,
  },
  radioDotActive: {
    backgroundColor: '#3b82f6',
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
  },
  menuItemTextActive: {
    fontWeight: 'bold',
    color: '#ffffff',
  },
  sidebarFooter: {
    paddingTop: 20,
  },
  footerVersionText: {
    fontSize: 11,
    color: '#475569',
  },
  contentArea: {
    flex: 1,
    backgroundColor: '#dfdfdf',
    paddingVertical: 30,
    paddingHorizontal: Platform.OS === 'web' ? 45 : 20,
  },
  tabContentContainer: {
    flex: 1,
  },
  headerPageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  headerPageSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 28,
  },
  cardsStack: {
    gap: 20,
    maxWidth: 800,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 28,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
  },
  staffCard: { borderLeftWidth: 6, borderLeftColor: '#3b82f6' },
  chefCard: { borderLeftWidth: 6, borderLeftColor: '#f59e0b' },
  adminCard: { borderLeftWidth: 6, borderLeftColor: '#ef4444' },
  iconCircleBox: {
    width: 58,
    height: 58,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  cardEmojiIcon: { fontSize: 28 },
  cardTextContent: { flex: 1 },
  roleTitleText: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  roleSubTitleText: { fontSize: 13, color: '#64748b' },
  arrowIcon: { fontSize: 18, color: '#94a3b8', marginLeft: 10 },
  summaryRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 28,
    maxWidth: 800,
  },
  summaryCard: {
    flex: 1,
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryGreen: { borderTopWidth: 4, borderTopColor: '#10b981' },
  summaryRed: { borderTopWidth: 4, borderTopColor: '#ef4444' },
  summaryBlue: { borderTopWidth: 4, borderTopColor: '#3b82f6' },
  summaryGold: { borderTopWidth: 4, borderTopColor: '#f59e0b' },
  summaryLabel: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  summaryValueGreen: { fontSize: 32, fontWeight: 'bold', color: '#10b981', marginVertical: 6 },
  summaryValueRed: { fontSize: 32, fontWeight: 'bold', color: '#ef4444', marginVertical: 6 },
  summaryValueBlue: { fontSize: 32, fontWeight: 'bold', color: '#3b82f6', marginVertical: 6 },
  summaryValueGold: { fontSize: 22, fontWeight: 'bold', color: '#f59e0b', marginVertical: 8 },
  summaryUnit: { fontSize: 12, color: '#94a3b8' },
  tablesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingBottom: 40,
  },
  tableBox: {
    width: 140,
    paddingVertical: 22,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  tableBoxAvailable: { borderColor: '#10b981' },
  tableBoxOccupied: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
  tableBoxNumber: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 8 },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10 },
  badgeGreen: { backgroundColor: '#d1fae5' },
  badgeRed: { backgroundColor: '#fee2e2' },
  badgeText: { fontSize: 11, fontWeight: 'bold' },
  badgeTextGreen: { color: '#065f46' },
  badgeTextRed: { color: '#991b1b' },
  rankingSection: { maxWidth: 900, paddingBottom: 40 },
  podiumContainer: { flexDirection: 'row', gap: 16, marginBottom: 30 },
  podiumCard: {
    flex: 1,
    padding: 20,
    borderRadius: 18,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  podiumFirst: { backgroundColor: '#fffbeb', borderColor: '#fcd34d' },
  podiumSecond: { backgroundColor: '#f8fafc', borderColor: '#cbd5e1' },
  podiumThird: { backgroundColor: '#fff7ed', borderColor: '#ffedd5' },
  crownBadge: { marginBottom: 4 },
  podiumRankText: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  podiumTitleText: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', marginVertical: 6, textAlign: 'center' },
  podiumQtyText: { fontSize: 14, fontWeight: 'bold', color: '#2563eb' },
  subTableTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 14 },
  tableContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableHeaderCell: { fontSize: 13, fontWeight: 'bold', color: '#475569' },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableRowEven: { backgroundColor: '#f8fafc' },
  tableDataCell: { fontSize: 14 },
  rankNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgGold: { backgroundColor: '#f59e0b' },
  bgSilver: { backgroundColor: '#94a3b8' },
  bgBronze: { backgroundColor: '#d97706' },
  bgDefault: { backgroundColor: '#cbd5e1' },
  rankNumberText: { fontSize: 12, fontWeight: 'bold', color: '#ffffff' },
  loadingBox: { paddingVertical: 50, alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 14, color: '#64748b' },
  emptySalesBox: { paddingVertical: 60, alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0' },
  emptySalesIcon: { fontSize: 40, marginBottom: 10 },
  emptySalesText: { fontSize: 14, color: '#64748b' },
});