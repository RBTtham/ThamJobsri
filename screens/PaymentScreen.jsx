// File: screens/PaymentScreen.jsx
import * as Print from 'expo-print';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  Platform
} from 'react-native';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

const PROMPTPAY_NUMBER = "0998824778";
const PROMPTPAY_NAME = "ธาม จบศรี";

export default function PaymentScreen({ route, navigation }) {
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

  const tableNumber = route?.params?.tableNumber || '-';
  const tableId = route?.params?.tableId || null;
  const sessionToken = route?.params?.sessionToken || route?.params?.session_token || '';

  const [orderItems, setOrderItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isQrLoading, setIsQrLoading] = useState(true);

  // Modal States
  const [isCashModalVisible, setIsCashModalVisible] = useState(false);
  const [isPromptPayModalVisible, setIsPromptPayModalVisible] = useState(false);
  const [isReceiptModalVisible, setIsReceiptModalVisible] = useState(false);

  // Calculations
  const [receivedText, setReceivedText] = useState('0');
  const [receiptInfo, setReceiptInfo] = useState({
    date: '', time: '', subtotal: 0, vat: 0, total: 0, received: 0, change: 0, method: ''
  });
  const [promptPayTimeInfo, setPromptPayTimeInfo] = useState({ date: '', time: '', rawDate: null });

  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!tableNumber && !tableId) return;
      setIsLoading(true);
      try {
        const q = query(
          collection(db, 'Order_Detail'),
          where('TableNumber', '==', String(tableNumber))
        );

        const querySnapshot = await getDocs(q);
        let fetchedItems = [];

        querySnapshot.docs.forEach((docSnap) => {
          const orderData = docSnap.data();
          const itemStatus = orderData.OrderStatus || orderData.Status || orderData.status;

          if (itemStatus === 'เสิร์ฟแล้ว') {
            fetchedItems.push({
              id: docSnap.id,
              menuId: orderData.MenuID || '-',
              name: orderData.MenuName || 'รายการอาหาร',
              quantity: Number(orderData.Quantity) || 1,
              price: Number(orderData.Price) || 0,
              status: itemStatus
            });
          }
        });

        setOrderItems(fetchedItems);
      } catch (error) {
        console.error("Error fetching orders:", error);
        showAlert("ผิดพลาด", "ไม่สามารถดึงข้อมูลรายการอาหารได้");
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrderDetails();
  }, [tableNumber, tableId]);

  // คำนวณราคารวม, VAT 7%, ยอดสุทธิ และเงินทอน
  const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const vatAmount = Math.round(subtotal * 0.07 * 100) / 100;
  const grandTotal = subtotal + vatAmount;

  const receivedAmount = parseFloat(receivedText) || 0;
  const changeAmount = receivedAmount >= grandTotal ? Math.round((receivedAmount - grandTotal) * 100) / 100 : 0;

  const qrCodeUrl = grandTotal > 0
    ? `https://promptpay.io/${PROMPTPAY_NUMBER}/${grandTotal}.png`
    : `https://promptpay.io/${PROMPTPAY_NUMBER}.png`;

  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const showConfirmDialog = (title, message, onConfirm) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed) {
        onConfirm();
      }
    } else {
      Alert.alert(
        title,
        message,
        [
          { text: "ยกเลิก", style: "cancel" },
          { text: "ยืนยันชำระเงิน", onPress: onConfirm }
        ]
      );
    }
  };

  // ฟังก์ชันพิมพ์ใบเสร็จรับเงินสมบูรณ์ (พร้อม VAT, เงินที่จ่าย, เงินทอน)
  const printFinalReceipt = async (paymentMethod, printDate, printTime, receivedVal, changeVal) => {
    try {
      const itemsHtml = orderItems.map(item => `
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
          <span>${item.name} x${item.quantity}</span>
          <span style="font-weight: bold;">฿${(item.quantity * item.price).toLocaleString()}</span>
        </div>
      `).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              @page { size: 58mm auto; margin: 0; }
              body { 
                font-family: 'Sarabun', 'Tahoma', 'Helvetica', sans-serif; 
                text-align: center; 
                width: 240px; 
                margin: 0 auto; 
                padding: 15px 5px; 
                color: #000000;
                background-color: #ffffff;
              }
              .title-main { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
              .time-row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; }
              .dashed { border-bottom: 1px dashed #000000; margin: 8px 0; }
              .table-text { font-size: 16px; font-weight: bold; margin: 6px 0; }
              .calc-row { display: flex; justify-content: space-between; font-size: 12px; margin-top: 4px; }
              .total-row { display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; margin-top: 6px; }
              .footer-text { font-size: 11px; color: #333; margin-top: 10px; }
            </style>
          </head>
          <body>
            <div class="title-main">ร้านยายจุด</div>
            <div class="time-row">
              <span>วันที่ : ${printDate}</span>
              <span>เวลา : ${printTime}</span>
            </div>
            <div class="time-row">
              <span>ชำระโดย : ${paymentMethod}</span>
            </div>
            <div class="dashed"></div>
            <div class="table-text">โต๊ะ : ${tableNumber}</div>
            <div class="dashed"></div>
            <div style="margin: 10px 0;">${itemsHtml}</div>
            <div class="dashed"></div>
            <div class="calc-row">
              <span>ราคารวมสินค้า</span>
              <span>฿${subtotal.toLocaleString()}</span>
            </div>
            <div class="calc-row">
              <span>ภาษีมูลค่าเพิ่ม (VAT 7%)</span>
              <span>฿${vatAmount.toFixed(2)}</span>
            </div>
            <div class="total-row">
              <span>ยอดรวมสุทธิ</span>
              <span>฿${grandTotal.toLocaleString()}</span>
            </div>
            <div class="dashed"></div>
            <div class="calc-row">
              <span>รับเงินมา</span>
              <span>฿${receivedVal.toLocaleString()}</span>
            </div>
            <div class="calc-row" style="font-weight: bold;">
              <span>เงินทอน</span>
              <span>฿${changeVal.toLocaleString()}</span>
            </div>
            <div class="dashed"></div>
            <div class="footer-text">ชำระเงินเรียบร้อยแล้ว ขอบคุณครับ</div>
          </body>
        </html>
      `;

      if (Platform.OS === 'web') {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const pri = iframe.contentWindow;
        pri.document.open();
        pri.document.write(htmlContent);
        pri.document.close();

        setTimeout(() => {
          pri.focus();
          pri.print();
          document.body.removeChild(iframe);
        }, 300);
      } else {
        await Print.printAsync({ html: htmlContent });
      }
    } catch (error) {
      console.error("Receipt Print Error:", error);
    }
  };

  // ฟังก์ชันพิมพ์ใบแจ้งชำระเงิน QR PromptPay
  const handlePrintReceipt = async () => {
    try {
      const now = new Date();
      const printDate = promptPayTimeInfo.date || now.toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const printTime = promptPayTimeInfo.time || now.toLocaleTimeString('th-TH', { hour12: false });

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              @page { size: 58mm auto; margin: 0; }
              body { 
                font-family: 'Sarabun', 'Tahoma', 'Helvetica', sans-serif; 
                text-align: center; 
                width: 240px; 
                margin: 0 auto; 
                padding: 15px 5px; 
                color: #000000;
                background-color: #ffffff;
              }
              .title-sub { font-size: 13px; margin-bottom: 2px; }
              .title-main { font-size: 16px; font-weight: bold; margin-bottom: 6px; }
              .dashed { border-bottom: 1px dashed #000000; margin: 8px 0; }
              .table-text { font-size: 15px; margin: 4px 0; }
              .promptpay-box { display: inline-block; border: 1.5px solid #003366; padding: 2px 10px; border-radius: 3px; margin: 8px 0 4px 0; }
              .promptpay-text { color: #003366; font-weight: bold; font-size: 13px; font-style: italic; }
              .qr-container { display: flex; justify-content: center; align-items: center; margin: 6px 0; }
              .qr-img { width: 160px; height: 160px; display: block; margin: 0 auto; }
              .calc-row { display: flex; justify-content: space-between; font-size: 12px; margin-top: 3px; }
              .amount-text { font-size: 18px; font-weight: bold; margin: 6px 0 10px 0; }
              .footer-row { display: flex; justify-content: space-between; font-size: 11px; color: #000; margin-top: 8px; }
            </style>
          </head>
          <body>
            <div class="title-sub">สแกน QR Code เพื่อจ่ายเงิน</div>
            <div class="title-main">ร้านยายจุด</div>
            <div class="dashed"></div>
            <div class="table-text">โต๊ะ : ${tableNumber}</div>
            <div class="dashed"></div>
            <div class="promptpay-box"><span class="promptpay-text">Prompt Pay</span></div>
            <div class="qr-container"><img class="qr-img" id="qrImage" src="${qrCodeUrl}" /></div>
            <div class="calc-row">
              <span>ราคารวม: ฿${subtotal.toLocaleString()}</span>
              <span>VAT 7%: ฿${vatAmount.toFixed(2)}</span>
            </div>
            <div class="amount-text">ยอดรวมสุทธิ: ฿${grandTotal.toLocaleString()}</div>
            <div class="footer-row"><span>${printDate}</span><span>${printTime}</span></div>
          </body>
        </html>
      `;

      if (Platform.OS === 'web') {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const pri = iframe.contentWindow;
        pri.document.open();
        pri.document.write(htmlContent);
        pri.document.close();

        const qrImg = pri.document.getElementById('qrImage');
        const triggerPrint = () => {
          setTimeout(() => {
            pri.focus();
            pri.print();
            document.body.removeChild(iframe);
          }, 200);
        };

        if (qrImg.complete) {
          triggerPrint();
        } else {
          qrImg.onload = triggerPrint;
          qrImg.onerror = triggerPrint;
        }
      } else {
        await Print.printAsync({ html: htmlContent });
      }
    } catch (error) {
      console.error("Print Error:", error);
      showAlert("การพิมพ์ขัดข้อง", "ไม่สามารถเชื่อมต่อกับเครื่องพิมพ์ได้");
    }
  };

  const handleNumpad = (val) => {
    if (val === 'DEL') {
      setReceivedText((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
    } else if (val === '100' || val === '500' || val === '1000') {
      setReceivedText(val);
    } else {
      setReceivedText((prev) => (prev === '0' ? val : prev + val));
    }
  };

  const openCashModal = () => {
    if (orderItems.length === 0) {
      showAlert("แจ้งเตือน", "ไม่มีรายการอาหารที่มีสถานะ 'เสิร์ฟแล้ว' ที่ต้องชำระเงิน");
      return;
    }
    setReceivedText('0');
    setIsCashModalVisible(true);
  };

  const openPromptPayModal = () => {
    if (orderItems.length === 0) {
      showAlert("แจ้งเตือน", "ไม่มีรายการอาหารที่มีสถานะ 'เสิร์ฟแล้ว' ที่ต้องชำระเงิน");
      return;
    }
    const now = new Date();
    const formattedDate = now.toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const formattedTime = now.toLocaleTimeString('th-TH', { hour12: false });

    setIsQrLoading(true);
    setPromptPayTimeInfo({
      date: formattedDate,
      time: formattedTime,
      rawDate: now
    });
    setIsPromptPayModalVisible(true);
  };

  const processPayment = async (paymentMethod, customDateObj = null, customReceived = grandTotal, customChange = 0) => {
    try {
      setIsLoading(true);
      const now = customDateObj || new Date();
      const nowISO = now.toISOString();
      const formattedDate = now.toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const formattedTime = now.toLocaleTimeString('th-TH', { hour12: false });

      // 1. บันทึกข้อมูลประวัติชำระเงินลงคอลเลกชัน Payment
      await addDoc(collection(db, 'Payment'), {
        TableID: tableId || tableNumber,
        AmountPaid: grandTotal,
        Subtotal: subtotal,
        Vat: vatAmount,
        ReceivedAmount: customReceived,
        ChangeAmount: customChange,
        PaymentMethod: paymentMethod,
        PaymentDateTime: nowISO,
        SessionToken: sessionToken,
      });

      // 2. บันทึกเข้าคอลเลกชัน Report
      for (const item of orderItems) {
        await addDoc(collection(db, 'Report'), {
          TotalOrders: item.quantity,
          TotalRevenue: item.quantity * item.price,
          DateTime: nowISO,
          Price: item.price,
          Quantity: item.quantity,
          MenuID: item.menuId,
          OrderID: item.id
        });
      }

      // 3. ลบรายการอาหารที่เสิร์ฟแล้วออก
      for (const item of orderItems) {
        const orderRef = doc(db, 'Order_Detail', item.id);
        await deleteDoc(orderRef);
      }

      // 4. เคลียร์รายการที่ถูกยกเลิกออกจาก Order_Detail
      const tableOrdersQ = query(
        collection(db, 'Order_Detail'),
        where('TableNumber', '==', String(tableNumber))
      );
      const tableOrdersSnap = await getDocs(tableOrdersQ);
      for (const docSnap of tableOrdersSnap.docs) {
        const data = docSnap.data();
        const status = data.OrderStatus || data.Status || data.status || '';
        if (status.includes('ยกเลิก')) {
          await deleteDoc(doc(db, 'Order_Detail', docSnap.id));
        }
      }

      // 🟢 หมายเหตุ: ตัดโค้ดเคลียร์สถานะโต๊ะอัตโนมัติออก
      // สถานะโต๊ะจะยังคงเป็น occupied จนกว่าพนักงานจะกดเคลียร์โต๊ะด้วยตัวเองในหน้าผังโต๊ะ

      setReceiptInfo({
        date: formattedDate,
        time: formattedTime,
        subtotal: subtotal,
        vat: vatAmount,
        total: grandTotal,
        received: customReceived,
        change: customChange,
        method: paymentMethod
      });

      setIsCashModalVisible(false);
      setIsPromptPayModalVisible(false);
      setIsReceiptModalVisible(true);

      await printFinalReceipt(paymentMethod, formattedDate, formattedTime, customReceived, customChange);

    } catch (error) {
      console.error("Error confirming payment:", error);
      showAlert("ผิดพลาด", `ไม่สามารถบันทึกการชำระเงินได้: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmCashPayment = () => {
    if (receivedAmount < grandTotal) {
      showAlert("จำนวนเงินไม่ถูกต้อง", "จำนวนเงินที่รับมาน้อยกว่ายอดชำระสุทธิ");
      return;
    }

    showConfirmDialog(
      "ยืนยันการรับเงินสด",
      `โต๊ะ: ${tableNumber}\nราคารวมสินค้า: ฿${subtotal.toLocaleString()}\nVAT 7%: ฿${vatAmount.toFixed(2)}\nยอดชำระสุทธิ: ฿${grandTotal.toLocaleString()}\nรับเงินมา: ฿${receivedAmount.toLocaleString()}\nเงินทอน: ฿${changeAmount.toLocaleString()}\n\nคุณต้องการยืนยันการรับเงินใช่หรือไม่?`,
      () => processPayment('เงินสด', null, receivedAmount, changeAmount)
    );
  };

  const handleConfirmPromptPayPayment = () => {
    showConfirmDialog(
      "ยืนยันการรับเงินสแกนจ่าย",
      `โต๊ะ: ${tableNumber}\nราคารวมสินค้า: ฿${subtotal.toLocaleString()}\nVAT 7%: ฿${vatAmount.toFixed(2)}\nยอดรวมสุทธิ: ฿${grandTotal.toLocaleString()}\n\nคุณได้ตรวจสอบสลิปและยืนยันการรับเงินเรียบร้อยแล้วใช่หรือไม่?`,
      () => processPayment('พร้อมเพย์', promptPayTimeInfo.rawDate, grandTotal, 0)
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>⮌</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>รับชำระเงิน</Text>
          <Text style={styles.headerSubtitle}>โต๊ะ: {tableNumber}</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#333" />
          <Text style={{ marginTop: 10 }}>กำลังดำเนินการ...</Text>
        </View>
      ) : (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentPadding}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>สรุปรายการสั่ง (เฉพาะที่เสิร์ฟแล้ว)</Text>
            <View style={styles.itemList}>
              {orderItems.length > 0 ? orderItems.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <Text style={styles.itemName}>{item.name} {item.quantity}x</Text>
                  <Text style={styles.itemTotal}>฿{(item.quantity * item.price).toLocaleString()}</Text>
                </View>
              )) : (
                <Text style={styles.emptyText}>ไม่พบรายการอาหารที่มีสถานะ "เสิร์ฟแล้ว" ที่รอชำระเงิน</Text>
              )}
            </View>

            <View style={styles.divider} />

            {/* การคำนวณราคารวม, VAT 7% และยอดสุทธิ */}
            <View style={styles.subtotalRow}>
              <Text style={styles.subtotalLabel}>ราคารวมสินค้า</Text>
              <Text style={styles.subtotalAmount}>฿{subtotal.toLocaleString()}</Text>
            </View>

            <View style={styles.subtotalRow}>
              <Text style={styles.subtotalLabel}>ภาษีมูลค่าเพิ่ม (VAT 7%)</Text>
              <Text style={styles.subtotalAmount}>฿{vatAmount.toFixed(2)}</Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>ยอดรวมสุทธิ</Text>
              <Text style={styles.totalAmount}>฿{grandTotal.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>เลือกวิธีชำระเงิน</Text>
            <View style={styles.paymentMethodRow}>
              <TouchableOpacity style={styles.paymentMethodBtn} onPress={openCashModal}>
                <Text style={styles.paymentMethodText}>💵 เงินสด</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.paymentMethodBtn, styles.promptPayBtnStyle]} onPress={openPromptPayModal}>
                <Text style={[styles.paymentMethodText, { color: '#004080' }]}>📱 สแกนพร้อมเพย์</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {/* MODAL 1: คิดเงินสด */}
      <Modal visible={isCashModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.cashModalContainer}>
            <TouchableOpacity style={styles.closeIconBtn} onPress={() => setIsCashModalVisible(false)}>
              <Text style={styles.closeIconText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.blueBanner}>
              <Text style={styles.bannerTableText}>โต๊ะ : {tableNumber}</Text>
              <Text style={styles.bannerAmountText}>ยอดชำระสุทธิ: ฿{grandTotal.toLocaleString()}</Text>
            </View>

            <View style={styles.cashBodyRow}>
              <View style={styles.numpadContainer}>
                <View style={styles.displayBoxRow}>
                  <Text style={styles.displayLabel}>รับเงิน</Text>
                  <Text style={styles.displayValue}>฿{receivedText}</Text>
                </View>
                <View style={styles.displayBoxRow}>
                  <Text style={styles.displayLabel}>เงินทอน</Text>
                  <Text style={[styles.displayValue, { color: '#008000' }]}>฿{changeAmount.toLocaleString()}</Text>
                </View>

                <View style={styles.quickBtnRow}>
                  {['100', '500', '1000'].map((val) => (
                    <TouchableOpacity key={val} style={styles.quickBtn} onPress={() => handleNumpad(val)}>
                      <Text style={styles.quickBtnText}>{val}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.gridNumpad}>
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '00', 'DEL'].map((val) => (
                    <TouchableOpacity
                      key={val}
                      style={[styles.numBtn, val === 'DEL' && { backgroundColor: '#ffcccc' }]}
                      onPress={() => handleNumpad(val)}
                    >
                      <Text style={[styles.numBtnText, val === 'DEL' && { color: '#cc0000' }]}>
                        {val === 'DEL' ? '⌫' : val}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity style={styles.confirmCashBtn} onPress={handleConfirmCashPayment}>
                <Text style={styles.confirmCashBtnText}>ยืนยันการชำระเงิน</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: สแกนชำระเงินแบบพร้อมเพย์ */}
      <Modal visible={isPromptPayModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.promptPayCardContainer}>
            <TouchableOpacity style={styles.closeIconBtn} onPress={() => setIsPromptPayModalVisible(false)}>
              <Text style={styles.closeIconText}>⮌</Text>
            </TouchableOpacity>

            <View style={styles.thaiQrHeader}>
              <Text style={styles.thaiQrHeaderText}>THAI QR PAYMENT</Text>
            </View>

            <View style={styles.promptPayLogoBox}>
              <Text style={styles.promptPayLogoText}>PromptPay</Text>
            </View>

            <View style={styles.qrImageWrapper}>
              {isQrLoading && (
                <View style={styles.qrLoadingOverlay}>
                  <ActivityIndicator size="large" color="#003366" />
                </View>
              )}
              <Image
                source={{ uri: qrCodeUrl }}
                style={styles.qrCodeImg}
                resizeMode="contain"
                onLoadEnd={() => setIsQrLoading(false)}
              />
            </View>

            <Text style={styles.accountNameText}>ชื่อ : {PROMPTPAY_NAME}</Text>
            <Text style={styles.ppAmountText}>ยอดชำระ: ฿{grandTotal.toLocaleString()}</Text>

            <View style={styles.ppDateTimeRow}>
              <Text style={styles.ppDateText}>{promptPayTimeInfo.date}</Text>
              <Text style={styles.ppTimeText}>{promptPayTimeInfo.time}</Text>
            </View>

            <View style={styles.ppActionRow}>
              <TouchableOpacity style={styles.printBillBtn} onPress={handlePrintReceipt}>
                <Text style={styles.printBillBtnText}>🖨️ พิมพ์บิล</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.confirmPpBtn} onPress={handleConfirmPromptPayPayment}>
                <Text style={styles.confirmPpBtnText}>ยืนยันรับเงิน</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      {/* MODAL 3: ใบเสร็จรับเงิน */}
      <Modal visible={isReceiptModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.receiptCard}>
            <TouchableOpacity
              style={styles.receiptCloseBtn}
              onPress={() => {
                setIsReceiptModalVisible(false);
                navigation.goBack();
              }}
            >
              <Text style={styles.receiptCloseText}>✕</Text>
            </TouchableOpacity>

            <Text style={styles.receiptHeaderTitle}>ร้านยายจุด</Text>

            <View style={styles.receiptTimeRow}>
              <Text style={styles.receiptTimeText}>วันที่ : {receiptInfo.date}</Text>
              <Text style={styles.receiptTimeText}>เวลา : {receiptInfo.time}</Text>
            </View>
            <View style={styles.receiptTimeRow}>
              <Text style={styles.receiptTimeText}>ชำระโดย : {receiptInfo.method}</Text>
            </View>

            <Text style={styles.dashedLine}>-----------------------------------------</Text>
            <Text style={styles.receiptTableTitle}>โต๊ะ : {tableNumber}</Text>
            <Text style={styles.dashedLine}>-----------------------------------------</Text>

            <View style={styles.receiptItemsList}>
              {orderItems.map((item) => (
                <View key={item.id} style={styles.receiptItemRow}>
                  <Text style={styles.receiptItemName}>{item.name} {item.quantity}x</Text>
                  <Text style={styles.receiptItemPrice}>฿{(item.quantity * item.price).toLocaleString()}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.dashedLine}>-----------------------------------------</Text>

            {/* ส่วนแสดงการคิดเงิน, VAT, เงินที่จ่าย และเงินทอน บนใบเสร็จ */}
            <View style={styles.receiptCalcRow}>
              <Text style={styles.receiptCalcLabel}>ราคารวมสินค้า</Text>
              <Text style={styles.receiptCalcPrice}>฿{receiptInfo.subtotal?.toLocaleString()}</Text>
            </View>

            <View style={styles.receiptCalcRow}>
              <Text style={styles.receiptCalcLabel}>ภาษีมูลค่าเพิ่ม (VAT 7%)</Text>
              <Text style={styles.receiptCalcPrice}>฿{receiptInfo.vat?.toFixed(2)}</Text>
            </View>

            <View style={styles.receiptTotalRow}>
              <Text style={styles.receiptTotalLabel}>ยอดรวมสุทธิ</Text>
              <Text style={styles.receiptTotalAmount}>฿{receiptInfo.total?.toLocaleString()}</Text>
            </View>

            <Text style={styles.dashedLine}>-----------------------------------------</Text>

            <View style={styles.receiptCalcRow}>
              <Text style={styles.receiptCalcLabel}>รับเงินมา</Text>
              <Text style={styles.receiptCalcPrice}>฿{receiptInfo.received?.toLocaleString()}</Text>
            </View>

            <View style={styles.receiptCalcRow}>
              <Text style={[styles.receiptCalcLabel, { fontWeight: 'bold' }]}>เงินทอน</Text>
              <Text style={[styles.receiptCalcPrice, { fontWeight: 'bold' }]}>฿{receiptInfo.change?.toLocaleString()}</Text>
            </View>

            <Text style={styles.dashedLine}>-----------------------------------------</Text>
            <Text style={styles.receiptFooterText}>ชำระเงินเรียบร้อยแล้ว ขอบคุณครับ</Text>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerContainer: { backgroundColor: '#dcdcdc', paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 15 },
  backBtnText: { fontSize: 28, fontWeight: 'bold', color: '#000' },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  headerSubtitle: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  container: { flex: 1 },
  contentPadding: { padding: 20 },
  card: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cccccc', borderRadius: 8, padding: 20, marginBottom: 20 },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  itemList: { marginBottom: 10 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  itemName: { fontSize: 14, color: '#333' },
  itemTotal: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  emptyText: { textAlign: 'center', color: '#888', marginVertical: 10 },
  divider: { height: 2, backgroundColor: '#888888', marginVertical: 15 },
  
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  subtotalLabel: { fontSize: 13, color: '#555' },
  subtotalAmount: { fontSize: 13, fontWeight: 'bold', color: '#333' },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  totalLabel: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  totalAmount: { fontSize: 16, fontWeight: 'bold', color: '#1ba740' },

  paymentMethodRow: { flexDirection: 'row', gap: 12 },
  paymentMethodBtn: { flex: 1, backgroundColor: '#dcdcdc', borderWidth: 1, borderColor: '#aaaaaa', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  promptPayBtnStyle: { backgroundColor: '#e6f0ff', borderColor: '#004080' },
  paymentMethodText: { fontSize: 14, fontWeight: 'bold', color: '#000' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  closeIconBtn: { position: 'absolute', top: 15, left: 15, zIndex: 10 },
  closeIconText: { fontSize: 24, fontWeight: 'bold', color: '#000' },

  cashModalContainer: { width: '90%', maxWidth: 500, backgroundColor: '#ffffff', borderRadius: 12, overflow: 'hidden', padding: 15 },
  blueBanner: { backgroundColor: '#0088ff', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 15 },
  bannerTableText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  bannerAmountText: { color: 'white', fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  cashBodyRow: { flexDirection: 'row', gap: 10 },
  numpadContainer: { flex: 3 },
  displayBoxRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#e0e0e0', padding: 8, borderRadius: 6, marginBottom: 8 },
  displayLabel: { fontSize: 14, color: '#333' },
  displayValue: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  quickBtnRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  quickBtn: { backgroundColor: '#b3e5fc', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 16 },
  quickBtnText: { fontSize: 14, fontWeight: 'bold', color: '#0288d1' },
  gridNumpad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6 },
  numBtn: { width: '30%', backgroundColor: '#e0e0e0', paddingVertical: 12, alignItems: 'center', borderRadius: 6 },
  numBtnText: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  confirmCashBtn: { flex: 1, backgroundColor: '#00b028', borderRadius: 8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  confirmCashBtnText: { color: 'white', fontSize: 15, fontWeight: 'bold', textAlign: 'center' },

  promptPayCardContainer: {
    width: '85%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingBottom: 20,
    alignItems: 'center',
    overflow: 'hidden'
  },
  thaiQrHeader: {
    backgroundColor: '#003366',
    width: '100%',
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 15
  },
  thaiQrHeaderText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },
  promptPayLogoBox: { borderWidth: 2, borderColor: '#003366', paddingVertical: 3, paddingHorizontal: 16, borderRadius: 4, marginBottom: 10 },
  promptPayLogoText: { color: '#003366', fontWeight: 'bold', fontSize: 16, fontStyle: 'italic' },

  qrImageWrapper: { width: 180, height: 180, justifyContent: 'center', alignItems: 'center', marginVertical: 5 },
  qrLoadingOverlay: { position: 'absolute', zIndex: 2, justifyContent: 'center', alignItems: 'center' },
  qrCodeImg: { width: 180, height: 180 },

  accountNameText: { fontSize: 16, color: '#333333', fontWeight: '500', marginTop: 8, marginBottom: 4 },
  ppAmountText: { fontSize: 20, fontWeight: 'bold', color: '#000', marginVertical: 6 },
  ppDateTimeRow: { flexDirection: 'row', justifyContent: 'space-between', width: '80%', marginBottom: 16 },
  ppDateText: { fontSize: 13, color: '#444' },
  ppTimeText: { fontSize: 13, color: '#444' },
  ppActionRow: { flexDirection: 'row', justifyContent: 'space-between', width: '90%', gap: 12 },
  printBillBtn: { flex: 1, backgroundColor: '#9e9e9e', paddingVertical: 10, borderRadius: 18, alignItems: 'center' },
  printBillBtnText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  confirmPpBtn: { flex: 1, backgroundColor: '#38c172', paddingVertical: 10, borderRadius: 18, alignItems: 'center' },
  confirmPpBtnText: { color: 'white', fontSize: 14, fontWeight: 'bold' },

  receiptCard: {
    backgroundColor: '#ffffff',
    width: 320,
    maxWidth: '90%',
    borderRadius: 12,
    padding: 20,
    paddingTop: 28,
    alignItems: 'center',
    position: 'relative',
    elevation: 5,
  },
  receiptCloseBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  receiptCloseText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555555',
  },
  receiptHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: '#000', marginBottom: 15 },
  receiptTimeRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 4 },
  receiptTimeText: { fontSize: 12, color: '#333' },
  dashedLine: { color: '#555', marginVertical: 6, letterSpacing: -1 },
  receiptTableTitle: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  receiptItemsList: { width: '100%', marginVertical: 6 },
  receiptItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  receiptItemName: { fontSize: 13, color: '#000' },
  receiptItemPrice: { fontSize: 13, fontWeight: 'bold', color: '#000' },

  receiptCalcRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 4 },
  receiptCalcLabel: { fontSize: 12, color: '#333' },
  receiptCalcPrice: { fontSize: 12, color: '#000' },

  receiptTotalRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 4 },
  receiptTotalLabel: { fontSize: 15, fontWeight: 'bold', color: '#000' },
  receiptTotalAmount: { fontSize: 15, fontWeight: 'bold', color: '#000' },
  receiptFooterText: { fontSize: 12, color: '#555', marginTop: 5 }
});