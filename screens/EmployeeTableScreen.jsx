// File: screens/EmployeeTableScreen.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Platform, View, Text, StyleSheet, ScrollView, SafeAreaView,
  ActivityIndicator, TouchableOpacity, Dimensions, Modal, Image, Alert
} from 'react-native';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import * as Print from 'expo-print';

const { width } = Dimensions.get('window');

export default function EmployeeTableScreen({ navigation }) {
  useEffect(() => {
    if (Platform.OS === 'web') {
      const savedRole = localStorage.getItem('userRole');
      if (!savedRole || !['staff', 'admin', 'chef'].includes(savedRole)) {
        navigation.replace('Login', { role: 'staff' });
      }
    }
  }, []);

  // Ref และ Helper สำหรับจัดการเสียงแจ้งเตือน "พร้อมเสิร์ฟ" (Ding!) เบื้องหลัง
  const isFirstLoadServe = useRef(true);

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

  // Listener ดักฟังรายการอาหารพร้อมเสิร์ฟใหม่ในเบื้องหลัง
  useEffect(() => {
    const ordersRef = collection(db, 'Order_Detail');
    const unsubscribe = onSnapshot(ordersRef, (snapshot) => {
      const notifiedSet = getNotifiedIds();
      let hasNewUnnotifiedItem = false;

      snapshot.docs.forEach((docSnap) => {
        const orderData = docSnap.data();
        const orderId = docSnap.id;
        const status = orderData.OrderStatus || orderData.orderStatus;

        if (status === 'พร้อมเสิร์ฟ') {
          if (!notifiedSet.has(orderId)) {
            hasNewUnnotifiedItem = true;
            notifiedSet.add(orderId);
          }
        }
      });

      if (isFirstLoadServe.current) {
        isFirstLoadServe.current = false;
        saveNotifiedIds(notifiedSet);
      } else if (hasNewUnnotifiedItem) {
        playDingSound();
        saveNotifiedIds(notifiedSet);
      }
    });

    return () => unsubscribe();
  }, []);

  const [tables, setTables] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availableCount, setAvailableCount] = useState(0);
  const [occupiedCount, setOccupiedCount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('available');

  // Modals States
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [occupiedModalVisible, setOccupiedModalVisible] = useState(false);
  const [clearModalVisible, setClearModalVisible] = useState(false);

  // State สำหรับข้อมูล Order ในโต๊ะที่เลือก
  const [tableOrders, setTableOrders] = useState([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);

  // State สำหรับ Modal ยืนยันการเคลียร์โต๊ะ
  const [confirmClearModalVisible, setConfirmClearModalVisible] = useState(false);
  const [tableToClear, setTableToClear] = useState(null);

  const [selectedTable, setSelectedTable] = useState(null);
  const [currentDateStr, setCurrentDateStr] = useState('');
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [tempToken, setTempToken] = useState('');

  const generateSessionToken = () => {
    return 'SESS-' + Math.random().toString(36).substring(2, 9).toUpperCase();
  };

  useEffect(() => {
    const tablesCollection = collection(db, 'Table');
    const unsubscribe = onSnapshot(tablesCollection, (snapshot) => {
      let fetchedTables = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedTables.sort((a, b) => Number(a.tableNumber) - Number(b.tableNumber));

      let available = 0; let occupied = 0;
      fetchedTables.forEach(t => { if (t.status === 'occupied') occupied++; else available++; });

      setTables(fetchedTables);
      setAvailableCount(available);
      setOccupiedCount(occupied);
      setIsLoading(false);
    }, (error) => {
      console.error("Error listening to tables: ", error);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ดึงข้อมูลรายการอาหารของโต๊ะแบบ Realtime ตาม schema TableNumber ใน Order_Detail
  useEffect(() => {
    if (occupiedModalVisible && selectedTable) {
      setIsOrdersLoading(true);
      const q = query(
        collection(db, 'Order_Detail'),
        where('TableNumber', '==', String(selectedTable.tableNumber))
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        setTableOrders(orders);
        setIsOrdersLoading(false);
      }, (err) => {
        console.error("Error fetching table orders: ", err);
        setIsOrdersLoading(false);
      });

      return () => unsubscribe();
    } else {
      setTableOrders([]);
    }
  }, [occupiedModalVisible, selectedTable]);

  const formatThaiDateTime = (dateObj) => {
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');
    return { date: `${day}/${month}/${year}`, time: `${hours}:${minutes}:${seconds}` };
  };

  const handleTablePress = (table) => {
    setSelectedTable(table);
    if (table.status === 'available') {
      const now = new Date();
      const formatted = formatThaiDateTime(now);
      setCurrentDateStr(formatted.date);
      setCurrentTimeStr(formatted.time);

      const newToken = generateSessionToken();
      setTempToken(newToken);
      setQrModalVisible(true);
    } else {
      setOccupiedModalVisible(true);
    }
  };

  const printQRReceipt = async (tableNumber, dateStr, timeStr, qrUrl) => {
    const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: auto; margin: 0; }
          body {
            font-family: 'Sarabun', 'Tahoma', 'Arial', sans-serif;
            margin: 0 auto; padding: 15px 10px; width: 280px;
            text-align: center; color: #000000; background-color: #ffffff;
          }
          .shop-title { font-size: 18px; font-weight: bold; margin-bottom: 12px; }
          .info-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; }
          .dashed-line { border-top: 1px dashed #000000; margin: 8px 0; width: 100%; }
          .table-title { font-size: 18px; font-weight: bold; margin: 8px 0; }
          .qr-container { margin: 12px 0; display: flex; justify-content: center; }
          .qr-code { width: 200px; height: 200px; }
          .footer-text { font-size: 13px; margin-top: 15px; font-weight: normal; }
        </style>
      </head>
      <body>
        <div class="shop-title">ร้านยายจุด</div>
        <div class="info-row">
          <span>วันที่ : ${dateStr}</span>
          <span>เวลา : ${timeStr}</span>
        </div>
        <div class="dashed-line"></div>
        <div class="table-title">โต๊ะ : ${tableNumber}</div>
        <div class="qr-container">
          <img class="qr-code" src="${qrUrl}" />
        </div>
        <div class="footer-text">สแกน QR ด้วยโทรศัพท์มือถือเพื่อสั่งอาหาร</div>
      </body>
    </html>
  `;

    try {
      if (Platform.OS === 'web') {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(htmlContent);
        doc.close();

        setTimeout(() => {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          setTimeout(() => { document.body.removeChild(iframe); }, 1000);
        }, 500);
      } else {
        await Print.printAsync({ html: htmlContent });
      }
    } catch (error) {
      console.error("Error printing receipt: ", error);
      alert("ไม่สามารถพิมพ์ใบสแกนได้");
    }
  };

  const confirmOpenTable = async () => {
    if (!selectedTable) return;
    try {
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://login-a7fa2.web.app/table/${selectedTable.tableNumber}?session=${tempToken}`;

      await printQRReceipt(selectedTable.tableNumber, currentDateStr, currentTimeStr, qrApiUrl);

      const tableRef = doc(db, 'Table', selectedTable.id);
      await updateDoc(tableRef, {
        status: 'occupied',
        openedAt: new Date().toISOString(),
        SessionToken: tempToken
      });

      setQrModalVisible(false);
      setSelectedTable(null);
      setTempToken('');
    } catch (error) {
      console.error("Error opening table: ", error);
    }
  };

  // พิมพ์ QR Code ใหม่พร้อมเปลี่ยน SessionToken สำหรับโต๊ะเดิม
  const handleReprintNewQR = async () => {
    if (!selectedTable) return;

    const confirmMessage = `คุณต้องการสร้างและพิมพ์ QR Code ใหม่สำหรับ "โต๊ะ ${selectedTable.tableNumber}" ใช่หรือไม่?\n\n*ระบบจะทำการเปลี่ยน SessionToken ใหม่ทันที`;

    const executeReprint = async () => {
      try {
        const newToken = generateSessionToken();
        const now = new Date();
        const formatted = formatThaiDateTime(now);
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://login-a7fa2.web.app/table/${selectedTable.tableNumber}?session=${newToken}`;

        await printQRReceipt(selectedTable.tableNumber, formatted.date, formatted.time, qrApiUrl);

        const tableRef = doc(db, 'Table', selectedTable.id);
        await updateDoc(tableRef, {
          SessionToken: newToken
        });

        const q = query(
          collection(db, 'Order_Detail'),
          where('TableNumber', '==', String(selectedTable.tableNumber))
        );
        const querySnapshot = await getDocs(q);
        const updatePromises = querySnapshot.docs.map((docSnap) =>
          updateDoc(doc(db, 'Order_Detail', docSnap.id), {
            SessionToken: newToken
          })
        );
        await Promise.all(updatePromises);

        setSelectedTable((prev) => prev ? { ...prev, SessionToken: newToken } : null);

        if (Platform.OS === 'web') {
          window.alert("พิมพ์ QR Code ใหม่และอัปเดต Session เรียบร้อยแล้ว");
        }
      } catch (error) {
        console.error("Error reprinting QR Code:", error);
        if (Platform.OS === 'web') {
          window.alert("เกิดข้อผิดพลาดในการพิมพ์ QR Code ใหม่");
        } else {
          Alert.alert("ข้อผิดพลาด", "ไม่สามารถพิมพ์ QR Code ใหม่ได้");
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        executeReprint();
      }
    } else {
      Alert.alert(
        "ยืนยันสร้าง QR Code ใหม่",
        confirmMessage,
        [
          { text: "ยกเลิก", style: "cancel" },
          { text: "ยืนยันพิมพ์ใหม่", onPress: executeReprint }
        ]
      );
    }
  };

  // 🟢 ตรวจสอบรายการอาหารเพื่อไม่อนุญาตให้กดเคลียร์โต๊ะหากอยู่ในสถานะ (รอทำ / กำลังทำ / พร้อมเสิร์ฟ / เสิร์ฟแล้ว)
  const triggerClearConfirm = async (table) => {
    if (!table) return;
    try {
      const q = query(
        collection(db, 'Order_Detail'),
        where('TableNumber', '==', String(table.tableNumber))
      );
      const querySnapshot = await getDocs(q);

      const activeStatuses = ['รอทำ', 'pending', 'กำลังทำ', 'cooking', 'พร้อมเสิร์ฟ', 'ready', 'เสิร์ฟแล้ว', 'served'];
      const hasActiveOrders = querySnapshot.docs.some((docSnap) => {
        const data = docSnap.data();
        const status = data.OrderStatus || data.Status || data.status || '';
        return activeStatuses.includes(status);
      });

      if (hasActiveOrders) {
        const warningMsg = `ไม่สามารถเคลียร์โต๊ะ ${table.tableNumber} ได้!\n\nเนื่องจากยังมีรายการอาหารค้างอยู่ในสถานะ (รอทำ / กำลังทำ / พร้อมเสิร์ฟ / เสิร์ฟแล้ว)\n\nกรุณาดำเนินการรับชำระเงินให้เรียบร้อยก่อนครับ`;
        if (Platform.OS === 'web') {
          window.alert(warningMsg);
        } else {
          Alert.alert("⚠️ ไม่สามารถเคลียร์โต๊ะได้", warningMsg);
        }
        return;
      }

      setTableToClear(table);
      setConfirmClearModalVisible(true);
    } catch (error) {
      console.error("Error checking orders before clearing table:", error);
    }
  };

  const executeClearTable = async () => {
    if (!tableToClear) return;
    try {
      const q = query(
        collection(db, 'Order_Detail'),
        where('TableNumber', '==', String(tableToClear.tableNumber))
      );
      const querySnapshot = await getDocs(q);

      const deletePromises = querySnapshot.docs.map((docSnap) =>
        deleteDoc(doc(db, 'Order_Detail', docSnap.id))
      );
      await Promise.all(deletePromises);

      const tableRef = doc(db, 'Table', tableToClear.id);
      await updateDoc(tableRef, {
        status: 'available',
        openedAt: '',
        SessionToken: ''
      });

      setConfirmClearModalVisible(false);
      setOccupiedModalVisible(false);
      setClearModalVisible(false);
      setTableToClear(null);
    } catch (error) {
      console.error("Error clearing table and deleting orders:", error);
    }
  };

  // ตรวจสอบสถานะการระงับชำระเงินจาก OrderStatus (กำลังทำ หรือ พร้อมเสิร์ฟ)
  const hasPendingItems = tableOrders.some(order => {
    const status = order.OrderStatus || order.Status || order.status;
    return status === 'รอทำ' || status === 'กำลังทำ' || status === 'พร้อมเสิร์ฟ';
  });

  // 🟢 ตรวจสอบเพื่อระงับปุ่มเคลียร์โต๊ะใน Modal จัดการโต๊ะ
  const hasActiveOrdersInTable = tableOrders.some(order => {
    const status = order.OrderStatus || order.Status || order.status;
    return ['รอทำ', 'pending', 'กำลังทำ', 'cooking', 'พร้อมเสิร์ฟ', 'ready', 'เสิร์ฟแล้ว', 'served'].includes(status);
  });

  const filteredTables = tables.filter(table => table.status === selectedCategory);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1ba740" />
        <Text style={styles.loadingText}>กำลังเตรียมข้อมูลผังโต๊ะ...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.adminTitle}>ผังการจัดโต๊ะอาหาร</Text>
          <Text style={styles.adminSubtitle}>พนักงานบริการ / หน้าจัดการโต๊ะ</Text>
        </View>
        <View style={styles.topButtonsRow}>
          <TouchableOpacity
            style={[styles.whitePillBtn, styles.greenServeShortcutBtn]}
            onPress={() => navigation.navigate('ServeList')}
          >
            <Text style={styles.greenServeShortcutText}>🍱 รายการเสิร์ฟ</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.whitePillBtn, styles.redTableShortcutBtn]} onPress={() => setClearModalVisible(true)}>
            <Text style={styles.redTableShortcutText}>🪑🔴 เคลียร์โต๊ะ</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.whitePillBtn}
            onPress={() => {
              if (Platform.OS === 'web') {
                localStorage.removeItem('userRole');
              }
              navigation.replace('Login', { role: 'staff' });
            }}
          >
            <Text style={styles.pillBtnText}>🚪 ออกจากระบบ</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryGridRow}>
          <View style={styles.frameBoxHalf}><Text style={styles.frameLabel}>🟢 โต๊ะที่ว่างอยู่</Text><Text style={styles.frameValueAvailable}>{availableCount}</Text><Text style={styles.frameUnitText}>โต๊ะ</Text></View>
          <View style={styles.frameBoxHalf}><Text style={styles.frameLabel}>🔴 โต๊ะมีลูกค้า</Text><Text style={styles.frameValueOccupied}>{occupiedCount}</Text><Text style={styles.frameUnitText}>โต๊ะ</Text></View>
        </View>

        <Text style={styles.sectionTitle}>📁 เลือกสถานะโต๊ะเพื่อตรวจสอบ</Text>
        <View style={styles.categoryContainerRow}>
          <TouchableOpacity style={[styles.categoryPillBtn, selectedCategory === 'available' && styles.categoryPillBtnActive]} onPress={() => setSelectedCategory('available')}><Text style={[styles.categoryPillText, selectedCategory === 'available' && styles.categoryPillTextActive]}>🟢 โต๊ะว่าง ({availableCount})</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.categoryPillBtn, selectedCategory === 'occupied' && styles.categoryPillBtnActive]} onPress={() => setSelectedCategory('occupied')}><Text style={[styles.categoryPillText, selectedCategory === 'occupied' && styles.categoryPillTextActive]}>🔴 มีลูกค้า ({occupiedCount})</Text></TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>🪑 รายการ{selectedCategory === 'available' ? 'โต๊ะว่าง' : 'โต๊ะที่มีลูกค้า'} ({filteredTables.length} โต๊ะ)</Text>

        {filteredTables.length === 0 ? (
          <View style={styles.emptyContainer}><Text style={styles.emptyText}>ไม่มีข้อมูลโต๊ะในหมวดหมู่นี้</Text></View>
        ) : (
          <View style={styles.tablesGridContainer}>
            {filteredTables.map((table) => {
              const isOccupied = table.status === 'occupied';
              return (
                <TouchableOpacity key={table.id} style={[styles.tableCard, isOccupied ? styles.tableCardOccupied : styles.tableCardAvailable]} onPress={() => handleTablePress(table)} activeOpacity={0.8}>
                  <Text style={styles.tableNumberText}>โต๊ะ {table.tableNumber}</Text>
                  <View style={[styles.statusBadge, isOccupied ? styles.badgeRed : styles.badgeGreen]}><Text style={styles.statusBadgeText}>{isOccupied ? '🔴 มีลูกค้า' : '🟢 ว่างอยู่'}</Text></View>
                  <Text style={styles.clickHintText}>{isOccupied ? 'ดูข้อมูล / รับชำระเงิน' : 'กดสร้างสลิปคิวอาร์'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Modal ใบสแกน */}
      <Modal animationType="slide" transparent={true} visible={qrModalVisible} onRequestClose={() => setQrModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.receiptTicketBox}>
            <Text style={styles.receiptShopNameText}>ร้านยายจุด</Text>

            <View style={styles.dateTimeRowContainer}>
              <Text style={styles.dateTimeDetailText}>วันที่ : {currentDateStr}</Text>
              <Text style={styles.dateTimeDetailText}>เวลา : {currentTimeStr}</Text>
            </View>

            <View style={styles.dashedSeparatorLine} />

            <Text style={styles.receiptTableTitleText}>โต๊ะ : {selectedTable?.tableNumber}</Text>

            <View style={styles.qrImageContainer}>
              {selectedTable && (
                <Image
                  source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://login-a7fa2.web.app/table/${selectedTable.tableNumber}?session=${tempToken}` }}
                  style={styles.qrImageStyle}
                  resizeMode="contain"
                />
              )}
            </View>

            <Text style={styles.receiptFooterTip}>สแกน QR ด้วยโทรศัพท์มือถือเพื่อสั่งอาหาร</Text>

            <View style={styles.receiptActionButtonsRow}>
              <TouchableOpacity style={[styles.receiptBtn, styles.receiptBtnCancel]} onPress={() => setQrModalVisible(false)}>
                <Text style={styles.receiptBtnCancelText}>ยกเลิก</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.receiptBtn, styles.receiptBtnConfirm]} onPress={confirmOpenTable}>
                <Text style={styles.receiptBtnConfirmText}>🖨️ เปิดโต๊ะ & ปริ้นใบสแกน</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🔴 Modal จัดการโต๊ะมีลูกค้า */}
      <Modal animationType="fade" transparent={true} visible={occupiedModalVisible} onRequestClose={() => setOccupiedModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.occupiedBox}>
            <Text style={styles.occupiedTitle}>🍽️ จัดการโต๊ะหมายเลข {selectedTable?.tableNumber}</Text>
            <Text style={styles.occupiedSubtitle}>สถานะ: 🔴 มีลูกค้ากำลังใช้งาน</Text>

            <View style={styles.dashedSeparatorLine} />

            {/* ส่วนแสดงรายการอาหารทั้งหมดในโต๊ะ */}
            <Text style={styles.orderListTitle}>📋 รายการอาหารที่สั่งซื้อ ({tableOrders.length} รายการ)</Text>
            <View style={styles.orderListContainer}>
              {isOrdersLoading ? (
                <ActivityIndicator size="small" color="#1ba740" style={{ marginVertical: 15 }} />
              ) : tableOrders.length === 0 ? (
                <Text style={styles.emptyOrderText}>ยังไม่มีการสั่งอาหารเข้ามาในโต๊ะนี้</Text>
              ) : (
                <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={true}>
                  {tableOrders.map((item, index) => {
                    const st = item.OrderStatus || item.Status || item.status || 'รอดำเนินการ';
                    const isCooking = st === 'กำลังทำ';
                    const isReady = st === 'พร้อมเสิร์ฟ';
                    const isServed = st === 'เสิร์ฟแล้ว';

                    return (
                      <View key={item.id || index} style={styles.orderItemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.orderItemName}>
                            {item.MenuName || 'รายการอาหาร'} x{item.Quantity || 1}
                          </Text>
                          {item.Note && item.Note !== 'ไม่มี' && (
                            <Text style={styles.orderItemNote}>* {item.Note}</Text>
                          )}
                        </View>

                        <View style={[
                          styles.statusTag,
                          isCooking ? styles.tagYellow : isReady ? styles.tagBlue : isServed ? styles.tagGreen : styles.tagGray
                        ]}>
                          <Text style={[
                            styles.statusTagText,
                            isCooking ? styles.tagYellowText : isReady ? styles.tagBlueText : isServed ? styles.tagGreenText : styles.tagGrayText
                          ]}>
                            {isCooking ? '🔥 กำลังทำ' : isReady ? '🔔 พร้อมเสิร์ฟ' : isServed ? '✅ เสิร์ฟแล้ว' : `⏳ ${st}`}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* ข้อความแจ้งเตือนเมื่อยังชำระเงินไม่ได้ */}
            {hasPendingItems && (
              <Text style={styles.warningPaymentBlockedText}>
                ⚠️ ไม่สามารถชำระเงินได้ (ยังมีรายการ รอทำ / กำลังทำ / พร้อมเสิร์ฟ ค้างอยู่)
              </Text>
            )}

            {/* ข้อความแจ้งเตือนเมื่อยังเคลียร์โต๊ะไม่ได้ */}
            {hasActiveOrdersInTable && (
              <Text style={styles.warningPaymentBlockedText}>
                🛑 ไม่สามารถเคลียร์โต๊ะได้ (ยังมีรายการค้างชำระ/กำลังทำ/รอเสิร์ฟ)
              </Text>
            )}

            {/* ปุ่มพิมพ์ QR Code ใหม่ กรณีลูกค้าทำ QR Code เดิมหาย */}
            <TouchableOpacity
              style={styles.reprintQrBtn}
              onPress={handleReprintNewQR}
            >
              <Text style={styles.reprintQrBtnText}>
                🖨️ พิมพ์ QR Code ใหม่ (สุ่ม Session ใหม่)
              </Text>
            </TouchableOpacity>

            {/* ปุ่มชำระเงิน */}
            <TouchableOpacity
              style={[styles.paymentBigBtn, hasPendingItems && styles.paymentBtnDisabled]}
              disabled={hasPendingItems}
              onPress={() => {
                setOccupiedModalVisible(false);
                navigation.navigate('Payment', {
                  tableId: selectedTable?.id,
                  tableNumber: selectedTable?.tableNumber,
                  sessionToken: selectedTable?.SessionToken || selectedTable?.currentSessionToken || ''
                });
              }}
            >
              <Text style={[styles.paymentBigBtnText, hasPendingItems && styles.paymentBtnDisabledText]}>
                💰 เข้าสู่หน้ารับชำระเงิน
              </Text>
            </TouchableOpacity>

            {/* ปุ่มปิดหน้าต่าง + เคลียร์โต๊ะ */}
            <View style={styles.receiptActionButtonsRow}>
              <TouchableOpacity style={[styles.receiptBtn, styles.receiptBtnCancel]} onPress={() => setOccupiedModalVisible(false)}>
                <Text style={styles.receiptBtnCancelText}>✖️ ปิดหน้าต่าง</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.receiptBtn, styles.clearBtnRed, hasActiveOrdersInTable && styles.clearBtnDisabled]}
                onPress={() => triggerClearConfirm(selectedTable)}
              >
                <Text style={[styles.clearBtnRedText, hasActiveOrdersInTable && styles.clearBtnDisabledText]}>🧹 เคลียร์โต๊ะ</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      {/* Modal เคลียร์โต๊ะด่วน */}
      <Modal animationType="fade" transparent={true} visible={clearModalVisible} onRequestClose={() => setClearModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.quickClearBox}>
            <Text style={styles.quickClearTitle}>🧹 จัดการเคลียร์โต๊ะอาหาร</Text>
            <Text style={styles.quickClearSubtitle}>รวมรายการโต๊ะมีลูกค้า เพื่อกดเคลียร์คืนค่าโต๊ะว่าง</Text>
            <View style={styles.dashedSeparatorLine} />
            <ScrollView style={styles.quickClearScrollView} showsVerticalScrollIndicator={false}>
              {tables.filter(table => table.status === 'occupied').length === 0 ? (
                <View style={styles.emptyClearStateBox}>
                  <Text style={styles.emptyClearIcon}>🎉</Text>
                  <Text style={styles.emptyClearText}>ไม่มีโต๊ะที่ต้องเคลียร์ในขณะนี้</Text>
                </View>
              ) : (
                tables.filter(table => table.status === 'occupied').map((table) => (
                  <View key={table.id} style={styles.clearTableItemRow}>
                    <View>
                      <Text style={styles.clearTableTitleText}>🪑 โต๊ะหมายเลข {table.tableNumber}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.actionClearItemBtn}
                      onPress={() => triggerClearConfirm(table)}
                    >
                      <Text style={styles.actionClearItemBtnText}>เคลียร์โต๊ะ</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={styles.closeClearViewBtn} onPress={() => setClearModalVisible(false)}>
              <Text style={styles.closeClearViewBtnText}>✖️ ปิดหน้าต่าง</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal ป๊อปอัปยืนยันการเคลียร์โต๊ะ */}
      <Modal animationType="fade" transparent={true} visible={confirmClearModalVisible} onRequestClose={() => setConfirmClearModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>⚠️ ยืนยันการเคลียร์โต๊ะ</Text>
            <Text style={styles.confirmSubtitle}>
              คุณแน่ใจหรือไม่ว่าต้องการเคลียร์ <Text style={styles.highlightText}>โต๊ะ {tableToClear?.tableNumber}</Text> ?
            </Text>
            <Text style={styles.confirmWarningText}>
              * การเคลียร์โต๊ะจะเปลี่ยนสถานะกลับเป็น "โต๊ะว่าง" ทันที
            </Text>

            <View style={styles.receiptActionButtonsRow}>
              <TouchableOpacity
                style={[styles.receiptBtn, styles.receiptBtnCancel]}
                onPress={() => setConfirmClearModalVisible(false)}
              >
                <Text style={styles.receiptBtnCancelText}>ยกเลิก</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.receiptBtn, styles.clearBtnRed]}
                onPress={executeClearTable}
              >
                <Text style={styles.clearBtnRedText}>🧹 ยืนยันเคลียร์</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f6f6f6' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 15, color: '#333' },
  container: { flex: 1, paddingHorizontal: 16 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#dcdcdc', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#ccc' },
  adminTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  adminSubtitle: { fontSize: 14, color: '#555', marginTop: 1 },
  topButtonsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  whitePillBtn: { backgroundColor: '#fff', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 15, borderWidth: 1, borderColor: '#ccc' },
  pillBtnText: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  redTableShortcutBtn: { backgroundColor: '#fce8e6', borderColor: '#d9534f' },
  redTableShortcutText: { fontSize: 12, fontWeight: 'bold', color: '#d9534f' },
  greenServeShortcutBtn: { backgroundColor: '#e6f4ea', borderColor: '#1ba740' },
  greenServeShortcutText: { fontSize: 12, fontWeight: 'bold', color: '#1ba740' },
  summaryGridRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, marginBottom: 16, gap: 12 },
  frameBoxHalf: { flex: 1, backgroundColor: '#e2e2e2', borderRadius: 15, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center', elevation: 2 },
  frameLabel: { fontSize: 13, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  frameValueAvailable: { fontSize: 26, fontWeight: 'bold', color: '#1ba740' },
  frameValueOccupied: { fontSize: 26, fontWeight: 'bold', color: '#d9534f' },
  frameUnitText: { fontSize: 12, color: '#666', marginTop: 2, fontWeight: '500' },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#444', marginBottom: 10, marginTop: 4 },
  categoryContainerRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  categoryPillBtn: { flex: 1, backgroundColor: '#e2e2e2', paddingVertical: 10, alignItems: 'center', borderRadius: 20, borderWidth: 1, borderColor: '#ccc', elevation: 1 },
  categoryPillBtnActive: { backgroundColor: '#444444', borderColor: '#444444' },
  categoryPillText: { fontSize: 13, fontWeight: 'bold', color: '#444' },
  categoryPillTextActive: { color: '#ffffff' },
  tablesGridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  tableCard: { width: (width - 44) / 2, backgroundColor: '#e2e2e2', borderRadius: 18, paddingVertical: 20, alignItems: 'center', justifyContent: 'center', elevation: 2, borderWidth: 2 },
  tableCardAvailable: { borderColor: '#1ba740' },
  tableCardOccupied: { borderColor: '#d9534f' },
  tableNumberText: { fontSize: 22, fontWeight: 'bold', color: '#222', marginBottom: 8 },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 14, borderRadius: 12, marginBottom: 6 },
  badgeGreen: { backgroundColor: '#e6f4ea' },
  badgeRed: { backgroundColor: '#fce8e6' },
  statusBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  clickHintText: { fontSize: 10, color: '#777', fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },

  receiptTicketBox: { width: '85%', backgroundColor: '#ffffff', borderRadius: 16, paddingVertical: 24, paddingHorizontal: 20, alignItems: 'center', elevation: 10 },
  receiptShopNameText: { fontSize: 20, fontWeight: 'bold', color: '#111', marginBottom: 16, textAlign: 'center' },
  dateTimeRowContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 4 },
  dateTimeDetailText: { fontSize: 13, color: '#222', fontWeight: '500' },
  dashedSeparatorLine: { width: '100%', height: 1, borderStyle: 'dashed', borderWidth: 0.8, borderColor: '#333', marginVertical: 10 },
  receiptTableTitleText: { fontSize: 20, fontWeight: 'bold', color: '#111', marginVertical: 4, textAlign: 'center' },
  qrImageContainer: { marginVertical: 8, alignItems: 'center', justifyContent: 'center' },
  qrImageStyle: { width: 190, height: 190 },
  receiptFooterTip: { fontSize: 13, color: '#222', textAlign: 'center', marginTop: 12, marginBottom: 16, fontWeight: '500' },

  receiptActionButtonsRow: { flexDirection: 'row', width: '100%', gap: 10, marginTop: 6 },
  receiptBtn: { flex: 1, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  receiptBtnCancel: { backgroundColor: '#f0f0f0', borderColor: '#ccc' },
  receiptBtnCancelText: { fontSize: 13, fontWeight: 'bold', color: '#555' },
  receiptBtnConfirm: { backgroundColor: '#1ba740', borderColor: '#1ba740' },
  receiptBtnConfirmText: { fontSize: 13, fontWeight: 'bold', color: '#ffffff' },

  occupiedBox: { width: '88%', backgroundColor: '#ffffff', borderRadius: 24, padding: 22, elevation: 10 },
  occupiedTitle: { fontSize: 20, fontWeight: 'bold', color: '#111', textAlign: 'center' },
  occupiedSubtitle: { fontSize: 14, color: '#d9534f', textAlign: 'center', marginTop: 4, fontWeight: 'bold' },

  orderListTitle: { fontSize: 14, fontWeight: 'bold', color: '#333', marginTop: 4, marginBottom: 8 },
  orderListContainer: { backgroundColor: '#f8f9fa', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#e9ecef', marginBottom: 10 },
  orderItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f3f5' },
  orderItemName: { fontSize: 13, fontWeight: 'bold', color: '#212529' },
  orderItemNote: { fontSize: 11, color: '#d9534f', fontStyle: 'italic' },
  statusTag: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8 },
  statusTagText: { fontSize: 11, fontWeight: 'bold' },
  tagYellow: { backgroundColor: '#fef3c7' },
  tagYellowText: { color: '#d97706' },
  tagBlue: { backgroundColor: '#dbeafe' },
  tagBlueText: { color: '#2563eb' },
  tagGreen: { backgroundColor: '#d1fae5' },
  tagGreenText: { color: '#059669' },
  tagGray: { backgroundColor: '#f1f5f9' },
  tagGrayText: { color: '#64748b' },
  emptyOrderText: { fontSize: 12, color: '#888', textAlign: 'center', paddingVertical: 12 },

  warningPaymentBlockedText: { fontSize: 12, color: '#d9534f', fontWeight: 'bold', textAlign: 'center', marginBottom: 6 },

  reprintQrBtn: {
    backgroundColor: '#0288d1',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
    elevation: 2
  },
  reprintQrBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold'
  },

  paymentBigBtn: { backgroundColor: '#1ba740', width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginVertical: 8, elevation: 2 },
  paymentBigBtnText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  paymentBtnDisabled: { backgroundColor: '#e2e8f0', borderColor: '#cbd5e1', elevation: 0 },
  paymentBtnDisabledText: { color: '#94a3b8' },

  clearBtnRed: { backgroundColor: '#d9534f', borderColor: '#d9534f' },
  clearBtnRedText: { fontSize: 14, fontWeight: 'bold', color: '#ffffff' },
  clearBtnDisabled: { backgroundColor: '#e2e8f0', borderColor: '#cbd5e1' },
  clearBtnDisabledText: { color: '#94a3b8' },

  quickClearBox: { width: '90%', maxHeight: '75%', backgroundColor: '#ffffff', borderRadius: 25, padding: 20, elevation: 15 },
  quickClearTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  quickClearSubtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  quickClearScrollView: { marginVertical: 10, paddingHorizontal: 2 },
  clearTableItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fa', padding: 14, borderRadius: 15, marginVertical: 6, borderWidth: 1, borderColor: '#eaeaea' },
  clearTableTitleText: { fontSize: 16, fontWeight: 'bold', color: '#222' },
  actionClearItemBtn: { backgroundColor: '#d9534f', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12 },
  actionClearItemBtnText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  emptyClearStateBox: { paddingVertical: 40, alignItems: 'center' },
  emptyClearIcon: { fontSize: 40, marginBottom: 8 },
  emptyClearText: { fontSize: 14, color: '#555', fontWeight: '500', textAlign: 'center' },
  closeClearViewBtn: { backgroundColor: '#444444', height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginTop: 15 },
  closeClearViewBtnText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  confirmBox: { width: '85%', backgroundColor: '#ffffff', borderRadius: 20, padding: 20, alignItems: 'center', elevation: 10 },
  confirmTitle: { fontSize: 18, fontWeight: 'bold', color: '#d9534f', marginBottom: 10 },
  confirmSubtitle: { fontSize: 15, color: '#333', textAlign: 'center', marginVertical: 8 },
  highlightText: { fontSize: 16, fontWeight: 'bold', color: '#d9534f' },
  confirmWarningText: { fontSize: 12, color: '#777', fontStyle: 'italic', marginBottom: 15, textAlign: 'center' }
});