const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

let latestData = {
    title: "Unemployment Claims",
    eventDateTime: "10 SEP | 20:30 (GMT+8)",
    impact: "MEDIUM IMPACT",
    updatedTime: "Memuatkan...",
    usdBias: "Bullish USD",
    goldSignal: "SELL GOLD",
    recapBm: "Menunggu masukan data berita..."
};

app.get('/api/live-news', (req, res) => {
    res.json(latestData);
});

app.post('/api/trigger-analysis', async (req, res) => {
    const { newsTitle, eventDateTime, impact, actual, forecast, previous, fedRemarks } = req.body;

    const prompt = `
    Sebagai pakar analisis fundamental Forex & Gold (XAU/USD), analisa data berita berikut:
    - Tajuk Berita: ${newsTitle}
    - Tarikh & Masa Acara: ${eventDateTime || 'Tiada'}
    - Tahap Impak: ${impact || 'HIGH/MEDIUM IMPACT'}
    - Data Actual: ${actual}
    - Data Forecast: ${forecast}
    - Data Previous: ${previous}
    - Kenyataan Tambahan / Fed Remarks: ${fedRemarks || 'Tiada'}

    Tugas:
    1. Tentukan bias USD (Bullish USD / Bearish USD).
    2. Tentukan implikasi pada Gold (BUY GOLD / SELL GOLD).
    3. Tulis ulasan Bahasa Melayu santai, padat, dan senang faham.
       - TERMASUKKAN key point utama daripada data berita.
       - JIKA ADA kenyataan Fed (contoh: cadangan naikkan/turunkan kadar faedah), WAJIB muatkan kenyataan tersebut di dalam ulasan dan terangkan dampaknya kepada Gold.

    Formatkan jawapan dalam bentuk JSON SAHAJA tanpa sebarang teks markdown/penerangan lain:
    {
      "usdBias": "Bullish USD / Bearish USD",
      "goldSignal": "BUY GOLD / SELL GOLD",
      "recapBm": "Ulasan Bahasa Melayu di sini..."
    }
    `;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            latestData = {
                title: newsTitle,
                eventDateTime: eventDateTime || "MASA TIDAK DISET",
                impact: impact || "MEDIUM IMPACT",
                updatedTime: new Date().toLocaleTimeString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur' }),
                usdBias: parsed.usdBias,
                goldSignal: parsed.goldSignal,
                recapBm: parsed.recapBm
            };
            return res.json({ status: "success", data: latestData });
        }
        res.status(500).json({ status: "error", message: "Gagal memproses JSON AI" });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server aktif pada port ${PORT}`);
});
