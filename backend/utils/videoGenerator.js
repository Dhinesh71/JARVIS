const axios = require('axios');
require('dotenv').config();

// Simple in-memory cache to prevent spamming HF
const videoCache = new Map();

async function generateVideoFromImage(imageInput) {
    // 1. INPUT VALIDATION
    if (!imageInput || typeof imageInput !== 'string') {
        return { success: false, error: "Invalid image input." };
    }

    // 2. CACHE CHECK (If we processed this exact imageRecently)
    const cacheKey = imageInput.slice(-100); // Use last 100 chars as key signature
    if (videoCache.has(cacheKey)) {
        console.log("Returning cached video result.");
        return videoCache.get(cacheKey);
    }

    try {
        console.log("=== VIDEO GENERATION START ===");

        // Ensure we have an API key
        if (!process.env.HF_API_TOKEN) {
            console.error("HF_API_TOKEN missing.");
            return { success: false, error: "Video disabled: Missing Key." };
        }

        const HF_API_URL = "https://api-inference.huggingface.co/models/stabilityai/stable-video-diffusion-img2vid-xt";

        // 3. OPTIMIZED PAYLOAD
        const payload = {
            inputs: imageInput,
            parameters: {
                motion_bucket_id: 127,
                noise_aug_strength: 0.02
            }
        };

        // 4. CALL API WITH SHORT TIMEOUT FOR VERCEL
        // Vercel Serverless Function Limit is usually 10s (Hobby) or 60s (Pro).
        // SVD takes ~30-60s. This is RISKY on Hobby Tier.
        // We set timeout to 50s to fail gracefully before Vercel kills us.
        const response = await axios.post(
            HF_API_URL,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.HF_API_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer',
                timeout: 50000
            }
        );

        console.log("Video generated successfully! Size:", response.data.length);

        const videoBase64 = Buffer.from(response.data).toString('base64');
        const dataUrl = `data:video/mp4;base64,${videoBase64}`;

        const result = { success: true, video: dataUrl };

        // Save to cache
        videoCache.set(cacheKey, result);

        return result;

    } catch (error) {
        console.error("=== VIDEO GENERATION FAILED ===");

        let errorMsg = "Unable to generate video.";

        if (error.code === 'ECONNABORTED') {
            errorMsg = "Video generation timed out (Server Limit).";
        } else if (error.response) {
            const dataStr = error.response.data.toString();
            console.error("HF Error:", dataStr);

            if (dataStr.includes("loading") || error.response.status === 503) {
                errorMsg = "Video Model is warming up. Try again in 2 mins.";
            } else if (error.response.status === 429) {
                errorMsg = "Rate limit reached. Please wait.";
            }
        }

        return { success: false, error: errorMsg };
    }
}

module.exports = { generateVideoFromImage };
