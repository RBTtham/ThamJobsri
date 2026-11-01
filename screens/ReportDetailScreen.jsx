// File: screens/ReportDetailScreen.jsx
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, SafeAreaView, 
  TouchableOpacity, Modal, ActivityIndicator, Platform, Alert 
} from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase'; 
import * as Print from 'expo-print'; // 🟢 นำเข้า expo-print สำหรับสร้าง/พิมพ์ PDF

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

const THAI_FULL_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export default function ReportDetailScreen({ navigation }) {
  // 🟢 1. กำหนดช่วงวันที่เริ่มต้น (ย้อนหลัง 7 วัน) และ วันที่สิ้นสุด (วันนี้)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  });
  const [endDate, setEndDate] = useState(() => new Date());

  // State สำหรับโหมดการจัดอันดับ ('qty' = เรียงตามยอดรายการ, 'revenue' = เรียงตามรายได้)
  const [sortBy, setSortBy] = useState('qty');

  // State สำหรับควบคุม Modal ปฏิทิน
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [selectingTarget, setSelectingTarget] = useState('start'); // 'start' หรือ 'end'
  
  // 🟢 State ควบคุม Modal เมนู 3 ขีด (Hamburger Menu)
  const [sideMenuVisible, setSideMenuVisible] = useState(false);

  // State ภายในปฏิทิน
  const [calMonthIndex, setCalMonthIndex] = useState(() => new Date().getMonth());
  const [calYearBE, setCalYearBE] = useState(() => new Date().getFullYear() + 543);
  const [calDay, setCalDay] = useState(() => new Date().getDate());

  const [isLoading, setIsLoading] = useState(true);
  const [reportList, setReportList] = useState([]);

  // ฟังก์ชันแปลง Date เป็นข้อความภาษาไทย
  const formatThaiDate = (dateObj) => {
    if (!dateObj) return '';
    const day = dateObj.getDate();
    const month = THAI_MONTHS_SHORT[dateObj.getMonth()];
    const yearBE = dateObj.getFullYear() + 543;
    return `${day} ${month} ${yearBE}`;
  };

  // 🟢 2. ดึงข้อมูลและกรองตามช่วงวันที่ (Start Date - End Date)
  const fetchDetailReport = async () => {
    try {
      setIsLoading(true);

      const menuCollection = collection(db, 'Menu');
      const menuSnapshot = await getDocs(menuCollection);
      const menuMap = {};
      menuSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const key = data.MenuID || doc.id;
        menuMap[key] = data.MenuName || data.name || key;
      });

      const reportCollection = collection(db, 'Report');
      const reportSnapshot = await getDocs(reportCollection);

      const dishMap = {};

      const startRange = new Date(startDate);
      startRange.setHours(0, 0, 0, 0);

      const endRange = new Date(endDate);
      endRange.setHours(23, 59, 59, 999);

      reportSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const menuID = data.MenuID || 'Unknown';
        const qty = Number(data.Quantity) || 0;
        const price = Number(data.Price) || 0;
        const revenue = Number(data.TotalRevenue) !== undefined ? Number(data.TotalRevenue) : (price * qty);

        let isMatch = true;
        if (data.DateTime) {
          const reportDate = new Date(data.DateTime);
          isMatch = (reportDate >= startRange && reportDate <= endRange);
        }

        if (isMatch) {
          const menuName = menuMap[menuID] || `เมนู (${menuID})`;
          if (dishMap[menuID]) {
            dishMap[menuID].qty += qty;
            dishMap[menuID].revenue += revenue;
          } else {
            dishMap[menuID] = {
              name: menuName,
              qty: qty,
              revenue: revenue
            };
          }
        }
      });

      const result = Object.values(dishMap).sort((a, b) => {
        if (sortBy === 'qty') {
          return b.qty - a.qty || b.revenue - a.revenue;
        }
        return b.revenue - a.revenue || b.qty - a.qty;
      });

      setReportList(result);
    } catch (error) {
      console.error("Error fetching detail report: ", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetailReport();
  }, [startDate, endDate, sortBy]);

  // คำนวณสรุปผล KPI
  const totalQty = reportList.reduce((sum, item) => sum + item.qty, 0);
  const totalRev = reportList.reduce((sum, item) => sum + item.revenue, 0);
  const topSellingDish = reportList.length > 0 ? reportList[0].name : '-';
  const maxMetricValue = reportList.length > 0 
    ? (sortBy === 'qty' ? reportList[0].qty : reportList[0].revenue) 
    : 1;

  // 📄 ฟังก์ชันสร้าง HTML สำหรับออกเอกสาร PDF
  const generateHTMLReport = () => {
    const tableRowsHtml = reportList.map((item, index) => `
      <tr>
        <td style="text-align: center; font-weight: bold;">${index + 1}</td>
        <td>${item.name}</td>
        <td style="text-align: center;">${item.qty.toLocaleString()} รายการ</td>
        <td style="text-align: right; font-weight: bold;">${item.revenue.toLocaleString()} บาท</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Sarabun', Arial, sans-serif; color: #1e293b; padding: 10px; }
          .header-box { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
          .title { font-size: 22px; font-weight: bold; color: #1e293b; margin: 0; }
          .subtitle { font-size: 13px; color: #64748b; margin-top: 5px; }
          .date-badge { display: inline-block; background-color: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: bold; margin-bottom: 20px; }
          .kpi-container { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 20px; }
          .kpi-card { flex: 1; border: 1px solid #e2e8f0; background-color: #f8fafc; border-radius: 8px; padding: 12px; text-align: center; }
          .kpi-title { font-size: 12px; color: #64748b; font-weight: bold; }
          .kpi-value { font-size: 18px; font-weight: bold; margin-top: 4px; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background-color: #2563eb; color: #ffffff; font-size: 12px; padding: 10px 8px; text-align: left; }
          td { padding: 9px 8px; font-size: 12px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .total-row { background-color: #f1f5f9 !important; font-weight: bold; border-top: 2px solid #cbd5e1; }
          .footer { margin-top: 30px; text-align: right; font-size: 11px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <h1 class="title">รายงานสรุปยอดขาย (Sales Summary Report)</h1>
          <p class="subtitle">ออกรายงานเมื่อ: ${formatThaiDate(new Date())}</p>
        </div>

        <div style="text-align: center;">
          <div class="date-badge">
            📅 ช่วงเวลา: ${formatThaiDate(startDate)}  ➔  ${formatThaiDate(endDate)}
          </div>
        </div>

        <div class="kpi-container">
          <div class="kpi-card">
            <div class="kpi-title">รายได้รวมทั้งหมด</div>
            <div class="kpi-value" style="color: #1d4ed8;">${totalRev.toLocaleString()} บาท</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">ยอดขายรวม</div>
            <div class="kpi-value" style="color: #15803d;">${totalQty.toLocaleString()} รายการ</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">เมนูขายดีที่สุด</div>
            <div class="kpi-value" style="color: #b45309; font-size: 15px;">${topSellingDish}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 50px; text-align: center;">อันดับ</th>
              <th>รายการเมนู</th>
              <th style="width: 120px; text-align: center;">ยอดรายการขาย</th>
              <th style="width: 130px; text-align: right;">รายได้รวม</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml.length > 0 ? tableRowsHtml : `<tr><td colspan="4" style="text-align:center;">ไม่มีข้อมูลในช่วงวันที่เลือก</td></tr>`}
            <tr class="total-row">
              <td colspan="2" style="text-align: right;">รวมยอดทั้งหมด:</td>
              <td style="text-align: center; color: #15803d;">${totalQty.toLocaleString()} รายการ</td>
              <td style="text-align: right; color: #1d4ed8;">${totalRev.toLocaleString()} บาท</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          รายงานระบบจัดการร้านอาหาร • พิมพ์โดยอัตโนมัติ
        </div>
      </body>
      </html>
    `;
  };

  // 🖨️ ฟังก์ชันจัดการพิมพ์ PDF
  const handlePrintPDF = async () => {
    if (reportList.length === 0) {
      if (Platform.OS === 'web') {
        alert('ไม่มีข้อมูลยอดขายสำหรับพิมพ์เอกสาร');
      } else {
        Alert.alert('แจ้งเตือน', 'ไม่มีข้อมูลยอดขายสำหรับพิมพ์เอกสาร');
      }
      return;
    }

    try {
      const htmlContent = generateHTMLReport();

      if (Platform.OS === 'web') {
        // สำหรับ Web: เปิดหน้าต่างใหม่เพื่อสั่งพิมพ์
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(htmlContent);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
            printWindow.close();
          }, 300);
        }
      } else {
        // สำหรับ Mobile (iOS/Android): ใช้ expo-print สั่งพิมพ์/ออก PDF
        await Print.printAsync({ html: htmlContent });
      }
    } catch (error) {
      console.error("Print Error: ", error);
    }
  };

  const openCalendar = (target) => {
    setSelectingTarget(target);
    const targetDate = target === 'start' ? startDate : endDate;
    setCalDay(targetDate.getDate());
    setCalMonthIndex(targetDate.getMonth());
    setCalYearBE(targetDate.getFullYear() + 543);
    setIsCalendarVisible(true);
  };

  const handleConfirmCalendar = () => {
    const selectedYearAD = calYearBE - 543;
    const newSelectedDate = new Date(selectedYearAD, calMonthIndex, calDay);

    if (selectingTarget === 'start') {
      if (newSelectedDate > endDate) {
        setEndDate(newSelectedDate);
      }
      setStartDate(newSelectedDate);
    } else {
      if (newSelectedDate < startDate) {
        setStartDate(newSelectedDate);
      }
      setEndDate(newSelectedDate);
    }
    setIsCalendarVisible(false);
  };

  const handleLogout = () => {
    setSideMenuVisible(false);
    if (Platform.OS === 'web') {
      localStorage.removeItem('userRole');
    }
    navigation.navigate('RoleSelection');
  };

  const getRankBadge = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Report');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 👑 Header Bar */}
      <View style={styles.topHeaderNav}>
        
        <Text style={styles.headerTitle}>แดชบอร์ดสรุปยอดขาย</Text>
        
        <View style={styles.topRightRow}>
          {/* 🖨️ ปุ่มสั่งพิมพ์ PDF (เพิ่มเข้ามาใหม่) */}
          <TouchableOpacity 
            style={styles.pdfBtn} 
            onPress={handlePrintPDF}
            activeOpacity={0.7}
          >
            <Text style={styles.pdfBtnText}>🖨️ PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn} onPress={fetchDetailReport}>
            <Text style={styles.headerIconText}>🔄</Text>
          </TouchableOpacity>

          {/* ☰ ปุ่ม 3 ขีด ด้านขวาบน */}
          <TouchableOpacity 
            style={styles.hamburgerBtn} 
            onPress={() => setSideMenuVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.hamburgerIcon}>☰</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.mainContainer} showsVerticalScrollIndicator={false}>
        
        {/* 🗓️ ส่วนเลือกช่วงวัน */}
        <View style={styles.rangeCard}>
          <Text style={styles.cardSectionTitle}>📅 เลือกช่วงเวลาที่ต้องการดูรายงาน</Text>
          <View style={styles.datePickerRow}>
            
            <TouchableOpacity 
              style={styles.dateBtn} 
              onPress={() => openCalendar('start')}
            >
              <Text style={styles.dateLabelText}>เริ่มต้น</Text>
              <Text style={styles.dateValueText}>{formatThaiDate(startDate)}</Text>
            </TouchableOpacity>

            <Text style={styles.arrowBetween}>➔</Text>

            <TouchableOpacity 
              style={styles.dateBtn} 
              onPress={() => openCalendar('end')}
            >
              <Text style={styles.dateLabelText}>สิ้นสุด</Text>
              <Text style={styles.dateValueText}>{formatThaiDate(endDate)}</Text>
            </TouchableOpacity>

          </View>
        </View>

        {/* 📊 KPI Dashboard Cards */}
        <View style={styles.kpiGrid}>
          
          {/* Card 1: ยอดขายรวม */}
          <View style={[styles.kpiCard, styles.kpiRevenueCard]}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiIcon}>💵</Text>
              <Text style={styles.kpiTitle}>รายได้รวมทั้งหมด</Text>
            </View>
            <Text style={styles.kpiValueRevenue}>{totalRev.toLocaleString()}</Text>
            <Text style={styles.kpiUnit}>บาท</Text>
          </View>

          {/* Card 2: ยอดรายการรวม */}
          <View style={[styles.kpiCard, styles.kpiQtyCard]}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiIcon}>📊</Text>
              <Text style={styles.kpiTitle}>ยอดรายการรวมที่ขายได้</Text>
            </View>
            <Text style={styles.kpiValueQty}>{totalQty.toLocaleString()}</Text>
            <Text style={styles.kpiUnit}>รายการ (จาน)</Text>
          </View>

          {/* Card 3: เมนูขายดีที่สุด */}
          <View style={[styles.kpiCard, styles.kpiTopCard]}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiIcon}>👑</Text>
              <Text style={styles.kpiTitle}>
                {sortBy === 'qty' ? 'เมนูที่ถูกสั่งซื้อมากที่สุด' : 'เมนูทำรายได้สูงสุด'}
              </Text>
            </View>
            <Text style={styles.kpiValueTop} numberOfLines={1}>{topSellingDish}</Text>
            <Text style={styles.kpiSubTop}>
              {reportList[0] 
                ? `ขายได้ ${reportList[0].qty.toLocaleString()} รายการ (${reportList[0].revenue.toLocaleString()} บาท)` 
                : 'ไม่มีข้อมูล'}
            </Text>
          </View>

        </View>

        {/* 📋 รายละเอียดตารางแบบ แดชบอร์ด */}
        <View style={styles.tableCard}>
          <View style={styles.tableHeaderContainer}>
            <Text style={styles.tableTitle}>🏆 ตารางจัดอันดับเมนูอาหาร</Text>
            
            {/* ปุ่มเลือกสลับการจัดอันดับ */}
            <View style={styles.sortToggleRow}>
              <TouchableOpacity 
                style={[styles.sortBtn, sortBy === 'qty' && styles.activeSortBtn]} 
                onPress={() => setSortBy('qty')}
              >
                <Text style={[styles.sortBtnText, sortBy === 'qty' && styles.activeSortBtnText]}>
                  📦 อันดับยอดรายการ
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.sortBtn, sortBy === 'revenue' && styles.activeSortBtn]} 
                onPress={() => setSortBy('revenue')}
              >
                <Text style={[styles.sortBtnText, sortBy === 'revenue' && styles.activeSortBtnText]}>
                  💰 อันดับรายได้
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingText}>กำลังโหลดข้อมูล...</Text>
            </View>
          ) : reportList.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>ไม่มีข้อมูลยอดขายในช่วงวันที่เลือก</Text>
            </View>
          ) : (
            <View>
              {/* Header ตาราง */}
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thCell, { width: 50, textAlign: 'center' }]}>อันดับ</Text>
                <Text style={[styles.thCell, { flex: 2 }]}>รายการเมนู</Text>
                <Text style={[
                  styles.thCell, 
                  { width: 90, textAlign: 'center' },
                  sortBy === 'qty' && styles.highlightTh
                ]}>
                  ยอดรายการ
                </Text>
                <Text style={[
                  styles.thCell, 
                  { flex: 1.2, textAlign: 'right' },
                  sortBy === 'revenue' && styles.highlightTh
                ]}>
                  รายได้ (บาท)
                </Text>
              </View>

              {/* Data Rows */}
              {reportList.map((item, index) => {
                const currentVal = sortBy === 'qty' ? item.qty : item.revenue;
                const percent = Math.round((currentVal / maxMetricValue) * 100);

                return (
                  <View key={index} style={styles.tableBodyRow}>
                    <View style={styles.rowTopLine}>
                      <Text style={[styles.rankText, { width: 50, textAlign: 'center' }]}>
                        {getRankBadge(index)}
                      </Text>
                      <Text style={[styles.dishNameText, { flex: 2 }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[
                        styles.qtyText, 
                        { width: 90, textAlign: 'center' },
                        sortBy === 'qty' && styles.highlightQty
                      ]}>
                        {item.qty.toLocaleString()} รายการ
                      </Text>
                      <Text style={[
                        styles.revenueText, 
                        { flex: 1.2, textAlign: 'right' },
                        sortBy === 'revenue' && styles.highlightRevenue
                      ]}>
                        {item.revenue.toLocaleString()}
                      </Text>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressTrack}>
                      <View style={[
                        styles.progressBar, 
                        { width: `${percent}%` },
                        sortBy === 'qty' && { backgroundColor: '#16a34a' }
                      ]} />
                    </View>
                  </View>
                );
              })}

              {/* Total Footer */}
              <View style={styles.tableTotalRow}>
                <Text style={styles.totalLabel}>รวมยอดทั้งหมด</Text>
                <Text style={styles.totalQtyVal}>{totalQty.toLocaleString()} รายการ</Text>
                <Text style={styles.totalRevVal}>{totalRev.toLocaleString()} บาท</Text>
              </View>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 🗓️ Modal เลือกปฏิทิน */}
      <Modal visible={isCalendarVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.calendarCard}>
            <Text style={styles.modalTitle}>
              เลือกวันที่ {selectingTarget === 'start' ? 'เริ่มต้น' : 'สิ้นสุด'}
            </Text>

            <View style={styles.monthHeaderRow}>
              <TouchableOpacity onPress={() => setCalMonthIndex(m => (m === 0 ? 11 : m - 1))}>
                <Text style={styles.navMonthBtn}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.monthHeaderText}>
                {THAI_FULL_MONTHS[calMonthIndex]} {calYearBE}
              </Text>
              <TouchableOpacity onPress={() => setCalMonthIndex(m => (m === 11 ? 0 : m + 1))}>
                <Text style={styles.navMonthBtn}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.daysHeaderGrid}>
              {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((d, i) => (
                <Text key={d} style={[styles.dayHeaderCell, i === 0 && { color: '#ef4444' }]}>{d}</Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                const isSelected = day === calDay;
                return (
                  <TouchableOpacity 
                    key={day} 
                    style={[styles.dayCell, isSelected && styles.selectedDayCell]}
                    onPress={() => setCalDay(day)}
                  >
                    <Text style={[styles.dayText, isSelected && styles.selectedDayText]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => setIsCalendarVisible(false)}
              >
                <Text style={styles.cancelBtnText}>ยกเลิก</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.confirmBtn} 
                onPress={handleConfirmCalendar}
              >
                <Text style={styles.confirmBtnText}>ตกลง</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🟢 Modal เมนู 3 ขีด (Hamburger Menu Popup) */}
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
                navigation.navigate('Report');
              }}
            >
              <Text style={styles.menuItemText}>📊 รายงาน</Text>
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
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  
  // Header Nav
  topHeaderNav: { 
    height: 56, 
    backgroundColor: '#ffffff', 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    elevation: 2
  },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  headerIconText: { fontSize: 14, fontWeight: '600', color: '#2563eb' },
  iconBtn: { padding: 6 },
  topRightRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // ปุ่มพิมพ์ PDF (สไตล์ปุ่มแดงเด่นชัด)
  pdfBtn: {
    backgroundColor: '#ef4444',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  pdfBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold'
  },

  hamburgerBtn: { backgroundColor: '#ffffff', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1' },
  hamburgerIcon: { fontSize: 18, color: '#1e293b', fontWeight: 'bold' },

  mainContainer: { flex: 1, padding: 16 },

  // Date Range Card
  rangeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1
  },
  cardSectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#334155', marginBottom: 12 },
  datePickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center'
  },
  dateLabelText: { fontSize: 11, color: '#64748b', marginBottom: 2 },
  dateValueText: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  arrowBetween: { fontSize: 16, color: '#94a3b8', marginHorizontal: 8 },

  // KPI Grid
  kpiGrid: { gap: 12, marginBottom: 16 },
  kpiCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2
  },
  kpiRevenueCard: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  kpiQtyCard: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  kpiTopCard: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },

  kpiHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  kpiIcon: { fontSize: 18, marginRight: 8 },
  kpiTitle: { fontSize: 13, fontWeight: '600', color: '#475569' },
  
  kpiValueRevenue: { fontSize: 26, fontWeight: 'bold', color: '#1d4ed8' },
  kpiValueQty: { fontSize: 26, fontWeight: 'bold', color: '#15803d' },
  kpiValueTop: { fontSize: 18, fontWeight: 'bold', color: '#b45309' },
  kpiSubTop: { fontSize: 12, color: '#d97706', marginTop: 2 },
  kpiUnit: { fontSize: 12, color: '#64748b', alignSelf: 'flex-end', marginTop: -12 },

  // Table Card
  tableCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2
  },
  tableHeaderContainer: {
    marginBottom: 14
  },
  tableTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginBottom: 10 },
  
  // Toggle Switch
  sortToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 4,
    gap: 4
  },
  sortBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8
  },
  activeSortBtn: {
    backgroundColor: '#ffffff',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2
  },
  sortBtnText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  activeSortBtnText: { color: '#2563eb', fontWeight: 'bold' },

  loadingBox: { padding: 30, alignItems: 'center' },
  loadingText: { marginTop: 8, color: '#64748b', fontSize: 13 },
  emptyRow: { padding: 30, alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontSize: 13 },

  tableHeaderRow: { 
    flexDirection: 'row', 
    paddingVertical: 8, 
    borderBottomWidth: 1, 
    borderBottomColor: '#cbd5e1',
    marginBottom: 8 
  },
  thCell: { fontSize: 12, fontWeight: 'bold', color: '#475569' },
  highlightTh: { color: '#2563eb' },

  tableBodyRow: { 
    paddingVertical: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f1f5f9' 
  },
  rowTopLine: { flexDirection: 'row', alignItems: 'center' },
  rankText: { fontSize: 13, fontWeight: 'bold', color: '#334155' },
  dishNameText: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  qtyText: { fontSize: 13, color: '#475569' },
  highlightQty: { color: '#16a34a', fontWeight: 'bold' },
  revenueText: { fontSize: 14, fontWeight: 'bold', color: '#475569' },
  highlightRevenue: { color: '#2563eb' },

  progressTrack: { 
    height: 6, 
    backgroundColor: '#e2e8f0', 
    borderRadius: 3, 
    marginTop: 8, 
    overflow: 'hidden',
    marginLeft: 50 
  },
  progressBar: { height: '100%', backgroundColor: '#2563eb', borderRadius: 3 },

  tableTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
    marginTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#e2e8f0'
  },
  totalLabel: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  totalQtyVal: { fontSize: 14, fontWeight: 'bold', color: '#16a34a' },
  totalRevVal: { fontSize: 16, fontWeight: 'bold', color: '#2563eb' },

  // Calendar Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', alignItems: 'center' },
  calendarCard: { width: '85%', backgroundColor: '#ffffff', borderRadius: 20, padding: 20, alignItems: 'center' },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 16 },
  
  monthHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: 12, paddingHorizontal: 10 },
  navMonthBtn: { fontSize: 24, color: '#2563eb', fontWeight: 'bold', paddingHorizontal: 12 },
  monthHeaderText: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },

  daysHeaderGrid: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', marginBottom: 10 },
  dayHeaderCell: { width: '13%', textAlign: 'center', fontSize: 12, fontWeight: 'bold', color: '#64748b' },

  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', justifyContent: 'flex-start' },
  dayCell: { width: '14.28%', height: 38, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  selectedDayCell: { backgroundColor: '#2563eb', borderRadius: 19 },
  dayText: { fontSize: 13, color: '#334155' },
  selectedDayText: { color: '#ffffff', fontWeight: 'bold' },

  modalButtonRow: { flexDirection: 'row', justifyContent: 'flex-end', width: '100%', marginTop: 16, gap: 10 },
  cancelBtn: { backgroundColor: '#f1f5f9', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  cancelBtnText: { color: '#475569', fontSize: 13, fontWeight: 'bold' },
  confirmBtn: { backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  confirmBtnText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },

  // Side Menu Modal
  sideMenuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-start', alignItems: 'flex-end', padding: 16, paddingTop: 60 },
  sideMenuCard: { width: 280, backgroundColor: '#ffffff', borderRadius: 16, padding: 16, elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10 },
  sideMenuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#eee', marginBottom: 6 },
  sideMenuTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sideMenuHeaderIcon: { fontSize: 18, color: '#111' },
  sideMenuTitle: { fontSize: 16, fontWeight: 'bold', color: '#111' },
  closeMenuBtn: { fontSize: 20, color: '#666', fontWeight: 'bold', padding: 4 },
  
  menuItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  menuItemText: { fontSize: 15, fontWeight: '600', color: '#222' },
  menuItemArrow: { fontSize: 18, color: '#888', fontWeight: 'bold' }
});