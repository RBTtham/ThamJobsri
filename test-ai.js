// File: test-ai.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- ❗️❗️ ใส่ API KEY ของคุณตรงนี้ ❗️❗️ ---
const API_KEY = "AIzaSyCYPGGQDRbfkLhWf6_m3lps5H-DtEs4QE4"; 

// --- ใช้ชื่อโมเดลนี้ ---
const MODEL_NAME = "gemini-pro";

async function runTest() {
  console.log("กำลังเริ่มต้นทดสอบการเชื่อมต่อ AI...");
  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    console.log("กำลังส่งคำถามไปที่ AI...");
    const prompt = "สวัสดี, ช่วยแนะนำตัวเองหน่อย";
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    console.log("\n✅✅✅ AI ทำงานสำเร็จ! ✅✅✅");
    console.log("-----------------------------------------");
    console.log("AI ตอบกลับมาว่า:", text);
    console.log("-----------------------------------------");

  } catch (error) {
    console.error("\n❌❌❌ เกิดข้อผิดพลาด! ❌❌❌");
    console.error(error);
  }
}

runTest();