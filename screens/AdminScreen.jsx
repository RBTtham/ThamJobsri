// File: screens/AdminScreen.jsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, Image, Dimensions, ActivityIndicator,
  Modal, TextInput, Switch, Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { fetchMenus, addMenu, updateMenu, deleteMenu } from '../services/firebase';

const { width } = Dimensions.get('window');

export default function AdminScreen({ navigation }) {
  const [menu, setMenu] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 🟢 State สำหรับการค้นหา และกรองหมวดหมู่
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ทั้งหมด');

  // State สำหรับควบคุม Modal เพิ่ม/แก้ไขเมนู
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  // State สำหรับควบคุม Modal เมนู 3 ขีด (Hamburger Menu)
  const [sideMenuVisible, setSideMenuVisible] = useState(false);

  const [menuName, setMenuName] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFileName, setImageFileName] = useState('ยังไม่ได้เลือกไฟล์รูปภาพ');
  const [category, setCategory] = useState('อาหารตามสั่ง');
  const [status, setStatus] = useState(true);
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const categoryOptions = ['อาหารตามสั่ง', 'เครื่องดื่ม', 'ของทานเล่น'];
  const filterCategories = ['ทั้งหมด', 'อาหารตามสั่ง', 'เครื่องดื่ม', 'ของทานเล่น'];

  const loadMenus = async () => {
    try {
      setIsLoading(true);
      const data = await fetchMenus();
      setMenu(data);
    } catch (error) {
      console.error("Error fetching menu in Admin screen: ", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMenus();
  }, []);

  // 🟢 ฟังก์ชันกรองข้อมูล และเรียงลำดับตามชื่อตัวอักษร (ก - ฮ) ให้อัตโนมัติ
  const getProcessedMenu = () => {
    let processed = [...menu];

    // 1. กรองตามคำค้นหา (Search Query)
    if (searchQuery.trim() !== '') {
      processed = processed.filter(item =>
        (item.MenuName || '').toLowerCase().includes(searchQuery.trim().toLowerCase())
      );
    }

    // 2. กรองตามหมวดหมู่ (Category Filter)
    if (filterCategory !== 'ทั้งหมด') {
      processed = processed.filter(item => (item.Category || 'อาหารตามสั่ง') === filterCategory);
    }

    // 3. เรียงลำดับตามชื่อตัวอักษร (ก - ฮ) อัตโนมัติ
    processed.sort((a, b) => (a.MenuName || '').localeCompare(b.MenuName || '', 'th'));

    return processed;
  };

  const clearForm = () => {
    setMenuName('');
    setPrice('');
    setImageUrl('');
    setImageFileName('ยังไม่ได้เลือกไฟล์รูปภาพ');
    setCategory('อาหารตามสั่ง');
    setStatus(true);
    setSelectedId(null);
    setDropdownVisible(false);
  };

  const handleOpenAddModal = () => {
    setIsEditMode(false);
    clearForm();
    setModalVisible(true);
  };

  const handleOpenEditModal = (item) => {
    setIsEditMode(true);
    setSelectedId(item.id);
    setMenuName(item.MenuName || '');
    setPrice(item.Price ? String(item.Price) : '');
    setImageUrl(item.Image || '');
    setImageFileName(item.Image ? 'CURRENT_IMAGE.jpg' : 'ยังไม่ได้เลือกไฟล์รูปภาพ');
    setCategory(item.Category || 'อาหารตามสั่ง');
    setStatus(item.Status === "true");
    setDropdownVisible(false);
    setModalVisible(true);
  };

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      window.alert("สิทธิ์ถูกปฏิเสธ์: กรุณาอนุญาตให้เข้าถึงคลังรูปภาพเพื่ออัปโหลดรูปอาหาร");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      const base64Uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setImageUrl(base64Uri);
      const filename = result.assets[0].uri.split('/').pop();
      setImageFileName(filename || 'UPLOADED_IMAGE.jpg');
    }
  };

  const handleSaveMenu = async () => {
    if (!menuName || !price) {
      window.alert("กรุณากรอกข้อมูล: โปรดกรอกชื่อเมนูและราคาอาหารก่อนทำรายการ");
      return;
    }

    const menuData = {
      MenuName: menuName,
      Category: category,
      Price: price,
      Image: imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c",
      Status: status ? "true" : "false"
    };

    try {
      setIsLoading(true);
      setModalVisible(false);

      if (isEditMode) {
        await updateMenu(selectedId, menuData);
        window.alert("สำเร็จ: แก้ไขข้อมูลเมนูอาหารเรียบร้อยแล้ว");
      } else {
        await addMenu(menuData);
        window.alert("สำเร็จ: เพิ่มเมนูอาหารใหม่เข้าสู่ระบบแล้ว");
      }

      loadMenus();
    } catch (error) {
      console.error("Error saving menu: ", error);
      window.alert(`เกิดข้อผิดพลาด: ไม่สามารถบันทึกข้อมูลได้\nสาเหตุ: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMenu = async (id, name) => {
    const isConfirm = window.confirm(`ยืนยันการลบเมนู\nคุณต้องการลบรายการอาหาร "${name}" ออกจากระบบถาวรหรือไม่?`);

    if (isConfirm) {
      try {
        setIsLoading(true);
        await deleteMenu(id);
        window.alert("สำเร็จ: ลบเมนูอาหารเรียบร้อยแล้ว");
        loadMenus();
      } catch (error) {
        console.error("Error deleting menu: ", error);
        window.alert(`เกิดข้อผิดพลาด: ไม่สามารถลบได้\nสาเหตุ: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // ฟังก์ชันออกจากระบบ
  const handleLogout = () => {
    setSideMenuVisible(false);
    if (Platform.OS === 'web') {
      localStorage.removeItem('userRole');
    }
    navigation.navigate('RoleSelection');
  };

  const filteredAndSortedMenu = getProcessedMenu();

  if (isLoading && menu.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1ba740" />
        <Text style={styles.loadingText}>กำลังเชื่อมต่อจัดการเมนูอาหาร...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 👑 Top Bar Header */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.adminTitle}>จัดการเมนูอาหาร</Text>
          <Text style={styles.adminSubtitle}>ผู้ดูแลระบบ</Text>
        </View>

        {/* ☰ ปุ่ม 3 ขีด ด้านขวา */}
        <TouchableOpacity 
          style={styles.hamburgerBtn} 
          onPress={() => setSideMenuVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.hamburgerIcon}>☰</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* 🟢 ส่วนค้นหาและเลือกหมวดหมู่ */}
        <View style={styles.filterSectionCard}>
          {/* 🔍 ช่องค้นหาชื่อเมนู */}
          <View style={styles.searchBoxContainer}>
            <Text style={styles.searchIconText}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="ค้นหาชื่อเมนูอาหาร..."
              placeholderTextColor="#888"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={styles.clearSearchText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 🏷️ แถบเลือกหมวดหมู่ */}
          <Text style={styles.filterGroupLabel}>หมวดหมู่:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScrollView}>
            {filterCategories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.filterPill, filterCategory === cat && styles.filterPillActive]}
                onPress={() => setFilterCategory(cat)}
              >
                <Text style={[styles.filterPillText, filterCategory === cat && styles.filterPillTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ปุ่มเพิ่มเมนูใหม่ */}
        <TouchableOpacity style={styles.addNewMenuBtn} onPress={handleOpenAddModal}>
          <Text style={styles.addNewMenuText}>➕ เพิ่มเมนูใหม่</Text>
        </TouchableOpacity>

        {/* แสดงผลรายการเมนูอาหาร */}
        {filteredAndSortedMenu.length === 0 ? (
          <View style={styles.emptyStateBox}>
            <Text style={styles.emptyStateText}>ไม่พบรายการเมนูอาหารที่ค้นหา</Text>
          </View>
        ) : (
          <View style={styles.menuGrid}>
            {filteredAndSortedMenu.map((item) => (
              <View style={styles.menuCard} key={item.id}>
                {item.Image ? (
                  <Image source={{ uri: item.Image }} style={styles.menuImage} />
                ) : (
                  <View style={[styles.menuImage, { backgroundColor: '#bbb', justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ color: '#fff', fontSize: 12 }}>ไม่มีภาพประกอบ</Text>
                  </View>
                )}
                <View style={[styles.statusDot, { backgroundColor: item.Status === "true" ? '#39ff14' : '#ff0000' }]} />
                <View style={styles.cardContent}>
                  <Text style={styles.menuName} numberOfLines={1}>{item.MenuName}</Text>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{item.Category || 'อาหารตามสั่ง'}</Text>
                  </View>
                  <Text style={styles.priceText}>ราคา: {item.Price || 0} บาท</Text>
                </View>
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity style={styles.editInputBox} onPress={() => handleOpenEditModal(item)}>
                    <Text style={styles.editText}>✏️ แก้ไข</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteMenu(item.id, item.MenuName)}>
                    <Text style={styles.deleteIcon}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>

      {/* 🟢 Modal เมนู 3 ขีด (Hamburger Menu Popup) */}
      <Modal visible={sideMenuVisible} transparent={true} animationType="fade">
        <TouchableOpacity 
          style={styles.sideMenuOverlay} 
          activeOpacity={1} 
          onPress={() => setSideMenuVisible(false)}
        >
          <View style={styles.sideMenuCard} onStartShouldSetResponder={() => true}>
            
            {/* Header เมนู */}
            <View style={styles.sideMenuHeader}>
              <View style={styles.sideMenuTitleRow}>
                <Text style={styles.sideMenuHeaderIcon}>☰</Text>
                <Text style={styles.sideMenuTitle}>เมนูระบบ</Text>
              </View>
              <TouchableOpacity onPress={() => setSideMenuVisible(false)}>
                <Text style={styles.closeMenuBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* ตัวเลือก 1: รหัสผู้ใช้ */}
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

            {/* ตัวเลือก 2: รายงาน */}
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

            {/* ตัวเลือก 3: ออกจากระบบ */}
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

      {/* Modal เพิ่ม/แก้ไข เมนูอาหาร */}
      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalFormBox}>
            <Text style={styles.modalFormTitle}>{isEditMode ? "แก้ไขเมนูอาหาร" : "เพิ่มเมนูใหม่"}</Text>
            <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
              <Text style={styles.fieldLabel}>ชื่อเมนู</Text>
              <TextInput style={styles.formInput} value={menuName} onChangeText={setMenuName} placeholder="ระบุชื่อรายการเมนูอาหาร" />
              <Text style={styles.fieldLabel}>ราคา (บาท)</Text>
              <TextInput style={styles.formInput} value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="ระบุตัวเลขจำนวนเงินราคา" />
              <Text style={styles.fieldLabel}>หมวดหมู่</Text>
              <TouchableOpacity style={styles.dropdownSelector} activeOpacity={0.8} onPress={() => setDropdownVisible(!dropdownVisible)}>
                <Text style={styles.dropdownSelectorText}>{category}</Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>
              {dropdownVisible && (
                <View style={styles.dropdownMenuBox}>
                  {categoryOptions.map((option) => (
                    <TouchableOpacity key={option} style={[styles.dropdownItem, category === option && styles.dropdownItemActive]} onPress={() => { setCategory(option); setDropdownVisible(false); }}>
                      <Text style={[styles.dropdownItemText, category === option && styles.dropdownItemTextActive]}>{option}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <Text style={styles.fieldLabel}>รูปภาพ</Text>
              <View style={styles.uploadRowContainer}>
                <View style={styles.fileNameBox}><Text style={styles.fileNameText} numberOfLines={1}>{imageFileName}</Text></View>
                <TouchableOpacity style={styles.uploadBlackBtn} onPress={handlePickImage}><Text style={styles.uploadBlackBtnText}>กดอัปโหลด</Text></TouchableOpacity>
              </View>
              {imageUrl ? (<View style={styles.previewImageContainer}><Image source={{ uri: imageUrl }} style={styles.formImagePreview} /></View>) : null}
              <View style={styles.switchRowContainer}>
                <Text style={styles.fieldLabel}>พร้อมจำหน่าย</Text>
                <Switch value={status} onValueChange={setStatus} trackColor={{ false: "#d60f0f", true: "#111111" }} thumbColor={status ? "#1ba740" : "#f4f3f4"} />
              </View>
            </ScrollView>
            <View style={styles.formButtonsRow}>
              <TouchableOpacity style={styles.cancelFormBtn} onPress={() => setModalVisible(false)}><Text style={styles.cancelFormText}>ยกเลิก</Text></TouchableOpacity>
              <TouchableOpacity style={styles.confirmFormBtn} onPress={handleSaveMenu}><Text style={styles.confirmFormText}>{isEditMode ? "บันทึก" : "เพิ่มเมนู"}</Text></TouchableOpacity>
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
  
  // TopBar
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#dcdcdc', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#ccc' },
  adminTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  adminSubtitle: { fontSize: 14, color: '#555', marginTop: 1 },
  
  // Hamburger Button (ปุ่ม 3 ขีด)
  hamburgerBtn: { backgroundColor: '#ffffff', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#bbb' },
  hamburgerIcon: { fontSize: 20, color: '#222', fontWeight: 'bold' },

  // Filter Section Styles
  filterSectionCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 14, marginTop: 14, borderWidth: 1, borderColor: '#e2e2e2', elevation: 2 },
  searchBoxContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f3f5', borderRadius: 12, paddingHorizontal: 12, height: 40, marginBottom: 10 },
  searchIconText: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#222', outlineStyle: 'none' },
  clearSearchText: { fontSize: 14, color: '#888', fontWeight: 'bold', paddingHorizontal: 4 },
  
  filterGroupLabel: { fontSize: 12, fontWeight: 'bold', color: '#666', marginTop: 4, marginBottom: 6 },
  pillScrollView: { flexDirection: 'row', marginBottom: 2 },
  filterPill: { backgroundColor: '#f1f3f5', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#e2e2e2' },
  filterPillActive: { backgroundColor: '#111111', borderColor: '#111111' },
  filterPillText: { fontSize: 12, color: '#555', fontWeight: '600' },
  filterPillTextActive: { color: '#ffffff', fontWeight: 'bold' },

  emptyStateBox: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  emptyStateText: { fontSize: 14, color: '#777', fontWeight: 'bold' },

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
  menuItemArrow: { fontSize: 18, color: '#888', fontWeight: 'bold' },

  // Content & Cards
  addNewMenuBtn: { backgroundColor: '#1ba740', alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, marginTop: 14, marginBottom: 14 },
  addNewMenuText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'flex-start' },
  menuCard: { backgroundColor: '#e2e2e2', width: 220, borderRadius: 15, marginBottom: 12, overflow: 'hidden', elevation: 2, position: 'relative' },
  statusDot: { position: 'absolute', top: 105, right: 12, width: 10, height: 10, borderRadius: 5, zIndex: 6, borderWidth: 1, borderColor: '#fff' },
  menuImage: { width: '100%', height: 100, resizeMode: 'cover' },
  cardContent: { padding: 10 },
  menuName: { fontSize: 15, fontWeight: 'bold', color: '#222' },
  categoryBadge: { backgroundColor: '#fff', borderColor: '#ccc', borderWidth: 1, borderRadius: 12, paddingVertical: 1, paddingHorizontal: 8, alignSelf: 'flex-start', marginVertical: 5 },
  categoryText: { fontSize: 11, color: '#555' },
  priceText: { fontSize: 13, color: '#4b8df8', fontWeight: 'bold' },
  cardActionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingBottom: 10, gap: 6 },
  editInputBox: { flex: 1, backgroundColor: '#fff', borderRadius: 20, paddingVertical: 5, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ccc' },
  editText: { fontSize: 12, color: '#333', fontWeight: 'bold' },
  deleteBtn: { padding: 2 },
  deleteIcon: { fontSize: 16, color: 'red' },

  // Add/Edit Form Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalFormBox: { width: '88%', backgroundColor: '#f0f0f0', borderRadius: 20, padding: 20, maxHeight: '85%' },
  modalFormTitle: { fontSize: 20, fontWeight: 'bold', color: '#111', marginBottom: 12, alignSelf: 'flex-start' },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#222', marginTop: 10, marginBottom: 5 },
  formInput: { backgroundColor: '#e0e0e0', width: '100%', borderRadius: 12, paddingHorizontal: 12, height: 38, fontSize: 14, color: '#111' },
  uploadRowContainer: { flexDirection: 'row', width: '100%', gap: 8, alignItems: 'center' },
  fileNameBox: { flex: 1, backgroundColor: '#e0e0e0', borderRadius: 12, paddingHorizontal: 12, height: 38, justifyContent: 'center' },
  fileNameText: { fontSize: 13, color: '#666' },
  uploadBlackBtn: { backgroundColor: '#111111', borderRadius: 12, height: 38, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  uploadBlackBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  previewImageContainer: { width: '100%', alignItems: 'center', marginTop: 10 },
  formImagePreview: { width: '100%', height: 120, borderRadius: 12, resizeMode: 'cover', borderWidth: 1, borderColor: '#ccc' },
  dropdownSelector: { backgroundColor: '#e0e0e0', width: '100%', borderRadius: 12, paddingHorizontal: 12, height: 38, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownSelectorText: { fontSize: 14, color: '#111' },
  dropdownArrow: { fontSize: 11, color: '#555' },
  dropdownMenuBox: { backgroundColor: '#ffffff', width: '100%', borderRadius: 12, marginTop: 4, paddingVertical: 4, borderWidth: 1, borderColor: '#ddd', elevation: 3 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  dropdownItemActive: { backgroundColor: '#f5f5f5' },
  dropdownItemText: { fontSize: 14, color: '#444' },
  dropdownItemTextActive: { color: '#111', fontWeight: 'bold' },
  switchRowContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: 14, borderTopWidth: 1, borderTopColor: '#ddd', paddingTop: 10 },
  formButtonsRow: { flexDirection: 'row', marginTop: 20, width: '100%', justifyContent: 'flex-end', gap: 10 },
  cancelFormBtn: { backgroundColor: '#ccc', paddingVertical: 8, paddingHorizontal: 18, borderRadius: 8 },
  cancelFormText: { color: '#333', fontSize: 14, fontWeight: 'bold' },
  confirmFormBtn: { backgroundColor: '#111111', paddingVertical: 8, paddingHorizontal: 18, borderRadius: 8 },
  confirmFormText: { color: '#fff', fontSize: 14, fontWeight: 'bold' }
});