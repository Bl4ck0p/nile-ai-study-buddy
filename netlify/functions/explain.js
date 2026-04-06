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
    const { text, mode, fileContents } = JSON.parse(event.body);
    
    if (!text && (!fileContents || fileContents.length === 0)) {
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
        body: JSON.stringify({ error: 'No API keys configured.' })
      };
    }

    // Optimized prompts for faster responses
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
        prompt += `Explain this briefly in simple terms (max 150 words):\n\n`;
    }

    prompt += text || '';
    if (fileContents && fileContents.length > 0) {
      prompt += `\n\nContext:\n${fileContents.join('\n').substring(0, 1500)}`;
    }

    // Try each API key
    let lastError = null;
    
    for (let i = 0; i < apiKeys.length; i++) {
      try {
        const genAI = new GoogleGenerativeAI(apiKeys[i]);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        // Use streaming for faster perceived response
        const result = await model.generateContent(prompt);
        const aiResponse = result.response.text();
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            result: aiResponse,
            mode: mode,
            keyUsed: i + 1,
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