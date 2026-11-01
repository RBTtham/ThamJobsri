// File: screens/CartScreen.jsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Modal, Alert, Platform } from 'react-native';
import { collection, addDoc, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useCart } from '../services/CartContext';
import { getOrCreateDeviceId } from '../services/deviceId'; // 🟢 นำเข้า Helper

export default function CartScreen({ route, navigation }) {
  const { cart, updateQuantity, removeItem, clearCart } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);

  const deviceId = getOrCreateDeviceId(); // 🟢 ดึง DeviceID จาก localStorage

  const getTableNumber = () => {
    if (route.params?.tableNumber) return String(route.params.tableNumber);
    if (typeof window !== 'undefined' && window.location) {
      const fullPath = window.location.pathname + window.location.hash + window.location.search;
      const match = fullPath.match(/table[=/]([a-zA-Z0-9]+)/i);
      if (match && match[1]) return match[1];
    }
    return "1";
  };

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
    return '';
  };

  const tableNumber = getTableNumber();
  const sessionToken = getSessionToken();

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Menu', { tableNumber, sessionToken });
    }
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + (item.Price * item.quantity), 0);
  };

  const processOrderSubmission = async () => {
    setConfirmModalVisible(false);
    setIsSubmitting(true);

    try {
      const orderBatchTime = new Date().toISOString();
      const currentCartDishesCount = cart.reduce((sum, item) => sum + item.quantity, 0);

      // 🟢 1. บันทึก / อัปเดตข้อมูลลูกค้าลง คอลเลกชัน "Customer"
      if (sessionToken) {
        const customerDocId = `${sessionToken}_${deviceId}`;
        const customerRef = doc(db, 'Customer', customerDocId);
        const customerSnap = await getDoc(customerRef);

        if (customerSnap.exists()) {
          const currentData = customerSnap.data();
          await setDoc(customerRef, {
            ...currentData,
            LastActive: orderBatchTime,
            TotalOrdersCount: (currentData.TotalOrdersCount || 0) + 1,
            TotalDishesOrdered: (currentData.TotalDishesOrdered || 0) + currentCartDishesCount
          }, { merge: true });
        } else {
          await setDoc(customerRef, {
            SessionToken: sessionToken,
            DeviceID: deviceId,
            TableNumber: String(tableNumber),
            CreatedAt: orderBatchTime,
            LastActive: orderBatchTime,
            TotalOrdersCount: 1,
            TotalDishesOrdered: currentCartDishesCount
          });
        }
      }

      // 🟢 2. บันทึกรายการสั่งซื้อลง "Order_Detail" พร้อมแนบ DeviceID
      for (const item of cart) {
        await addDoc(collection(db, 'Order_Detail'), {
          TableNumber: String(tableNumber),
          SessionToken: sessionToken,
          DeviceID: deviceId, // 🟢 แนบ DeviceID เพื่อจำว่าเครื่องไหนสั่ง
          MenuID: item.id || '',
          MenuName: item.MenuName,
          Quantity: item.quantity,
          Note: item.note || '',
          OrderStatus: 'รอทำ',
          OrderDateTime: orderBatchTime,
          Image: item.Image || '',
          Price: item.Price
        });
      }

      clearCart();
      setIsSubmitting(false);

      if (Platform.OS === 'web' || (typeof window !== 'undefined' && window.location)) {
        alert('🍳 ส่งรายการสั่งอาหารเข้าห้องครัวเรียบร้อยแล้ว');
        navigation.navigate('OrderHistory', { tableNumber, sessionToken });
      } else {
        Alert.alert('สำเร็จ! 🍳', 'ส่งรายการสั่งอาหารเข้าห้องครัวเรียบร้อยแล้ว', [
          {
            text: 'ตกลง',
            onPress: () => navigation.navigate('OrderHistory', { tableNumber, sessionToken })
          }
        ]);
      }

    } catch (error) {
      console.error("Error sending order:", error);
      setIsSubmitting(false);
      if (Platform.OS === 'web') {
        alert('เกิดข้อผิดพลาดในการส่งออเดอร์ กรุณาลองใหม่อีกครั้ง');
      } else {
        Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถส่งออเดอร์ได้ กรุณาลองใหม่อีกครั้ง');
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
            <Text style={styles.backArrow}>↩️ ย้อนกลับ</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ตะกร้าของคุณ (โต๊ะ {tableNumber})</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>ยอดรวมทั้งหมด:</Text>
          <Text style={styles.totalPriceText}>{calculateTotal()} บาท</Text>
        </View>

        <ScrollView style={styles.cartList} showsVerticalScrollIndicator={false}>
          {cart.length === 0 ? (
            <View style={styles.emptyCartContainer}>
              <Text style={styles.emptyText}>🛒 ตะกร้าของคุณยังว่างเปล่า</Text>
            </View>
          ) : (
            cart.map((item) => (
              <View style={styles.cartCard} key={item.uniqueKey}>
                <View style={styles.leftInfo}>
                  <Text style={styles.itemName}>{item.MenuName}</Text>
                  <Text style={styles.itemCalculation}>
                    {item.quantity} รายการ × {item.Price} = {item.quantity * item.Price} บาท
                  </Text>
                  {item.note ? (
                    <Text style={styles.itemNote}>📝 เพิ่มเติม: {item.note}</Text>
                  ) : (
                    <Text style={[styles.itemNote, { color: '#aaa', backgroundColor: '#f9f9f9' }]}>📝 เพิ่มเติม: -</Text>
                  )}
                </View>

                <View style={styles.rightActions}>
                  <TouchableOpacity onPress={() => removeItem(item.uniqueKey)} style={styles.deleteBtn}>
                    <Text style={styles.deleteIcon}>🗑️ ลบรายการ</Text>
                  </TouchableOpacity>

                  <View style={styles.qtyController}>
                    <TouchableOpacity style={styles.controlBtn} onPress={() => updateQuantity(item.uniqueKey, -1)}>
                      <Text style={styles.controlBtnText}>➖</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.quantity}</Text>
                    <TouchableOpacity style={styles.controlBtn} onPress={() => updateQuantity(item.uniqueKey, 1)}>
                      <Text style={styles.controlBtnText}>➕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {cart.length > 0 && (
          <TouchableOpacity
            style={[styles.checkoutBtn, isSubmitting && { backgroundColor: '#a5d6a7' }]}
            onPress={() => setConfirmModalVisible(true)}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.checkoutBtnText}>🍳 ส่งรายการสั่งอาหาร</Text>
            )}
          </TouchableOpacity>
        )}

        <Modal visible={confirmModalVisible} transparent={true} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>🍳 ยืนยันการสั่งอาหาร</Text>
              <Text style={styles.modalSubTitle}>ต้องการส่งรายการอาหาร {cart.length} รายการ เข้าห้องครัวหรือไม่?</Text>

              <View style={styles.modalButtonRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setConfirmModalVisible(false)}
                >
                  <Text style={styles.modalCancelBtnText}>ยกเลิก</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={processOrderSubmission}
                >
                  <Text style={styles.modalConfirmBtnText}>ยืนยันสั่งอาหาร</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#e5e5e5' },
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 10 },
  backBtn: { backgroundColor: '#fff', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 15, borderWidth: 1, borderColor: '#ccc' },
  backArrow: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#222' },
  totalContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 15, marginBottom: 16, elevation: 2 },
  totalLabel: { fontSize: 16, fontWeight: 'bold', color: '#555' },
  totalPriceText: { fontSize: 20, color: '#4b8df8', fontWeight: 'bold' },
  cartList: { flex: 1 },
  emptyCartContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { fontSize: 16, color: '#777' },
  cartCard: { backgroundColor: '#fff', borderRadius: 15, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, elevation: 2 },
  leftInfo: { flex: 1, paddingRight: 10 },
  itemName: { fontSize: 16, fontWeight: 'bold', color: '#222' },
  itemCalculation: { fontSize: 14, color: '#4b8df8', marginTop: 4, fontWeight: '500' },
  itemNote: { fontSize: 12, color: '#555', marginTop: 6, fontStyle: 'italic', backgroundColor: '#f0f0f0', padding: 4, paddingHorizontal: 8, borderRadius: 5, alignSelf: 'flex-start' },
  rightActions: { alignItems: 'flex-end', justifyContent: 'space-between', height: 75 },
  deleteBtn: { paddingVertical: 2 },
  deleteIcon: { fontSize: 12, color: 'red', fontWeight: 'bold' },
  qtyController: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 20, borderWidth: 1, borderColor: '#e0e0e0', paddingHorizontal: 4 },
  controlBtn: { padding: 6 },
  controlBtnText: { fontSize: 14 },
  qtyText: { fontSize: 16, fontWeight: 'bold', marginHorizontal: 12, color: '#222' },
  checkoutBtn: { backgroundColor: '#4caf50', paddingVertical: 14, borderRadius: 25, alignItems: 'center', marginTop: 10, elevation: 4 },
  checkoutBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '85%', backgroundColor: '#fff', borderRadius: 20, padding: 22, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#222', marginBottom: 10 },
  modalSubTitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 },
  modalButtonRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  modalCancelBtn: { backgroundColor: '#8e8e8e', paddingVertical: 10, borderRadius: 15, width: '45%', alignItems: 'center' },
  modalCancelBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  modalConfirmBtn: { backgroundColor: '#4caf50', paddingVertical: 10, borderRadius: 15, width: '45%', alignItems: 'center' },
  modalConfirmBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' }
});