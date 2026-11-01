// File: App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CartProvider } from './services/CartContext'; 

import RoleSelectionScreen from './screens/RoleSelectionScreen';
import MenuScreen from './screens/MenuScreen'; 
import CartScreen from './screens/CartScreen';
import AdminScreen from './screens/AdminScreen';
import ReportScreen from './screens/ReportScreen'; 
import EmployeeTableScreen from './screens/EmployeeTableScreen'; 
import PaymentScreen from './screens/PaymentScreen'; 
import ChefScreen from './screens/ChefScreen';
import OrderHistoryScreen from './screens/OrderHistoryScreen';
import ServeListScreen from './screens/ServeListScreen';
import ReportDetailScreen from './screens/ReportDetailScreen';
import LoginScreen from './screens/LoginScreen';
import UserManagementScreen from './screens/UserManagementScreen';
import AdminLoginScreen from './screens/AdminLoginScreen';

const Stack = createNativeStackNavigator();

const linking = {
  prefixes: ['https://login-a7fa2.web.app', 'http://localhost:8081'],
  config: {
    screens: {
      RoleSelection: '',
      Login: 'login/:role?',
      AdminLogin: 'admin-login',
      Menu: 'table/:tableNumber',
      Cart: 'cart',
      OrderHistory: 'order-history',
      Chef: 'chef',
      EmployeeTable: 'employee-table',
      ServeList: 'serve-list',
      Payment: 'payment',
      Admin: 'admin',
      Report: 'report',
      ReportDetail: 'report-detail',
      UserManagement: 'user-management',
    },
  },
};

export default function App() {
  return (
    <CartProvider>
      <NavigationContainer linking={linking}>
        <Stack.Navigator initialRouteName="RoleSelection">
          <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Menu" component={MenuScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Cart" component={CartScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Admin" component={AdminScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Report" component={ReportScreen} options={{ headerShown: false }} />
          <Stack.Screen name="EmployeeTable" component={EmployeeTableScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Payment" component={PaymentScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Chef" component={ChefScreen} options={{ headerShown: false }} />
          <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ServeList" component={ServeListScreen} options={{ headerShown: false }} />  
          <Stack.Screen name="ReportDetail" component={ReportDetailScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="UserManagement" component={UserManagementScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AdminLogin" component={AdminLoginScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    </CartProvider>
  );
}