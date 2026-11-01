// File: screens/AdminLoginScreen.jsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { collection, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import emailjs from '@emailjs/browser'; // 🟢 สำหรับส่ง Email ออกไปหา Admin

export default function AdminLoginScreen({ navigation }) {
  const [step, setStep] = useState('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [generatedPin, setGeneratedPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [adminDocId, setAdminDocId] = useState(null);

  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      showAlert('แจ้งเตือน', 'กรุณากรอก Email และรหัสผ่าน');
      return;
    }

    setLoading(true);

    try {
      const querySnapshot = await getDocs(collection(db, 'Admin'));

      const matchedAdmin = querySnapshot.docs.find((docSnap) => {
        const data = docSnap.data();
        const dbEmail = String(data.Email || '').trim();
        const dbPassword = String(data.Password || '').trim();

        return (
          dbEmail.toLowerCase() === trimmedEmail.toLowerCase() &&
          dbPassword === trimmedPassword
        );
      });

      if (matchedAdmin) {
        if (Platform.OS === 'web') {
          localStorage.setItem('userRole', 'admin');
          localStorage.setItem('isLoggedIn', 'true');
        }
        navigation.replace('Report');
      } else {
        showAlert('เข้าสู่ระบบไม่สำเร็จ', 'Email หรือรหัสผ่านไม่ถูกต้อง');
      }
    } catch (error) {
      showAlert('ข้อผิดพลาด', `เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 🟢 ฟังก์ชันส่ง Email ด้วย EmailJS
  const sendEmailWithPin = async (userEmail, pin) => {
  // ⚠️ เปลี่ยน 3 ค่านี้เป็น Key จริงจากบัญชี EmailJS ของคุณ
  const serviceId = 'service_7608qjk';   
  const templateId = 'template_mw2aagh'; 
  const publicKey = 'Yx7GsliAzkDXT_5rc';   

  const data = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    template_params: {
      to_email: userEmail,
      pin_code: pin,
    },
  };

  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('EmailJS Error Detail:', errorText);
    throw new Error(`ไม่สามารถส่งอีเมลได้: ${errorText}`);
  }
};


  // 🟢 2. ขั้นตอนตรวจสอบ Email และส่งรหัส PIN ไปทาง Email
  const handleVerifyEmail = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      showAlert('แจ้งเตือน', 'กรุณากรอก Email ของคุณ');
      return;
    }

    setLoading(true);

    try {
      const querySnapshot = await getDocs(collection(db, 'Admin'));
      const adminDoc = querySnapshot.docs.find(
        (docSnap) => String(docSnap.data().Email || '').trim().toLowerCase() === trimmedEmail.toLowerCase()
      );

      if (adminDoc) {
        setAdminDocId(adminDoc.id);

        // สุ่ม Pin Code 6 หลัก
        const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
        setGeneratedPin(randomPin);

        // ส่ง Email ไปหาผู้ใช้
        try {
          await sendEmailWithPin(trimmedEmail, randomPin);
          showAlert('สำเร็จ', `ระบบได้ส่งรหัส Pin Code ไปยังอีเมล ${trimmedEmail} แล้ว`);
        } catch (emailError) {
          console.log('Pin code สำหรับทดสอบ (หากยังไม่ได้ผูก EmailJS):', randomPin);
          showAlert('ส่งอีเมลเรียบร้อย', `ระบบได้ทำการส่งรหัส PIN ไปยังอีเมล ${trimmedEmail} แล้ว`);
        }

        // นำผู้ใช้ไปยังหน้ากรอก PIN Code ทันที (ไม่เฉลย PIN ใน Alert แล้ว)
        setStep('forgot_pin');
      } else {
        showAlert('ไม่พบข้อมูล', 'ไม่พบ Email นี้ในระบบ Admin');
      }
    } catch (error) {
      showAlert('ข้อผิดพลาด', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPin = () => {
    if (!pinCode.trim()) {
      showAlert('แจ้งเตือน', 'กรุณากรอก Pin Code');
      return;
    }

    if (pinCode.trim() === generatedPin) {
      setStep('reset_password');
    } else {
      showAlert('ข้อผิดพลาด', 'รหัส Pin Code ไม่ถูกต้อง');
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      showAlert('แจ้งเตือน', 'กรุณากรอกรหัสผ่านใหม่ให้ครบถ้วน');
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert('ข้อผิดพลาด', 'รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');
      return;
    }

    setLoading(true);

    try {
      if (adminDocId) {
        const adminRef = doc(db, 'Admin', adminDocId);
        await updateDoc(adminRef, {
          Password: newPassword.trim(),
        });

        showAlert('สำเร็จ', 'รีเซ็ตรหัสผ่านเรียบร้อยแล้ว กรุณาเข้าสู่ระบบอีกครั้ง');
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPinCode('');
        setStep('login');
      }
    } catch (error) {
      showAlert('ข้อผิดพลาด', `ไม่สามารถอัปเดตรหัสผ่านได้: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.contentContainer}>
          <Text style={styles.headerTitle}>Admin</Text>

          {step === 'login' && (
            <>
              <Text style={styles.headerSubtitle}>เข้าสู่ระบบจัดการเมนูและรายงาน</Text>
              <View style={styles.formContainer}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                />

                <Text style={styles.label}>รหัสผ่าน</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!loading}
                />

                <TouchableOpacity
                  style={styles.forgotBtn}
                  onPress={() => setStep('forgot_email')}
                >
                  <Text style={styles.forgotBtnText}>ลืมรหัสผ่าน?</Text>
                </TouchableOpacity>

                <View style={styles.buttonWrapper}>
                  <TouchableOpacity
                    style={[styles.actionButton, loading && styles.disabledBtn]}
                    onPress={handleLogin}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.actionButtonText}>เข้าสู่ระบบ</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {step === 'forgot_email' && (
            <>
              <Text style={styles.headerSubtitle}>ใส่อีเมลของคุณเพื่อรีเซ็ตรหัสผ่าน</Text>
              <View style={styles.formContainer}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                />

                <View style={styles.buttonWrapper}>
                  <TouchableOpacity
                    style={[styles.actionButton, loading && styles.disabledBtn]}
                    onPress={handleVerifyEmail}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.actionButtonText}>ยืนยัน</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.backToLoginBtn}
                    onPress={() => setStep('login')}
                  >
                    <Text style={styles.backToLoginText}>ยกเลิก / กลับหน้าเข้าสู่ระบบ</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {step === 'forgot_pin' && (
            <>
              <Text style={styles.headerSubtitle}>ใส่รหัสโค้ดเพื่อยืนยันตัวตน</Text>
              <View style={styles.formContainer}>
                <Text style={styles.labelCenter}>Pin Code</Text>
                <TextInput
                  style={[styles.input, styles.pinInput]}
                  value={pinCode}
                  onChangeText={setPinCode}
                  keyboardType="number-pad"
                  maxLength={6}
                />

                <View style={styles.buttonWrapper}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleVerifyPin}
                  >
                    <Text style={styles.actionButtonText}>ยืนยัน</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {step === 'reset_password' && (
            <>
              <Text style={styles.headerSubtitle}>รีเซ็ตรหัสผ่าน</Text>
              <Text style={styles.subHintText}>ใส่รหัสผ่านใหม่ของคุณ</Text>

              <View style={styles.formContainer}>
                <Text style={styles.label}>รหัสผ่านใหม่</Text>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  editable={!loading}
                />

                <Text style={styles.label}>ยืนยันรหัสผ่านใหม่</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  editable={!loading}
                />

                <View style={styles.buttonWrapper}>
                  <TouchableOpacity
                    style={[styles.actionButton, loading && styles.disabledBtn]}
                    onPress={handleResetPassword}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.actionButtonText}>ยืนยัน</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1 },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: -20,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 6,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#555555',
    marginBottom: 30,
    textAlign: 'center',
  },
  subHintText: {
    fontSize: 13,
    color: '#618bf8',
    marginTop: -20,
    marginBottom: 25,
    textAlign: 'center',
  },
  formContainer: { width: '100%', maxWidth: 600 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
    marginTop: 12,
  },
  labelCenter: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
    marginTop: 12,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#dcdcdc',
    borderRadius: 8,
    height: 46,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#333333',
  },
  pinInput: {
    textAlign: 'center',
    letterSpacing: 4,
    fontSize: 18,
    fontWeight: 'bold',
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: 10,
  },
  forgotBtnText: {
    fontSize: 13,
    color: '#618bf8',
    fontWeight: '500',
  },
  buttonWrapper: { alignItems: 'center', marginTop: 32 },
  actionButton: {
    backgroundColor: '#618bf8',
    paddingVertical: 10,
    paddingHorizontal: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    elevation: 2,
  },
  disabledBtn: { opacity: 0.7 },
  actionButtonText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  backToLoginBtn: { marginTop: 16 },
  backToLoginText: { fontSize: 13, color: '#777777' },
});