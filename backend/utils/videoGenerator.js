const axios = require('axios');
require('dotenv').config();

async function generateVideoFromImage(imageInput) {
    try {
        console.log("=== VIDEO GENERATION START ===");
        const HF_API_URL = "https://api-inference.huggingface.co/models/stabilityai/stable-video-diffusion-img2vid-xt";

        // Ensure we have an API key
        if (!process.env.HF_API_TOKEN) {
            console.error("HF_API_TOKEN missing.");
            return { success: false, error: "Video generation disabled: Missing API Key." };
        }

        // Prepare Payload
        // SVD expects the image as a base64 string or URL
        // If imageInput is a data URI (data:image/jpeg;base64,...), we use it directly?
        // HF Inference API usually prefers raw base64 without prefix for some models, or data URI for others.
        // SVD usually takes "image" in inputs.

        console.log("Calling Hugging Face SVD...");

        // We use a simplified payload for stability
        const payload = {
            inputs: imageInput, // Expecting data URI or URL
            parameters: {
                motion_bucket_id: 127,
                noise_aug_strength: 0.02
            }
        };

        const response = await axios.post(
            HF_API_URL,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.HF_API_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer', // We expect binary video data back
                timeout: 60000 // 60s timeout (Vercel limit warning)
            }
        );

        console.log("Video generated successfully! Size:", response.data.length);

        // Convert Buffer to Base64 for frontend
        const videoBase64 = Buffer.from(response.data).toString('base64');
        const dataUrl = `data:video/mp4;base64,${videoBase64}`;

        return {
            success: true,
            video: dataUrl
        };

    } catch (error) {
        console.error("=== VIDEO GENERATION FAILED ===");
        console.error("Error:", error.message);
        if (error.response) {
            console.error("HF Status:", error.response.status);
            console.error("HF Data:", error.response.data.toString());

            // Check for model loading error
            if (error.response.data.toString().includes("loading")) {
                return { success: false, error: "Model is warming up. Please try again in 5 minutes." };
            }
        }
        return { success: false, error: "Unable to generate video at this time." };
    }
}

module.exports = { generateVideoFromImage };
