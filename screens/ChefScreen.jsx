// File: screens/ChefScreen.jsx
import React, { useState, useEffect, useRef } from 'react'; // 🟢 1. เพิ่ม useRef
import { 
  View, Text, StyleSheet, ScrollView, SafeAreaView, 
  TouchableOpacity, Image, ActivityIndicator, Platform, Alert
} from 'react-native';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function ChefScreen({ navigation }) {
  useEffect(() => {
    if (Platform.OS === 'web') {
      const savedRole = localStorage.getItem('userRole');
      if (savedRole !== 'chef') {
        navigation.replace('Login', { role: 'chef' });
      }
    }
  }, []);

  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('รอทำ');

  // 🟢 2. เพิ่มระบบดักฟังและส่งเสียงแจ้งเตือน "Ding!" เมื่อมีออเดอร์ใหม่เข้ามา
  const isFirstLoadOrder = useRef(true);

  const getNotifiedOrderIds = () => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const saved = sessionStorage.getItem('notified_kitchen_order_ids');
        return saved ? new Set(JSON.parse(saved)) : new Set();
      } catch (e) {
        return new Set();
      }
    }
    return new Set();
  };

  const saveNotifiedOrderIds = (setOfIds) => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.setItem('notified_kitchen_order_ids', JSON.stringify(Array.from(setOfIds)));
      } catch (e) {}
    }
  };

  const playDingSound = () => {
    try {
      if (typeof window !== 'undefined') {
        const soundFile = require('../sound/Ding2.mp3');
        const audio = new Audio(soundFile);
        audio.currentTime = 0;
        audio.play().catch((e) => console.log("Audio Play Error:", e));
      }
    } catch (e) {
      console.log("Audio Error:", e);
    }
  };

  useEffect(() => {
    const ordersRef = collection(db, 'Order_Detail');
    const q = query(ordersRef, orderBy('OrderDateTime', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data
        };
      });

      // 🟢 ตรวจสอบรายการออเดอร์สั่งใหม่ (รอทำ) ที่ยังไม่เคยส่งเสียงแจ้งเตือน
      const notifiedSet = getNotifiedOrderIds();
      let hasNewOrder = false;

      fetchedOrders.forEach((order) => {
        const isPending = order.OrderStatus === 'รอทำ' || order.OrderStatus === 'pending';
        if (isPending && !notifiedSet.has(order.id)) {
          hasNewOrder = true;
          notifiedSet.add(order.id);
        }
      });

      if (isFirstLoadOrder.current) {
        isFirstLoadOrder.current = false;
        saveNotifiedOrderIds(notifiedSet);
      } else if (hasNewOrder) {
        playDingSound(); // เล่นเสียงทันทีเมื่อมีออเดอร์ใหม่เข้ามา
        saveNotifiedOrderIds(notifiedSet);
      }

      setOrders(fetchedOrders);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching kitchen orders: ", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const pendingCount = orders.filter(o => o.OrderStatus === 'รอทำ' || o.OrderStatus === 'pending').length;
  const cookingCount = orders.filter(o => o.OrderStatus === 'กำลังทำ' || o.OrderStatus === 'cooking').length;
  const readyCount = orders.filter(o => o.OrderStatus === 'พร้อมเสิร์ฟ' || o.OrderStatus === 'ready').length;

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'รอทำ') return order.OrderStatus === 'รอทำ' || order.OrderStatus === 'pending';
    if (activeTab === 'กำลังทำ') return order.OrderStatus === 'กำลังทำ' || order.OrderStatus === 'cooking';
    if (activeTab === 'พร้อมเสิร์ฟ') return order.OrderStatus === 'พร้อมเสิร์ฟ' || order.OrderStatus === 'ready';
    return true;
  });

  const handleUpdateStatus = async (orderId, currentStatus) => {
    try {
      let nextStatus = 'กำลังทำ';
      if (currentStatus === 'รอทำ' || currentStatus === 'pending') {
        nextStatus = 'กำลังทำ';
      } else if (currentStatus === 'กำลังทำ' || currentStatus === 'cooking') {
        nextStatus = 'พร้อมเสิร์ฟ';
      }

      const orderRef = doc(db, 'Order_Detail', orderId);
      await updateDoc(orderRef, {
        OrderStatus: nextStatus
      });
    } catch (error) {
      console.error("Error updating order status:", error);
      if (typeof window !== 'undefined' && window.alert) {
        window.alert("เกิดข้อผิดพลาดในการอัปเดตสถานะ");
      }
    }
  };

  const handleCancelOrder = async (orderId, menuName) => {
    const confirmMessage = `คุณต้องการยกเลิกเมนู "${menuName}" (เนื่องจากวัตถุดิบหมด / ทำไม่ได้) ใช่หรือไม่?`;

    const executeCancel = async () => {
      try {
        const orderRef = doc(db, 'Order_Detail', orderId);
        await updateDoc(orderRef, {
          OrderStatus: 'ยกเลิก (วัตถุดิบหมด)'
        });
      } catch (error) {
        console.error("Error cancelling order:", error);
        if (Platform.OS === 'web') {
          window.alert("เกิดข้อผิดพลาดในการยกเลิกรายการ");
        } else {
          Alert.alert("ข้อผิดพลาด", "ไม่สามารถยกเลิกรายการได้");
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        executeCancel();
      }
    } else {
      Alert.alert(
        "ยืนยันการยกเลิกเมนู",
        confirmMessage,
        [
          { text: "ยกเลิก", style: "cancel" },
          { text: "ยืนยัน (ยกเลิกรายการ)", style: "destructive", onPress: executeCancel }
        ]
      );
    }
  };

  const formatTime = (dateTime) => {
    if (!dateTime) return '11:00:00';
    let dateObj;
    if (dateTime.toDate) {
      dateObj = dateTime.toDate();
    } else {
      dateObj = new Date(dateTime);
    }
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4b8df8" />
        <Text style={styles.loadingText}>กำลังดึงรายการคิวออเดอร์ครัว...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topHeaderBar}>
        <View>
          <Text style={styles.headerMainTitle}>คิวออเดอร์ครัว</Text>
          <Text style={styles.headerSubTitle}>พ่อครัว</Text>
        </View>

        <TouchableOpacity 
          style={styles.logoutBtn} 
          onPress={() => {
            if (Platform.OS === 'web') {
              localStorage.removeItem('userRole');
            }
            navigation.replace('Login', { role: 'chef' });
          }}
        >
          <Text style={styles.logoutBtnText}>ออกจากระบบ</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.mainContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryRow}>
          <TouchableOpacity 
            style={[styles.summaryCard, styles.cardYellow, activeTab === 'รอทำ' && styles.cardActive]} 
            onPress={() => setActiveTab('รอทำ')}
            activeOpacity={0.8}
          >
            <Text style={styles.summaryCardTitle}>รอทำ</Text>
            <View style={styles.summaryCardContent}>
              <View style={styles.iconCircleBlack}>
                <Text style={styles.iconTextWhite}>🕒</Text>
              </View>
              <Text style={styles.summaryCountText}>{pendingCount}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.summaryCard, styles.cardBlue, activeTab === 'กำลังทำ' && styles.cardActive]} 
            onPress={() => setActiveTab('กำลังทำ')}
            activeOpacity={0.8}
          >
            <Text style={styles.summaryCardTitle}>กำลังทำ</Text>
            <View style={styles.summaryCardContent}>
              <View style={styles.iconCircleWhite}>
                <Text style={styles.iconTextBlack}>👨‍🍳</Text>
              </View>
              <Text style={styles.summaryCountText}>{cookingCount}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.summaryCard, styles.cardGreen, activeTab === 'พร้อมเสิร์ฟ' && styles.cardActive]} 
            onPress={() => setActiveTab('พร้อมเสิร์ฟ')}
            activeOpacity={0.8}
          >
            <Text style={styles.summaryCardTitle}>พร้อมเสิร์ฟ</Text>
            <View style={styles.summaryCardContent}>
              <View style={styles.iconCircleBlack}>
                <Text style={styles.iconTextWhite}>🍳</Text>
              </View>
              <Text style={styles.summaryCountText}>{readyCount}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.ordersListContainer}>
          {filteredOrders.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>ไม่มีรายการออเดอร์ในหมวด "{activeTab}"</Text>
            </View>
          ) : (
            filteredOrders.map((order) => {
              const isPending = order.OrderStatus === 'รอทำ' || order.OrderStatus === 'pending';
              const isCooking = order.OrderStatus === 'กำลังทำ' || order.OrderStatus === 'cooking';

              return (
                <View key={order.id} style={styles.orderCard}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.tableNumberText}>
                      โต๊ะ: {order.TableNumber || order.TableID || '1'}
                    </Text>
                    <Text style={styles.menuNameText}>
                      {order.MenuName || 'เมนูอาหาร'}
                    </Text>
                    
                    <TouchableOpacity 
                      onPress={() => handleCancelOrder(order.id, order.MenuName || 'เมนูอาหาร')}
                      activeOpacity={0.6}
                      style={{ padding: 4 }}
                    >
                      <Text style={styles.timeAlertText}>
                        ⚠️ {formatTime(order.OrderDateTime)}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.cardBodyRow}>
                    {order.Image ? (
                      <Image source={{ uri: order.Image }} style={styles.foodImage} />
                    ) : (
                      <View style={[styles.foodImage, styles.noImagePlaceholder]}>
                        <Text style={styles.noImageText}>ไม่มีรูปภาพ</Text>
                      </View>
                    )}

                    <View style={styles.qtyContainer}>
                      <Text style={styles.qtyText}>จำนวน: {order.Quantity || 1}</Text>
                    </View>
                  </View>

                  {order.Note ? (
                    <View style={styles.noteYellowBox}>
                      <Text style={styles.noteText}>
                        📝 หมายเหตุ: {order.Note}
                      </Text>
                    </View>
                  ) : null}

                  {isPending && (
                    <TouchableOpacity 
                      style={styles.btnBlueAction}
                      onPress={() => handleUpdateStatus(order.id, order.OrderStatus)}
                    >
                      <Text style={styles.btnActionText}>เริ่มทำ</Text>
                    </TouchableOpacity>
                  )}

                  {isCooking && (
                    <TouchableOpacity 
                      style={styles.btnGreenAction}
                      onPress={() => handleUpdateStatus(order.id, order.OrderStatus)}
                    >
                      <Text style={styles.btnActionText}>ทำเสร็จแล้ว (พร้อมเสิร์ฟ)</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#e2e2e2' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#333' },
  topHeaderBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: '#dcdcdc', 
    paddingVertical: 14, 
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderColor: '#cccccc'
  },
  headerMainTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  headerSubTitle: { fontSize: 14, color: '#555', marginTop: 2 },
  logoutBtn: { 
    backgroundColor: '#ffffff', 
    paddingVertical: 6, 
    paddingHorizontal: 14, 
    borderRadius: 18, 
    borderWidth: 1, 
    borderColor: '#bbb',
    elevation: 1
  },
  logoutBtnText: { fontSize: 13, fontWeight: 'bold', color: '#333' },
  mainContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 20 },
  summaryCard: { 
    flex: 1, 
    borderRadius: 16, 
    padding: 12, 
    elevation: 2, 
    borderWidth: 2, 
    borderColor: 'transparent' 
  },
  cardActive: { borderColor: '#444444' },
  cardYellow: { backgroundColor: '#fef08a' },
  cardBlue: { backgroundColor: '#e0f2fe' },
  cardGreen: { backgroundColor: '#bbf7d0' },
  summaryCardTitle: { fontSize: 16, fontWeight: 'bold', color: '#222', textAlign: 'center', marginBottom: 6 },
  summaryCardContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  iconCircleBlack: { backgroundColor: '#000000', borderRadius: 15, width: 30, height: 30, justifyContent: 'center', alignItems: 'center' },
  iconCircleWhite: { backgroundColor: '#ffffff', borderRadius: 15, width: 30, height: 30, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ccc' },
  iconTextWhite: { fontSize: 14, color: '#fff' },
  iconTextBlack: { fontSize: 14, color: '#000' },
  summaryCountText: { fontSize: 24, fontWeight: 'bold', color: '#111' },
  ordersListContainer: { alignItems: 'center' },
  emptyBox: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#666' },
  orderCard: { 
    width: '100%', 
    backgroundColor: '#ffffff', 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: '#d1d5db',
    elevation: 2
  },
  cardHeaderRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  tableNumberText: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  menuNameText: { fontSize: 18, fontWeight: 'bold', color: '#222', flex: 1, marginLeft: 16 },
  timeAlertText: { fontSize: 15, fontWeight: 'bold', color: '#d9534f' },
  cardBodyRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  foodImage: { width: 90, height: 70, borderRadius: 10, backgroundColor: '#eee', marginRight: 14 },
  noImagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  noImageText: { fontSize: 11, color: '#888' },
  qtyContainer: { justifyContent: 'center', paddingTop: 4 },
  qtyText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  noteYellowBox: { 
    backgroundColor: '#fef9c3', 
    paddingVertical: 8, 
    paddingHorizontal: 12, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#fde047', 
    marginBottom: 12 
  },
  noteText: { fontSize: 14, fontWeight: '600', color: '#854d0e' },
  btnBlueAction: { 
    backgroundColor: '#4b8df8', 
    paddingVertical: 12, 
    borderRadius: 20, 
    alignItems: 'center',
    width: '100%'
  },
  btnGreenAction: { 
    backgroundColor: '#22c55e', 
    paddingVertical: 12, 
    borderRadius: 20, 
    alignItems: 'center',
    width: '100%'
  },
  btnActionText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' }
});