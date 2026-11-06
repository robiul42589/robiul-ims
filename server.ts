import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize Gemini SDK on the server-side as mandated by SKILL.md
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  } catch (err) {
    console.error('Error initializing GoogleGenAI:', err);
  }
}

// AI Chat Assistant API endpoint
app.post('/api/ai-chat', async (req, res) => {
  const { prompt, language = 'bn', context } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // If Gemini client is configured with API key, use gemini-3.8-flash
  if (aiClient && process.env.GEMINI_API_KEY) {
    try {
      const systemInstruction = `You are the official intelligent assistant for "Robiul - Information Management System" (রোবিউল - ইনফরমেশন ম্যানেজমেন্ট সিস্টেম).
The owner is Md. Robiul Islam (মোঃ রোবিউল ইসলাম).
Respond in ${language === 'bn' ? 'Bengali (বাংলা)' : 'English'}, using respectful, helpful, and concise professional language.
Current Context of Robiul's records:
- Owner Name: ${context?.name || 'মোঃ রোবিউল ইসলাম'}
- Family Members registered: ${context?.totalFamily || 0} (${context?.familyNames || ''})
- Land Assets: ${context?.totalAssets || 0} Khatians with ${context?.totalPlots || 0} plots, estimated valuation: ৳ ${context?.totalAssetVal || 0} BDT
- Active Liabilities/Debts: ${context?.activeDebtCount || 0} loans with total remaining debt: ৳ ${context?.totalRemainingDebt || 0} BDT
- Current Employment: ${context?.currentJob || 'Information Officer'}
- Education: ${context?.degrees || 'B.Sc in CSE'}

Help the user understand their assets, liabilities, how to add records, how to export/import backups, or view printable reports.`;

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction
        }
      });

      const reply = response.text || '';
      return res.json({ reply });
    } catch (apiError: any) {
      console.warn('Gemini API call failed, falling back to local advisor:', apiError?.message || apiError);
    }
  }

  // Graceful fallback response
  let fallbackReply = '';
  if (language === 'bn') {
    fallbackReply = `রোবিউল IMS সহকারী: আপনার অ্যাকাউন্টে বর্তমানে ${context?.totalFamily || 4} জন পারিবারিক সদস্য, ${context?.totalPlots || 3}টি জমির দাগ এবং ৳ ${(context?.totalRemainingDebt || 40000).toLocaleString('bn-BD')} টাকার সক্রিয় দায় রয়েছে। নির্দিষ্ট তথ্য জানতে বা নতুন রেকর্ড যুক্ত করতে বাম পাশের মেনু ব্যবহার করুন।`;
  } else {
    fallbackReply = `Robiul IMS Assistant: You currently have ${context?.totalFamily || 4} family members, ${context?.totalPlots || 3} land plots, and BDT ${(context?.totalRemainingDebt || 40000).toLocaleString()} in active liabilities recorded.`;
  }

  return res.json({ reply: fallbackReply });
});

// Source Code Zip Download endpoint
app.get('/api/download-zip', (req, res) => {
  const zipPath = path.resolve(__dirname, 'robiul-ims-source.zip');
  if (fs.existsSync(zipPath)) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="robiul-ims-source.zip"');
    return res.sendFile(zipPath);
  }
  return res.status(404).json({ error: 'Zip file not found' });
});

// Setup Vite middlewares in development or static serve in production
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (${isDev ? 'development' : 'production'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
