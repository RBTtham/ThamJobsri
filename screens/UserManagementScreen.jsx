// File: UserManagementScreen.jsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    TextInput,
    ActivityIndicator,
    Alert,
    ScrollView,
    Modal,
} from 'react-native';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function UserManagementScreen({ navigation }) {
    const [loading, setLoading] = useState(true);

    // ข้อมูลจาก Firebase
    const [staffDocId, setStaffDocId] = useState('');
    const [staffUser, setStaffUser] = useState('');
    const [staffPass, setStaffPass] = useState('');

    const [chefDocId, setChefDocId] = useState('');
    const [chefUser, setChefUser] = useState('');
    const [chefPass, setChefPass] = useState('');

    // 🟢 State สำหรับควบคุม Modal ป๊อปอัพแก้ไข
    const [modalVisible, setModalVisible] = useState(false);
    const [editingRole, setEditingRole] = useState(''); // 'Staff' หรือ 'Chef'
    const [editUsername, setEditUsername] = useState('');
    const [editPassword, setEditPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // ดึงข้อมูลพนักงานและพ่อครัวจาก Firebase
    const fetchUserData = async () => {
        try {
            setLoading(true);

            // ดึงข้อมูล Staff
            const staffSnap = await getDocs(collection(db, 'Staff'));
            if (!staffSnap.empty) {
                const staffDoc = staffSnap.docs[0];
                setStaffDocId(staffDoc.id);
                setStaffUser(staffDoc.data().Username || '');
                setStaffPass(staffDoc.data().Password || '');
            }

            // ดึงข้อมูล Chef
            const chefSnap = await getDocs(collection(db, 'Chef'));
            if (!chefSnap.empty) {
                const chefDoc = chefSnap.docs[0];
                setChefDocId(chefDoc.id);
                setChefUser(chefDoc.data().Username || '');
                setChefPass(chefDoc.data().Password || '');
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลผู้ใช้งานได้');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUserData();
    }, []);

    // 🟢 เปิด Modal เมื่อกดปุ่มแก้ไข
    const handleOpenModal = (role) => {
        setEditingRole(role);
        if (role === 'Staff') {
            setEditUsername(staffUser);
            setEditPassword(staffPass);
        } else {
            setEditUsername(chefUser);
            setEditPassword(chefPass);
        }
        setModalVisible(true);
    };

    // 🟢 บันทึกข้อมูลที่แก้ไขลง Firebase
    const handleSaveEdit = async () => {
        if (!editUsername.trim() || !editPassword.trim()) {
            Alert.alert('เตือน', 'กรุณากรอกข้อมูลให้ครบถ้วน');
            return;
        }

        try {
            setIsSaving(true);
            const targetCollection = editingRole;
            const targetDocId = editingRole === 'Staff' ? staffDocId : chefDocId;

            if (targetDocId) {
                const userRef = doc(db, targetCollection, targetDocId);
                await updateDoc(userRef, {
                    Username: editUsername.trim(),
                    Password: editPassword.trim(),
                });

                // 🟢 เพิ่มบรรทัดนี้: อัปเดต State ในหน้าหลักทันที
                if (editingRole === 'Staff') {
                    setStaffUser(editUsername.trim());
                    setStaffPass(editPassword.trim());
                } else {
                    setChefUser(editUsername.trim());
                    setChefPass(editPassword.trim());
                }

                Alert.alert('สำเร็จ', `อัปเดตรหัสผู้ใช้ ${editingRole === 'Staff' ? 'พนักงาน' : 'พ่อครัว'} เรียบร้อยแล้ว`);
                setModalVisible(false);
            }
        } catch (error) {
            console.error('Error updating user:', error);
            Alert.alert('ข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1ba740" />
                <Text style={styles.loadingText}>กำลังโหลดข้อมูลรหัสผู้ใช้งาน...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Top Bar ด้านบน */}
            <View style={styles.topBar}>
                <View style={styles.headerLeftRow}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Text style={styles.backIcon}>🏠</Text>
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>จัดการรหัสผู้ใช้งาน</Text>
                        <Text style={styles.headerSubtitle}>ผู้ดูแลระบบ</Text>
                    </View>
                </View>

                
            </View>

            <ScrollView contentContainerStyle={styles.container}>
                {/* ================= Section พนักงาน ================= */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>พนักงาน</Text>

                    <View style={styles.rowWrapper}>
                        <View style={styles.inputsColumn}>
                            <View style={styles.inputRow}>
                                <Text style={styles.label}>User:</Text>
                                <View style={styles.readOnlyInput}>
                                    <Text style={styles.readOnlyText}>{staffUser}</Text>
                                </View>
                            </View>

                            <View style={styles.inputRow}>
                                <Text style={styles.label}>Password:</Text>
                                <View style={styles.readOnlyInput}>
                                    {/* 🟢 แก้ไขตรงนี้: สร้างจุดตามจำนวนตัวอักษรของรหัสผ่านพนักงาน */}
                                    <Text style={styles.readOnlyText}>
                                        {staffPass ? '•'.repeat(staffPass.length) : ''}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <TouchableOpacity style={styles.editBtn} onPress={() => handleOpenModal('Staff')}>
                            <Text style={styles.editBtnText}>แก้ไข</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ================= Section พ่อครัว ================= */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>พ่อครัว</Text>

                    <View style={styles.rowWrapper}>
                        <View style={styles.inputsColumn}>
                            <View style={styles.inputRow}>
                                <Text style={styles.label}>User:</Text>
                                <View style={styles.readOnlyInput}>
                                    <Text style={styles.readOnlyText}>{chefUser}</Text>
                                </View>
                            </View>

                            <View style={styles.inputRow}>
                                <Text style={styles.label}>Password:</Text>
                                <View style={styles.readOnlyInput}>
                                    {/* 🟢 แก้ไขตรงนี้: สร้างจุดตามจำนวนตัวอักษรของรหัสผ่านพ่อครัว */}
                                    <Text style={styles.readOnlyText}>
                                        {chefPass ? '•'.repeat(chefPass.length) : ''}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <TouchableOpacity style={styles.editBtn} onPress={() => handleOpenModal('Chef')}>
                            <Text style={styles.editBtnText}>แก้ไข</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            {/* ================= 🟢 MODAL หน้าต่างป๊อปอัพแก้ไขตามรูปภาพ ================= */}
            <Modal visible={modalVisible} transparent={true} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>แก้ไขรหัสผู้ใช้</Text>

                        <Text style={styles.modalLabel}>User</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={editUsername}
                            onChangeText={setEditUsername}
                            autoCapitalize="none"
                        />

                        <Text style={styles.modalLabel}>Password</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={editPassword}
                            onChangeText={setEditPassword}
                            autoCapitalize="none"
                        />

                        {/* ปุ่มด้านล่าง Modal */}
                        <View style={styles.modalButtonRow}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => setModalVisible(false)}
                                disabled={isSaving}
                            >
                                <Text style={styles.cancelBtnText}>ยกเลิก</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.saveModalBtn}
                                onPress={handleSaveEdit}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <ActivityIndicator color="#ffffff" size="small" />
                                ) : (
                                    <Text style={styles.saveModalBtnText}>แก้ไข</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 15,
        color: '#333',
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#dcdcdc',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderColor: '#ccc',
    },
    headerLeftRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    backBtn: {
        padding: 4,
    },
    backIcon: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#111',
    },
    headerTitleContainer: {
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111',
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#555',
    },
    logoutBtn: {
        backgroundColor: '#ffffff',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#ccc',
    },
    logoutBtnText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#333',
    },
    container: {
        padding: 24,
        maxWidth: 750,
        alignSelf: 'flex-start',
        width: '100%',
    },
    sectionContainer: {
        marginBottom: 36,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#222',
        marginBottom: 14,
    },
    rowWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
    },
    inputsColumn: {
        flex: 1,
        gap: 10,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    label: {
        width: 80,
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
    },
    readOnlyInput: {
        flex: 1,
        backgroundColor: '#e6e6e6',
        borderRadius: 12,
        height: 40,
        paddingHorizontal: 14,
        justifyContent: 'center',
    },
    readOnlyText: {
        fontSize: 14,
        color: '#333',
    },
    editBtn: {
        backgroundColor: '#fff066', // สีเหลือง
        paddingVertical: 8,
        paddingHorizontal: 22,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    editBtnText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#333333',
    },

    /* 🟢 STYLES สำหรับ MODAL หน้าต่างป๊อปอัพ */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)', // ฉากหลังสีดำโปร่งใส
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalCard: {
        width: 380,
        maxWidth: '90%',
        backgroundColor: '#f4f4f4',
        borderRadius: 20,
        padding: 24,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111',
        textAlign: 'center',
        marginBottom: 20,
    },
    modalLabel: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
        marginBottom: 6,
    },
    modalInput: {
        backgroundColor: '#e0e0e0',
        borderRadius: 10,
        height: 42,
        paddingHorizontal: 14,
        fontSize: 15,
        color: '#111',
        marginBottom: 18,
    },
    modalButtonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
    },
    cancelBtn: {
        backgroundColor: '#dcdcdc',
        paddingVertical: 10,
        paddingHorizontal: 22,
        borderRadius: 10,
    },
    cancelBtnText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#333',
    },
    saveModalBtn: {
        backgroundColor: '#000000', // ปุ่มสีดำ
        paddingVertical: 10,
        paddingHorizontal: 28,
        borderRadius: 10,
    },
    saveModalBtnText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#ffffff',
    },
});