const { GoogleGenerativeAI } = require("@google/generative-ai");

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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'API key not configured. Add GEMINI_API_KEY in Netlify environment variables.' })
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        result: aiResponse,
        mode: mode,
        timestamp: new Date().toISOString()
      })
    };

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