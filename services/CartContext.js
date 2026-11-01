// File: G:\ProjectJin\services\CartContext.js
import React, { createContext, useState, useContext } from 'react';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);

  // 🟢 ปรับปรุง: แยกรายการอาหารตาม id และ note
  const addToCart = (item, quantity, note = '') => {
    const trimmedNote = note ? note.trim() : '';
    // สร้าง uniqueKey เพื่อแยกรายการแม้จะเป็นอาหารเดียวกันแต่โน้ตต่างกัน
    const uniqueKey = `${item.id}_${trimmedNote}`;

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex(i => i.uniqueKey === uniqueKey);

      if (existingIndex > -1) {
        // หากเมนูเดิม และ โน้ตเหมือนกันเป๊ะ ให้เพิ่มจำนวน
        const newCart = [...prevCart];
        newCart[existingIndex].quantity += quantity;
        return newCart;
      } else {
        // หากโน้ตต่างกัน ให้แยกเป็นบรรทัดใหม่ทันที
        return [...prevCart, { ...item, uniqueKey, quantity, note: trimmedNote }];
      }
    });
  };

  const updateQuantity = (uniqueKey, amount) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.uniqueKey === uniqueKey) {
          const newQty = item.quantity + amount;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      })
    );
  };

  const removeItem = (uniqueKey) => {
    setCart((prevCart) => prevCart.filter((item) => item.uniqueKey !== uniqueKey));
  };

  const clearCart = () => {
    setCart([]);
  };

  return (
    <CartContext.Provider value={{ cart, addToCart, updateQuantity, removeItem, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);