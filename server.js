const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const apiKey = process.env.GEMINI_API_KEY;
const FMP_API_KEY = process.env.FMP_API_KEY; // Masukkan API Key Kalendar Ekonomi di Render
const genAI = new GoogleGenerativeAI(apiKey);

// Pangkalan Data Berita Utama (Disimpan dalam memori)
let newsDatabase = [];
let activeNewsId = "";

// Fungsi memproses ulasan AI menggunakan Gemini
async function processWithAI(newsItem) {
    const prompt = `
    Sebagai pakar analisis fundamental Forex & Gold (XAU/USD), analisa data berita berikut:
    - Tajuk Berita: ${newsItem.event}
    - Tarikh & Masa Acara: ${newsItem.date}
    - Data Actual: ${newsItem.actual !== null ? newsItem.actual : 'Belum keluar'}
    - Data Forecast: ${newsItem.estimate !== null ? newsItem.estimate : 'Tiada'}
    - Data Previous: ${newsItem.previous !== null ? newsItem.previous : 'Tiada'}

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

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    } catch (err) {
        console.error("Ralat pemprosesan AI:", err.message);
    }
    return null;
}

// Fungsi menarik data berita secara automatik daripada API Kalendar Ekonomi
async function fetchEconomicCalendar() {
    try {
        console.log("Menyemak kalendar ekonomi terkini...");
        // Mengambil berita USD untuk tempoh semasa
        const response = await axios.get(`https://financialmodelingprep.com/api/v3/economic_calendar?apikey=${FMP_API_KEY}`);
        const events = response.data;

        // Tapis berita penting berimpak tinggi untuk USD (contoh: CPI, NFP, PPI, FOMC)
        const relevantEvents = events.filter(e => e.currency === 'USD' && (e.impact === 'High' || e.impact === 'MEDIUM')).slice(0, 5);

        for (const item of relevantEvents) {
            const targetId = item.event.toLowerCase().replace(/[^a-z0-9]/g, '');
            const existing = newsDatabase.find(n => n.id === targetId);

            // Jika berita baharu atau data actual baru sahaja dikeluarkan/dikemas kini
            if (!existing || existing.actual !== item.actual) {
                const aiResult = await processWithAI(item);
                
                if (aiResult) {
                    const updatedItem = {
                        id: targetId,
                        title: item.event,
                        eventDateTime: item.date,
                        impact: item.impact ? `${item.impact.toUpperCase()} IMPACT` : "HIGH IMPACT",
                        actual: item.actual !== null ? String(item.actual) : "-",
                        forecast: item.estimate !== null ? String(item.estimate) : "-",
                        previous: item.previous !== null ? String(item.previous) : "-",
                        updatedTime: new Date().toLocaleTimeString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur' }),
                        usdBias: aiResult.usdBias,
                        goldSignal: aiResult.goldSignal,
                        recapBm: aiResult.recapBm
                    };

                    const index = newsDatabase.findIndex(n => n.id === targetId);
                    if (index !== -1) {
                        newsDatabase[index] = updatedItem;
                    } else {
                        newsDatabase.unshift(updatedItem);
                    }
                    activeNewsId = targetId;
                }
            }
        }
    } catch (err) {
        console.error("Gagal mengambil data kalendar ekonomi:", err.message);
    }
}

// Menjalankan penyemakan automatik (Cron Job) setiap 5 minit
cron.schedule('*/5 * * * *', () => {
    fetchEconomicCalendar();
});

// Jalankan sekali sebaik sahaja server dinyalakan
fetchEconomicCalendar();

// API Endpoints untuk Frontend
app.get('/api/live-news', (req, res) => {
    const activeEvent = newsDatabase.find(item => item.id === activeNewsId) || newsDatabase[0] || {
        title: "Menunggu Data...",
        eventDateTime: "-",
        impact: "HIGH IMPACT",
        usdBias: "-",
        goldSignal: "-",
        updatedTime: "-",
        recapBm: "Sistem sedang memuatkan data berita automatik..."
    };

    res.json({
        activeEvent: activeEvent,
        allEvents: newsDatabase
    });
});

app.post('/api/select-news', (req, res) => {
    const { id } = req.body;
    const found = newsDatabase.find(item => item.id === id);
    if (found) {
        activeNewsId = id;
        return res.json({ status: "success", activeEvent: found });
    }
    res.status(404).json({ status: "error", message: "Berita tidak ditemui" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server automatik aktif pada port ${PORT}`);
});
