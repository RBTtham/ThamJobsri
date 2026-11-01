// File: screens/ServeListScreen.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Image, ActivityIndicator, Platform
} from 'react-native';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function ServeListScreen({ navigation }) {

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('EmployeeTable');
    }
  };

  useEffect(() => {
    if (Platform.OS === 'web') {
      const savedRole = localStorage.getItem('userRole');
      if (!savedRole || !['staff', 'admin', 'chef'].includes(savedRole)) {
        navigation.replace('Login', { role: 'staff' });
      }
    }
  }, []);

  const [serveItems, setServeItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 🟢 Ref และ Helper สำหรับจัดการ ID ที่เคยส่งเสียงแจ้งเตือนแล้ว (ป้องกันเสียงดังซ้ำเมื่อย้ายหน้า)
  const isFirstLoad = useRef(true);

  const getNotifiedIds = () => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const saved = sessionStorage.getItem('notified_served_order_ids');
        return saved ? new Set(JSON.parse(saved)) : new Set();
      } catch (e) {
        return new Set();
      }
    }
    return new Set();
  };

  const saveNotifiedIds = (setOfIds) => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.setItem('notified_served_order_ids', JSON.stringify(Array.from(setOfIds)));
      } catch (e) { }
    }
  };

  // 🟢 ฟังก์ชันสร้างเสียงแจ้งเตือนแบบ "Ding!" (เสียงกระดิ่งปิ๊ง!)
  const playDingSound = () => {
    try {
      if (typeof window !== 'undefined') {
        const soundFile = require('../sound/Ding1.mp3');
        const audio = new Audio(soundFile);
        audio.currentTime = 0;
        audio.play().catch((e) => console.log("Audio Play Error:", e));
      }
    } catch (e) {
      console.log("Audio Error:", e);
    }
  };

  const formatTime = (rawDate) => {
    if (!rawDate || rawDate === 'NO_DATE') return 'ไม่ระบุเวลา';
    let date;
    if (rawDate && typeof rawDate.toDate === 'function') {
      date = rawDate.toDate();
    } else {
      date = new Date(rawDate);
    }
    if (isNaN(date.getTime())) return 'ไม่ระบุเวลา';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes} น.`;
  };

  useEffect(() => {
    const ordersRef = collection(db, 'Order_Detail');

    const unsubscribe = onSnapshot(ordersRef, (snapshot) => {
      let readyList = [];

      snapshot.docs.forEach((docSnap) => {
        const orderData = docSnap.data();
        const orderId = docSnap.id;

        if (orderData.OrderStatus === 'พร้อมเสิร์ฟ' || orderData.orderStatus === 'พร้อมเสิร์ฟ') {
          const timeValue = orderData.OrderDateTime || orderData.orderDateTime;
          const formattedTime = formatTime(timeValue);

          readyList.push({
            id: orderId,
            tableNumber: orderData.TableNumber || orderData.tableNumber || '-',
            foodName: orderData.MenuName || orderData.menuName || 'รายการอาหาร',
            quantity: orderData.Quantity || orderData.quantity || 1,
            orderedAt: formattedTime,
            imageUrl: orderData.Image || orderData.image || null,
          });
        }
      });

      // 🟢 ตรวจสอบรายการใหม่ที่ยังไม่เคยส่งเสียงแจ้งเตือน
      const notifiedSet = getNotifiedIds();
      let hasNewUnnotifiedItem = false;

      readyList.forEach((item) => {
        if (!notifiedSet.has(item.id)) {
          hasNewUnnotifiedItem = true;
          notifiedSet.add(item.id);
        }
      });

      // ถ้าเป็นครั้งแรกที่เปิดหน้า ให้จดจำรายการที่มีอยู่โดยไม่ส่งเสียง
      if (isFirstLoad.current) {
        isFirstLoad.current = false;
        saveNotifiedIds(notifiedSet);
      } else if (hasNewUnnotifiedItem) {
        // เล่นเสียง Ding ทันทีเมื่อมีออเดอร์ทำเสร็จใหม่ และบันทึก ID ไว้
        playDingSound();
        saveNotifiedIds(notifiedSet);
      }

      setServeItems(readyList);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching Order_Detail:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleServed = async (itemId) => {
    try {
      const orderRef = doc(db, 'Order_Detail', itemId);
      await updateDoc(orderRef, {
        OrderStatus: 'เสิร์ฟแล้ว'
      });
    } catch (error) {
      console.error("Error updating served status:", error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={handleGoBack}>
          <Text style={styles.backBtnText}>↩</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>รายการอาหารพร้อมเสิร์ฟ</Text>
          <Text style={styles.headerSubtitle}>{serveItems.length} รายการ</Text>
        </View>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={{ paddingVertical: 16 }}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#1ba740" style={{ marginTop: 40 }} />
        ) : serveItems.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🍽️</Text>
            <Text style={styles.emptyText}>ไม่มีรายการอาหารที่รอเสิร์ฟในขณะนี้</Text>
          </View>
        ) : (
          serveItems.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.tableTitleText}>โต๊ะ {item.tableNumber}</Text>
                <View style={styles.readyBadge}>
                  <Text style={styles.readyBadgeText}>พร้อมเสิร์ฟ</Text>
                </View>
              </View>

              <View style={styles.cardBodyRow}>
                <Image
                  source={{ uri: item.imageUrl || 'https://via.placeholder.com/100' }}
                  style={styles.foodImage}
                />

                <View style={styles.foodDetails}>
                  <Text style={styles.foodNameText}>{item.foodName}</Text>
                  <Text style={styles.quantityText}>จำนวน: {item.quantity}</Text>
                  <Text style={styles.timeText}>สั่งเมื่อ {item.orderedAt}</Text>
                </View>

                <TouchableOpacity
                  style={styles.servedBtn}
                  onPress={() => handleServed(item.id)}
                >
                  <Text style={styles.servedBtnText}>เสิร์ฟแล้ว</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  headerBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dcdcdc', paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
  backBtn: { paddingRight: 8 },
  backBtnText: { fontSize: 26, fontWeight: 'bold', color: '#111' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  headerSubtitle: { fontSize: 14, color: '#444' },

  container: { flex: 1, paddingHorizontal: 20 },
  itemCard: { backgroundColor: '#dcdcdc', borderRadius: 16, padding: 16, marginBottom: 16 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  tableTitleText: { fontSize: 20, fontWeight: 'bold', color: '#111' },
  readyBadge: { backgroundColor: '#70c946', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12 },
  readyBadgeText: { color: 'white', fontSize: 12, fontWeight: 'bold' },

  cardBodyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  foodImage: { width: 80, height: 70, borderRadius: 8, backgroundColor: '#bbb' },
  foodDetails: { flex: 1 },
  foodNameText: { fontSize: 16, fontWeight: 'bold', color: '#111', marginBottom: 4 },
  quantityText: { fontSize: 14, color: '#333', marginBottom: 4 },
  timeText: { fontSize: 13, color: '#555' },

  servedBtn: { backgroundColor: '#00b038', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  servedBtnText: { color: 'white', fontSize: 14, fontWeight: 'bold' },

  emptyBox: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 10 },
  emptyText: { fontSize: 15, color: '#777', fontWeight: '500' }
});