const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Mengambil API Key dari Render Environment Variable
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Memori Simpanan Data Sementara
let latestData = {
    title: "Non-Farm Payrolls (NFP)",
    time: "Memuatkan data terkini...",
    usdBias: "Bullish USD",
    goldSignal: "SELL GOLD",
    recapBm: "Sistem automasi sedia. Analisis AI akan dipaparkan secara automatik sebaik sahaja data berita dikemas kini."
};

// Endpoint untuk Frontend tarik data secara Live
app.get('/api/live-news', (req, res) => {
    res.json(latestData);
});

// Endpoint untuk mengemaskini analisis AI secara automatik
app.post('/api/trigger-analysis', async (req, res) => {
    const { newsTitle, actual, forecast, previous } = req.body;

    const prompt = `
    Sebagai pakar analisis fundamental Forex dan Gold (XAU/USD), analisa data berita ini:
    - Tajuk Berita: ${newsTitle}
    - Actual: ${actual}
    - Forecast: ${forecast}
    - Previous: ${previous}

    Tugas:
    1. Tentukan bias USD (Bullish USD / Bearish USD).
    2. Tentukan implikasi XAU/USD (BUY GOLD / SELL GOLD).
    3. Tulis ulasan ringkas dan padat dalam Bahasa Melayu santai tentang KENAPA momentum ini berlaku kepada Gold.

    Formatkan jawapan dalam bentuk JSON SAHAJA tanpa teks tambahan:
    {
      "usdBias": "Bullish USD / Bearish USD",
      "goldSignal": "BUY GOLD / SELL GOLD",
      "recapBm": "Ulasan Bahasa Melayu..."
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
                time: new Date().toLocaleTimeString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur' }),
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
