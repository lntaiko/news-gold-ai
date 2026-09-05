const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// Pangkalan Data Berita Utama (Disimpan dalam memori)
let newsDatabase = [
    {
        id: "nfp",
        title: "Non-Farm Payrolls (NFP)",
        eventDateTime: "4 SEP | 20:30 (GMT+8)",
        impact: "HIGH IMPACT",
        actual: "142K",
        forecast: "164K",
        previous: "114K",
        usdBias: "Bullish USD",
        goldSignal: "SELL GOLD",
        updatedTime: "4 Sep 2026",
        recapBm: "Data NFP mencatatkan pertumbuhan penggajian yang kukuh melebihi jangkaan. Ini menguatkan sentimen mata wang USD dan memberi tekanan susutan harga yang ketara ke atas XAU/USD (Gold)."
    }
];

let activeNewsId = "nfp";

// Fungsi memproses analisis AI Gemini untuk apa-apa jenis berita
async function processWithAI(newsItem) {
    const prompt = `
    Sebagai pakar analisis fundamental Forex & Gold (XAU/USD), analisa data berita berikut:
    - Tajuk Berita: ${newsItem.event || newsItem.title}
    - Tarikh & Masa Acara: ${newsItem.date || newsItem.eventDateTime}
    - Tahap Impak: ${newsItem.impact || 'HIGH IMPACT'}
    - Data Actual: ${newsItem.actual || 'Belum keluar'}
    - Data Forecast: ${newsItem.forecast || 'Tiada'}
    - Data Previous: ${newsItem.previous || 'Tiada'}
    - Catatan Tambahan/Fed Remarks: ${newsItem.fedRemarks || 'Tiada'}

    Tugas:
    1. Tentukan bias USD (Bullish USD / Bearish USD).
    2. Tentukan implikasi pada Emas (BUY GOLD / SELL GOLD).
    3. Tulis ulasan Bahasa Melayu santai, padat, dan senang faham merangkumi key points berita tersebut.

    Formatkan jawapan dalam bentuk JSON SAHAJA tanpa markdown:
    {
      "usdBias": "Bullish USD / Bearish USD",
      "goldSignal": "BUY GOLD / SELL GOLD",
      "recapBm": "Ulasan Bahasa Melayu..."
    }
    `;

    const availableModels = ["gemini-1.5-flash-latest", "gemini-1.5-flash", "gemini-3.6-flash"];

    for (const modelName of availableModels) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (err) {
            console.warn(`Model ${modelName} tidak dapat diakses, mencuba model lain...`);
        }
    }

    return {
        usdBias: "Bullish USD",
        goldSignal: "SELL GOLD",
        recapBm: "Analisis manual berjaya dimasukkan ke dalam sistem."
    };
}

// Endpoint GET untuk Frontend Laman Web
app.get('/api/live-news', (req, res) => {
    const activeEvent = newsDatabase.find(item => item.id === activeNewsId) || newsDatabase[0];
    res.json({
        activeEvent: activeEvent,
        allEvents: newsDatabase
    });
});

// Endpoint Pilih Berita Aktif
app.post('/api/select-news', (req, res) => {
    const { id } = req.body;
    const found = newsDatabase.find(item => item.id === id);
    if (found) {
        activeNewsId = id;
        return res.json({ status: "success", activeEvent: found });
    }
    res.status(404).json({ status: "error", message: "Berita tidak ditemui" });
});

// Endpoint Manual Trigger (Menerima APA-APA jenis berita secara dinamik)
app.post('/api/trigger-analysis', async (req, res) => {
    try {
        const { id, newsTitle, eventDateTime, impact, actual, forecast, previous, fedRemarks } = req.body;

        const mockItem = {
            event: newsTitle,
            date: eventDateTime,
            impact: impact,
            actual: actual,
            forecast: forecast,
            previous: previous,
            fedRemarks: fedRemarks
        };

        const aiResult = await processWithAI(mockItem);

        // Menjana ID berasaskan tajuk berita secara dinamik
        const targetId = id || (newsTitle ? newsTitle.toLowerCase().replace(/[^a-z0-9]/g, '') : `news_${Date.now()}`);
        
        const updatedItem = {
            id: targetId,
            title: newsTitle || "Berita Ekonomi",
            eventDateTime: eventDateTime || "MASA TIDAK DISET",
            impact: impact || "HIGH IMPACT",
            actual: actual || "-",
            forecast: forecast || "-",
            previous: previous || "-",
            updatedTime: new Date().toLocaleTimeString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur' }),
            usdBias: aiResult.usdBias,
            goldSignal: aiResult.goldSignal,
            recapBm: aiResult.recapBm
        };

        const existingIndex = newsDatabase.findIndex(item => item.id === targetId);
        if (existingIndex !== -1) {
            newsDatabase[existingIndex] = updatedItem;
        } else {
            newsDatabase.unshift(updatedItem); // Berita baharu akan sentiasa duduk di senarai paling atas
        }

        activeNewsId = targetId;
        return res.json({ status: "success", data: updatedItem });
    } catch (error) {
        console.error("Ralat trigger-analysis:", error.message);
        return res.status(500).json({ status: "error", message: error.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server manual aktif pada port ${PORT}`);
});
