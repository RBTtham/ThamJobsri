// File: screens/OrderHistoryScreen.jsx
import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, SafeAreaView, 
  TouchableOpacity, ActivityIndicator, Platform, Alert 
} from 'react-native';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function OrderHistoryScreen({ route, navigation }) {
  // 🟢 1. ฟังก์ชันดึงเลขโต๊ะ
  const getTableNumber = () => {
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

  // 🟢 2. ฟังก์ชันดึง SessionToken จาก Route Params หรือ URL
  const getSessionToken = () => {
    if (route.params?.sessionToken) return String(route.params.sessionToken);
    if (route.params?.session) return String(route.params.session);

    if (typeof window !== 'undefined' && window.location) {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('session') || urlParams.get('sessionToken');
        if (token) return token;

        const match = window.location.href.match(/[?&](?:session|sessionToken)=([a-zA-Z0-9\-_]+)/i);
        if (match && match[1]) return match[1];
      } catch (e) {
        console.error("Error parsing URL session:", e);
      }
    }
    return null;
  };

  const tableNumber = getTableNumber();
  const sessionToken = getSessionToken();

  const [ordersGrouped, setOrdersGrouped] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🟢 ฟังก์ชันจัดการการย้อนกลับ
  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Menu', { tableNumber, sessionToken });
    }
  };

  // 🟢 ฟังก์ชันลบรายการอาหาร (เฉพาะสถานะ รอทำ)
  const handleDeleteOrderItem = (orderId, menuName) => {
    const confirmMessage = `คุณต้องการยกเลิกรายการ "${menuName}" ใช่หรือไม่?`;

    const executeDelete = async () => {
      try {
        await deleteDoc(doc(db, 'Order_Detail', orderId));
      } catch (error) {
        console.error("❌ Error deleting order item:", error);
        if (Platform.OS === 'web') {
          window.alert("เกิดข้อผิดพลาดในการยกเลิกรายการ");
        } else {
          Alert.alert("ข้อผิดพลาด", "ไม่สามารถยกเลิกรายการได้");
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        executeDelete();
      }
    } else {
      Alert.alert(
        "ยืนยันการยกเลิก",
        confirmMessage,
        [
          { text: "ยกเลิก", style: "cancel" },
          { text: "ตกลง (ลบ)", style: "destructive", onPress: executeDelete }
        ]
      );
    }
  };

  useEffect(() => {
    const tableVariants = [String(tableNumber)];
    if (!isNaN(Number(tableNumber))) {
      tableVariants.push(Number(tableNumber));
    }

    let q;
    if (sessionToken) {
      q = query(
        collection(db, 'Order_Detail'),
        where('TableNumber', 'in', tableVariants),
        where('SessionToken', '==', sessionToken)
      );
    } else {
      q = query(
        collection(db, 'Order_Detail'),
        where('TableNumber', 'in', tableVariants)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const groups = {};
      docs.forEach(item => {
        const key = item.OrderDateTime || item.orderDateTime || 'NO_DATE';
        if (!groups[key]) {
          groups[key] = {
            dateTime: key,
            items: []
          };
        }
        groups[key].items.push(item);
      });

      const sortedGroups = Object.values(groups).sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
      setOrdersGrouped(sortedGroups);
      setLoading(false);
    }, (error) => {
      console.error("❌ Firestore Snapshot Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tableNumber, sessionToken]);

  const formatTime = (isoString) => {
    if (!isoString || isoString === 'NO_DATE') return 'ไม่ระบุเวลา';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'ไม่ระบุเวลา';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes} น.`;
  };

  // 🟢 แสดง Badge ตามสถานะอาหาร (รวมสถานะยกเลิกจากเชฟ)
  const renderItemStatusBadge = (status) => {
    const s = status || '';
    if (s.includes('ยกเลิก')) {
      return (
        <View style={[styles.itemStatusBadge, { backgroundColor: '#d9534f' }]}>
          <Text style={styles.itemStatusText}>ยกเลิก (วัตถุดิบหมด)</Text>
        </View>
      );
    } else if (s === 'เสิร์ฟแล้ว' || s === 'เสร็จแล้ว') {
      return (
        <View style={[styles.itemStatusBadge, { backgroundColor: '#063cb1' }]}>
          <Text style={styles.itemStatusText}>เสิร์ฟแล้ว</Text>
        </View>
      );
    } else if (s === 'พร้อมเสิร์ฟ') {
      return (
        <View style={[styles.itemStatusBadge, { backgroundColor: '#0a7900' }]}>
          <Text style={styles.itemStatusText}>พร้อมเสิร์ฟ</Text>
        </View>
      );
    } else if (s === 'กำลังทำ' || s === 'กำลังทำอาหาร') {
      return (
        <View style={[styles.itemStatusBadge, { backgroundColor: '#0089b3' }]}>
          <Text style={styles.itemStatusText}>กำลังทำ</Text>
        </View>
      );
    } else {
      return (
        <View style={[styles.itemStatusBadge, { backgroundColor: '#eee786' }]}>
          <Text style={styles.itemStatusText1}>รอทำ</Text>
        </View>
      );
    }
  };

  // 🟢 คำนวณราคารวม (ยกเว้นรายการที่ถูกยกเลิก)
  const grandTotal = ordersGrouped.reduce((total, group) => {
    return total + group.items.reduce((sum, item) => {
      const status = item.OrderStatus || item.orderStatus || item.Status || '';
      if (status.includes('ยกเลิก')) {
        return sum;
      }
      return sum + ((item.Price || item.price || 0) * (item.Quantity || item.quantity || 1));
    }, 0);
  }, 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
            <Text style={styles.backArrow}>↩</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>รายการที่สั่ง</Text>
            <Text style={styles.headerSubTitle}>โต๊ะหมายเลข : {tableNumber}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#4b8df8" style={{ marginTop: 50 }} />
        ) : (
          <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
            {ordersGrouped.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>🛒 ยังไม่มีรายการอาหารที่สั่งในโต๊ะนี้</Text>
              </View>
            ) : (
              ordersGrouped.map((group, index) => (
                <View style={styles.orderCard} key={index}>

                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.orderIdText}>Order ID: {ordersGrouped.length - index}</Text>
                      <Text style={styles.timeText}>{formatTime(group.dateTime)}</Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  {group.items.map((item, idx) => {
                    const itemStatus = item.OrderStatus || item.orderStatus || item.Status || 'รอทำ';
                    const isPending = itemStatus === 'รอทำ' || itemStatus === 'pending';
                    const isCancelled = itemStatus.includes('ยกเลิก');

                    return (
                      <View style={styles.itemRow} key={item.id || idx}>
                        <View style={styles.itemLeftCol}>
                          <Text style={[styles.itemNameText, isCancelled && styles.cancelledText]}>
                            {item.MenuName || item.menuName} x{item.Quantity || item.quantity}
                          </Text>
                          
                          <View style={styles.statusRowContainer}>
                            {renderItemStatusBadge(itemStatus)}
                            
                            {/* แสดงปุ่มยกเลิกเฉพาะรายการที่สถานะรอทำ */}
                            {isPending && (
                              <TouchableOpacity 
                                style={styles.cancelBtn} 
                                onPress={() => handleDeleteOrderItem(item.id, item.MenuName || item.menuName)}
                              >
                                <Text style={styles.cancelBtnText}>🗑️ ยกเลิกรายการ</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>

                        <Text style={[styles.itemPriceText, isCancelled && styles.cancelledPriceText]}>
                          {isCancelled ? '0 บาท' : `${((item.Price || item.price || 0) * (item.Quantity || item.quantity || 1))} บาท`}
                        </Text>
                      </View>
                    );
                  })}

                </View>
              ))
            )}
          </ScrollView>
        )}

        <View style={styles.footerSummary}>
          <Text style={styles.footerText}>
            {ordersGrouped.length} Order : <Text style={styles.footerPrice}>{grandTotal} บาท</Text>
          </Text>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#c8c8c8' },
  container: { flex: 1 },
  header: { alignItems: 'center', paddingTop: 15, paddingBottom: 10, position: 'relative' },
  backBtn: { position: 'absolute', left: 16, top: 15 },
  backArrow: { fontSize: 28, color: '#222' },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: '#111' },
  headerSubTitle: { fontSize: 16, color: '#333', marginTop: 2 },
  scrollList: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 16, color: '#666' },
  orderCard: { backgroundColor: '#f2f2f2', borderRadius: 18, padding: 16, marginBottom: 16, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderIdText: { fontSize: 15, color: '#333', fontWeight: 'bold' },
  timeText: { fontSize: 13, color: '#666', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#ddd', marginVertical: 10 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  itemLeftCol: { flex: 1, gap: 4 },
  itemNameText: { fontSize: 15, color: '#222', fontWeight: '600' },
  itemPriceText: { fontSize: 15, color: '#4b8df8', fontWeight: 'bold', marginLeft: 10 },
  itemStatusBadge: { alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 8 },
  itemStatusText: { fontSize: 11, fontWeight: 'bold', color: '#ffffff' },
  footerSummary: { backgroundColor: '#d8d8d8', paddingVertical: 14, alignItems: 'center', borderTopWidth: 1, borderColor: '#bbb' },
  footerText: { fontSize: 18, color: '#222', fontWeight: 'bold' },
  itemStatusText1: { fontSize: 11, fontWeight: 'bold', color: '#000000' },
  footerPrice: { color: '#4b8df8' },
  statusRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2
  },
  cancelBtn: {
    backgroundColor: '#fee2e2',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fca5a5'
  },
  cancelBtnText: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: 'bold'
  },
  // 🟢 สไตล์เพิ่มเติมเมื่อรายการถูกยกเลิก
  cancelledText: {
    textDecorationLine: 'line-through',
    color: '#888888',
  },
  cancelledPriceText: {
    color: '#d9534f',
    textDecorationLine: 'line-through',
  }
});