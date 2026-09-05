const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const apiKey = process.env.GEMINI_API_KEY;
const FMP_API_KEY = process.env.FMP_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

// Pangkalan Data Berita Utama
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
        id: "cpi",
        title: "Consumer Price Index (CPI)",
        eventDateTime: "11 SEP | 20:30 (GMT+8)",
        impact: "HIGH IMPACT",
        usdBias: "Bearish USD",
        goldSignal: "BUY GOLD",
        updatedTime: "Belum Berlangsung",
        recapBm: "Jangkaan penurunan kadar inflasi boleh memberi tekanan susutan kepada mata wang USD dan memberi ruang lonjakan kepada harga Emas."
    },
    {
        id: "ppi",
        title: "Producer Price Index (PPI)",
        eventDateTime: "12 SEP | 20:30 (GMT+8)",
        impact: "HIGH IMPACT",
        usdBias: "Bullish USD",
        goldSignal: "SELL GOLD",
        updatedTime: "Belum Berlangsung",
        recapBm: "Indeks harga pengeluar kekal stabil dan menunggu pelepasan data rasmi daripada pihak Fed."
    },
    {
        id: "fomc",
        title: "FOMC Rate Decision",
        eventDateTime: "17 SEP | 02:00 (GMT+8)",
        impact: "HIGH IMPACT",
        usdBias: "Bearish USD",
        goldSignal: "BUY GOLD",
        updatedTime: "Belum Berlangsung",
        recapBm: "Keputusan kadar faedah Federal Reserve bakal menjadi penentu arah aliran utama pasaran emas bagi suku ke-3."
    }
];

let activeNewsId = "nfp";

async function processWithAI(newsItem) {
    const prompt = `
    Sebagai pakar analisis fundamental Forex & Gold (XAU/USD), analisa data berita berikut:
    - Tajuk Berita: ${newsItem.event || newsItem.title}
    - Tarikh & Masa Acara: ${newsItem.date || newsItem.eventDateTime}
    - Data Actual: ${newsItem.actual !== undefined ? newsItem.actual : 'Belum keluar'}
    - Data Forecast: ${newsItem.estimate !== undefined ? newsItem.estimate : 'Tiada'}
    - Data Previous: ${newsItem.previous !== undefined ? newsItem.previous : 'Tiada'}

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
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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

async function fetchEconomicCalendar() {
    if (!FMP_API_KEY) {
        console.log("FMP_API_KEY belum diset. Menggunakan mod manual.");
        return;
    }

    try {
        console.log("Menyemak kalendar ekonomi terkini...");
        const response = await axios.get(`https://financialmodelingprep.com/api/v3/economic_calendar?apikey=${FMP_API_KEY}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            }
        });
        const events = response.data;

        if (Array.isArray(events)) {
            const relevantEvents = events.filter(e => e.currency === 'USD' && (e.impact === 'High' || e.impact === 'Medium')).slice(0, 5);

            for (const item of relevantEvents) {
                const targetId = item.event.toLowerCase().replace(/[^a-z0-9]/g, '');
                const existing = newsDatabase.find(n => n.id === targetId);

                if (!existing || existing.actual !== String(item.actual)) {
                    const aiResult = await processWithAI(item);
                    
                    if (aiResult) {
                        const updatedItem = {
                            id: targetId,
                            title: item.event,
                            eventDateTime: item.date || "MASA TIDAK DISET",
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
        }
    } catch (err) {
        console.error("Gagal mengambil data kalendar ekonomi:", err.message);
    }
}

cron.schedule('*/5 * * * *', () => {
    fetchEconomicCalendar();
});

fetchEconomicCalendar();

app.get('/api/live-news', (req, res) => {
    const activeEvent = newsDatabase.find(item => item.id === activeNewsId) || newsDatabase[0];
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

app.post('/api/trigger-analysis', async (req, res) => {
    const { id, newsTitle, eventDateTime, impact, actual, forecast, previous, fedRemarks } = req.body;

    const mockItem = {
        event: newsTitle,
        date: eventDateTime,
        actual: actual,
        estimate: forecast,
        previous: previous
    };

    const aiResult = await processWithAI(mockItem);

    if (aiResult) {
        const targetId = id || newsTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
        const updatedItem = {
            id: targetId,
            title: newsTitle,
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
            newsDatabase.unshift(updatedItem);
        }

        activeNewsId = targetId;
        return res.json({ status: "success", data: updatedItem });
    }

    res.status(500).json({ status: "error", message: "Gagal memproses AI" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server aktif pada port ${PORT}`);
});
