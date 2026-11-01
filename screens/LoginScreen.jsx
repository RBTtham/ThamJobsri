// File: screens/LoginScreen.jsx
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
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function LoginScreen({ route, navigation }) {
  const rawRole = route.params?.role || 'chef';
  const isChef = String(rawRole).toLowerCase() === 'chef';

  const title = isChef ? 'พ่อครัว' : 'พนักงาน';
  const subtitle = isChef
    ? 'เข้าสู่ระบบจัดการออเดอร์อาหาร'
    : 'เข้าสู่ระบบจัดการโต๊ะและออเดอร์';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }

    setLoading(true);

    try {
      const targetCollection = isChef ? 'Chef' : 'Staff';
      const querySnapshot = await getDocs(collection(db, targetCollection));

      const matchedUser = querySnapshot.docs.find((doc) => {
        const data = doc.data();
        const dbUsername = String(data.Username || '').trim();
        const dbPassword = String(data.Password || '').trim();

        return (
          dbUsername.toLowerCase() === trimmedUsername.toLowerCase() &&
          dbPassword === trimmedPassword
        );
      });

      if (matchedUser) {
        const userRole = isChef ? 'chef' : 'staff';
        const targetScreen = isChef ? 'Chef' : 'EmployeeTable';

        // 🟢 บันทึกสถานะการเข้าสู่ระบบลง localStorage ป้องกันหน้าปลายทางดีดกลับ
        if (Platform.OS === 'web') {
          localStorage.setItem('userRole', userRole);
          localStorage.setItem('isLoggedIn', 'true');
        }

        // เปลี่ยนไปยังหน้าปลายทางแบบย้อนกลับไม่ได้
        navigation.replace(targetScreen);
      } else {
        Alert.alert('เข้าสู่ระบบไม่สำเร็จ', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }
    } catch (error) {
      console.error('Login Error: ', error);
      Alert.alert('ข้อผิดพลาด', `เกิดข้อผิดพลาด: ${error.message}`);
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
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSubtitle}>{subtitle}</Text>

          <View style={styles.formContainer}>
            <Text style={styles.label}>ชื่อผู้ใช้</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
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

            <View style={styles.buttonWrapper}>
              <TouchableOpacity
                style={[styles.loginButton, loading && styles.disabledBtn]}
                onPress={handleLogin}
                activeOpacity={0.8}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.loginButtonText}>เข้าสู่ระบบ</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
    marginTop: -40,
  },
  headerTitle: {
    fontSize: 25,
    fontWeight: 'bold',
    color: '#2a2a2a',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#4a4a4a',
    marginBottom: 40,
    textAlign: 'center',
  },
  formContainer: { width: '100%', maxWidth: 800 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#dcdcdc',
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#333333',
  },
  buttonWrapper: { alignItems: 'center', marginTop: 36 },
  loginButton: {
    backgroundColor: '#618bf8',
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    minWidth: 120,
  },
  disabledBtn: { opacity: 0.7 },
  loginButtonText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
});