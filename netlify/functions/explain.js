const { GoogleGenerativeAI } = require("@google/generative-ai");

// List of all API keys from environment variables
const apiKeys = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
  process.env.GEMINI_API_KEY_6,
  process.env.GEMINI_API_KEY_7,
  process.env.GEMINI_API_KEY_8,
  process.env.GEMINI_API_KEY_9,
  process.env.GEMINI_API_KEY_10,
  process.env.GEMINI_API_KEY_11,
  process.env.GEMINI_API_KEY_12
].filter(key => key && key.trim() !== "");

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const { text, mode, fileContents, images, chatHistory } = JSON.parse(event.body);

    const hasImages = Array.isArray(images) && images.length > 0;
    const hasText = text && text.trim().length > 0;
    const hasFiles = fileContents && fileContents.length > 0;

    if (!hasText && !hasFiles && !hasImages) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No content provided' })
      };
    }

    if (apiKeys.length === 0) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'No API keys configured. Set GEMINI_API_KEY_1..12 in Netlify env vars.' })
      };
    }

    // 1. Build the system prompt text
    let prompt = `You are Nile AI Study Buddy. Be concise and clear. `;

    switch (mode) {
      case 'summarize':
        prompt += `Summarize this in 3-5 bullet points only:\n\n`;
        break;
      case 'quiz':
        prompt += `Create 5 multiple-choice questions. Format EXACTLY like this for each question:

1. [Question text here]
A. [Option A]
B. [Option B]
C. [Option C]
D. [Option D]
Correct Answer: [A/B/C/D]
Explanation: [Brief explanation]

Use this exact format.`;
        break;
      case 'explain':
      default:
        prompt += `Explain this briefly in simple terms. If the user says "continue", pick up exactly where the last explanation left off.\n\n`;
    }

    if (hasImages && !hasText && !hasFiles) {
      prompt += `Analyze the attached image(s). Read the content carefully and respond according to the mode above.`;
    } else {
      prompt += text || '';
    }

    if (hasFiles) {
      prompt += `\n\nContext:\n${fileContents.join('\n').substring(0, 1500)}`;
    }

    // 2. Build the multimodal parts array for the CURRENT message
    const currentParts = [{ text: prompt }];

    if (hasImages) {
      for (const img of images) {
        if (!img || !img.data || !img.mimeType) continue;
        currentParts.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.data
          }
        });
      }
    }

    // 3. Format the Chat History for Gemini
    const contents = [];
    
    if (Array.isArray(chatHistory) && chatHistory.length > 0) {
      // Exclude the very last message in history (it's the current one we just built above)
      const historyToFormat = chatHistory.slice(0, -1);
      
      historyToFormat.forEach(msg => {
        // Gemini expects 'user' or 'model' for roles
        const role = msg.role === 'assistant' ? 'model' : 'user';
        contents.push({
          role: role,
          parts: [{ text: msg.content }]
        });
      });
    }

    // Add the current message with images to the end of the history
    contents.push({
      role: 'user',
      parts: currentParts
    });

    // Try each API key
    let lastError = null;

    for (let i = 0; i < apiKeys.length; i++) {
      try {
        const genAI = new GoogleGenerativeAI(apiKeys[i]);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Send the entire history + current message
        const result = await model.generateContent({ contents });
        const aiResponse = result.response.text();

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            result: aiResponse,
            mode: mode,
            keyUsed: i + 1,
            hadImages: hasImages,
            timestamp: new Date().toISOString()
          })
        };
      } catch (err) {
        lastError = err;
        console.log(`API key ${i + 1} failed:`, err.message);
      }
    }

    throw new Error(`All ${apiKeys.length} API keys failed. Last error: ${lastError?.message}`);

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Internal server error'
      })
    };
  }
};
