const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Pangkalan Data Senarai Berita
let newsDatabase = [
    {
        id: "nfp",
        title: "Non-Farm Payrolls (NFP)",
        eventDateTime: "4 SEP | 20:30 (GMT+8)",
        impact: "HIGH IMPACT",
        usdBias: "Bullish USD",
        goldSignal: "SELL GOLD",
        updatedTime: "4 Sep 2026",
        recapBm: "Data NFP mencatatkan pertumbuhan penggajian yang kukuh melebihi jangkaan. Ini menguatkan sentimen mata wang USD dan memberi tekanan susutan harga yang ketara ke atas XAU/USD (Gold)."
    },
    {
        id: "ppi",
        title: "Producer Price Index (PPI)",
        eventDateTime: "10 SEP | 20:30 (GMT+8)",
        impact: "HIGH IMPACT",
        usdBias: "Bullish USD",
        goldSignal: "SELL GOLD",
        updatedTime: "Belum Berlangsung",
        recapBm: "Analisis awal menunjukkan indeks harga pengeluar kekal stabil. Menunggu pelepasan data sebenar."
    },
    {
        id: "cpi",
        title: "Consumer Price Index (CPI)",
        eventDateTime: "11 SEP | 20:30 (GMT+8)",
        impact: "HIGH IMPACT",
        usdBias: "Bearish USD",
        goldSignal: "BUY GOLD",
        updatedTime: "Belum Berlangsung",
        recapBm: "Jangkaan inflasi menurun boleh memberi tekanan kepada USD dan memberi ruang lonjakan kepada Gold."
    },
    {
        id: "fomc",
        title: "FOMC Rate Decision",
        eventDateTime: "17 SEP | 02:00 (GMT+8)",
        impact: "HIGH IMPACT",
        usdBias: "Bearish USD",
        goldSignal: "BUY GOLD",
        updatedTime: "Belum Berlangsung",
        recapBm: "Keputusan kadar faedah Fed bakal menjadi penentu arah aliran utama pasaran emas bagi suku ke-3."
    }
];

// Berita aktif semasa yang dipaparkan di Kad Utama
let activeNewsId = "nfp";

// Endpoint mendapatkan semua senarai berita + berita aktif
app.get('/api/live-news', (req, res) => {
    const activeEvent = newsDatabase.find(item => item.id === activeNewsId) || newsDatabase[0];
    res.json({
        activeEvent: activeEvent,
        allEvents: newsDatabase
    });
});

// Endpoint untuk tukar berita aktif bila user tekan butang di frontend
app.post('/api/select-news', (req, res) => {
    const { id } = req.body;
    const found = newsDatabase.find(item => item.id === id);
    if (found) {
        activeNewsId = id;
        return res.json({ status: "success", activeEvent: found });
    }
    res.status(404).json({ status: "error", message: "Berita tidak ditemui" });
});

// Endpoint untuk hantar data berita baru / trigger AI analysis
app.post('/api/trigger-analysis', async (req, res) => {
    const { id, newsTitle, eventDateTime, impact, actual, forecast, previous, fedRemarks } = req.body;

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
    3. Tulis ulasan Bahasa Melayu santai, padat, dan senang faham merangkumi key points berita & kenyataan Fed jika ada.

    Formatkan jawapan dalam bentuk JSON SAHAJA tanpa markdown:
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
            const targetId = id || newsTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
            
            const updatedItem = {
                id: targetId,
                title: newsTitle,
                eventDateTime: eventDateTime || "MASA TIDAK DISET",
                impact: impact || "HIGH IMPACT",
                updatedTime: new Date().toLocaleTimeString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur' }),
                usdBias: parsed.usdBias,
                goldSignal: parsed.goldSignal,
                recapBm: parsed.recapBm
            };

            // Kemaskini dalam database jika wujud, atau tambah jika berita baru
            const existingIndex = newsDatabase.findIndex(item => item.id === targetId);
            if (existingIndex !== -1) {
                newsDatabase[existingIndex] = updatedItem;
            } else {
                newsDatabase.unshift(updatedItem);
            }

            activeNewsId = targetId;
            return res.json({ status: "success", data: updatedItem });
        }
        res.status(500).json({ status: "error", message: "Gagal memproses AI" });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server aktif pada port ${PORT}`);
});
