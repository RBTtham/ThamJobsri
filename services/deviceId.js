// File: services/deviceId.js
export const getOrCreateDeviceId = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    let deviceId = localStorage.getItem('user_device_id');
    if (!deviceId) {
      deviceId = 'DEV-' + Math.random().toString(36).substring(2, 8).toUpperCase() + Date.now().toString(36).toUpperCase();
      localStorage.setItem('user_device_id', deviceId);
    }
    return deviceId;
  }
  return 'DEV-UNKNOWN';
};