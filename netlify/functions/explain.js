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
    let prompt = `You are Nile AI Study Buddy, an expert academic tutor. 
IMPORTANT: Whenever you write math, ALWAYS use standard LaTeX formatting wrapped in $ signs (e.g. $x^2$ or $$\\int x dx$$). NEVER use raw unformatted math symbols. Use proper Markdown formatting for everything else.
`;

    switch (mode) {
      case 'summarize':
        prompt += `Provide a comprehensive summary using bullet points. Do not leave out important details.\n\n`;
        break;
      case 'quiz':
        prompt += `Create a comprehensive practice quiz. Provide 5-8 questions with multiple-choice options. Format EXACTLY like this for each question:

1. [Question text here]
A. [Option A]
B. [Option B]
C. [Option C]
D. [Option D]
Correct Answer: [A/B/C/D]
Explanation: [Brief explanation]

Use this exact format. Do not stop generating until you have finished all questions.\n\n`;
        break;
      case 'explain':
      default:
        prompt += `CRITICAL INSTRUCTIONS FOR EXPLAIN MODE:
1. Provide a highly condensed, summarized explanation of the material below. Use bullet points or short paragraphs.
2. DO NOT exceed 400 words in your main explanation.
3. Ensure you finish your thought completely and do not cut off mid-sentence.
4. You MUST append exactly this text at the very end of your response on a new line: "**Would you like me to continue with more details or move on to a specific part?**"

MATERIAL TO EXPLAIN:\n\n`;
    }

    if (hasImages && !hasText && !hasFiles) {
      prompt += `Analyze the attached image(s). Read the content carefully and respond according to the mode above.`;
    } else {
      prompt += text || '';
    }

    if (hasFiles) {
      prompt += `\n\nDOCUMENT CONTEXT TO ANALYZE:\n${fileContents.join('\n').substring(0, 3000)}`;
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
      const historyToFormat = chatHistory.slice(0, -1);
      
      historyToFormat.forEach(msg => {
        const role = msg.role === 'assistant' ? 'model' : 'user';
        contents.push({
          role: role,
          parts: [{ text: msg.content }]
        });
      });
    }

    contents.push({
      role: 'user',
      parts: currentParts
    });

    // Try each API key
    let lastError = null;

    for (let i = 0; i < apiKeys.length; i++) {
      try {
        const genAI = new GoogleGenerativeAI(apiKeys[i]);
        
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: {
                maxOutputTokens: 2048, 
                temperature: 0.6, 
            }
        });

        const result = await model.generateContent({ contents });
        let aiResponse = result.response.text();

        if (mode === 'explain' && !aiResponse.includes("Would you like me to continue")) {
            aiResponse += "\n\n**Would you like me to continue with more details or move on to a specific part?**";
        }

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
