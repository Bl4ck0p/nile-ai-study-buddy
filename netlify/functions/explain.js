const { GoogleGenerativeAI } = require("@google/generative-ai");

// List of all 12 API keys from environment variables
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
].filter(key => key && key.trim() !== ""); // Only keep keys that actually exist

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
        body: JSON.stringify({ error: 'No API keys configured. Add GEMINI_API_KEY_1 through GEMINI_API_KEY_12 in Netlify environment variables.' })
      };
    }

    // Build the prompt
    let prompt = `You are Nile AI Study Buddy, an expert study assistant for Nile University students. `;
    
    switch (mode) {
      case 'summarize':
        prompt += `Summarize the following content into clear, concise key points that a student can use for quick revision. Use bullet points and highlight important concepts:\n\n`;
        break;
      case 'quiz':
        prompt += `Create 5 multiple-choice quiz questions based on the following content. For each question, provide 4 options (A, B, C, D) and indicate the correct answer with an explanation. Format clearly:\n\n`;
        break;
      case 'explain':
      default:
        prompt += `Explain the following step-by-step in a clear, educational way. Break down complex concepts, provide examples, and help the student truly understand (not just memorize). Use headers, bullet points, and clear structure:\n\n`;
    }

    prompt += text || '';
    if (fileContents && fileContents.length > 0) {
      prompt += `\n\n---\nAdditional context from uploaded files:\n${fileContents.join('\n\n')}`;
    }

    // Try each API key until one works
    let lastError = null;
    
    for (let i = 0; i < apiKeys.length; i++) {
      try {
        console.log(`Trying API key #${i + 1}...`);
        const genAI = new GoogleGenerativeAI(apiKeys[i]);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const result = await model.generateContent(prompt);
        const aiResponse = result.response.text();
        
        console.log(`✅ API key #${i + 1} succeeded!`);
        
        // Success! Return response
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            result: aiResponse,
            mode: mode,
            keyUsed: i + 1,  // Tells you which key worked
            timestamp: new Date().toISOString()
          })
        };
      } catch (err) {
        lastError = err;
        console.log(`❌ API key #${i + 1} failed:`, err.message);
        // Continue to next key
      }
    }
    
    // All keys failed
    throw new Error(`All ${apiKeys.length} API keys failed. Last error: ${lastError?.message}`);
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.toString()
      })
    };
  }
};