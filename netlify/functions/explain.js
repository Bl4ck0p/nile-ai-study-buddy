const { GoogleGenerativeAI } = require("@google/generative-ai");

// List of all API keys from environment variables
const apiKeys = [
  process.env.GEMINI_API_KEY_1, process.env.GEMINI_API_KEY_2, process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4, process.env.GEMINI_API_KEY_5, process.env.GEMINI_API_KEY_6,
  process.env.GEMINI_API_KEY_7, process.env.GEMINI_API_KEY_8, process.env.GEMINI_API_KEY_9,
  process.env.GEMINI_API_KEY_10, process.env.GEMINI_API_KEY_11, process.env.GEMINI_API_KEY_12
].filter(key => key && key.trim() !== "");

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  try {
    const { text, mode, fileContents, images, chatHistory } = JSON.parse(event.body);

    const hasImages = Array.isArray(images) && images.length > 0;
    const hasText = text && text.trim().length > 0;
    const hasFiles = fileContents && fileContents.length > 0;

    if (!hasText && !hasFiles && !hasImages) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No content provided' }) };
    }
    if (apiKeys.length === 0) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'No API keys configured.' }) };
    }

    // 1. Build the System Prompt
    let prompt = `You are Nile AI Study Buddy, an expert academic tutor. `;

    switch (mode) {
      case 'summarize':
        prompt += `Provide a comprehensive summary using bullet points. Do not leave out important details.\n\n`;
        break;
      case 'quiz':
        prompt += `Create a comprehensive practice quiz. Provide 5-8 questions with multiple-choice options. Format EXACTLY like this for each question:\n\n1. [Question]\nA. [Opt A]\nB. [Opt B]\nC. [Opt C]\nD. [Opt D]\nCorrect Answer: [A/B/C/D]\nExplanation: [Brief]\n\nUse this exact format. Do not stop generating until you have finished all questions.\n\n`;
        break;
      case 'explain':
      default:
        prompt += `Explain the following material thoroughly and in detail. Break down complex concepts into easy-to-understand parts. Do NOT cut off mid-sentence. If the user asks you to "continue", pick up exactly where the last explanation left off.\n\n`;
    }

    if (hasImages && !hasText && !hasFiles) {
      prompt += `Analyze the attached image(s). Read the content carefully and respond according to the mode above.`;
    } else {
      prompt += text || '';
    }

    if (hasFiles) {
      prompt += `\n\nDOCUMENT CONTEXT TO ANALYZE:\n${fileContents.join('\n').substring(0, 4000)}`;
    }

    // 2. Build Gemini Parts (Text + Images)
    const currentParts = [{ text: prompt }];
    if (hasImages) {
      for (const img of images) {
        if (!img || !img.data || !img.mimeType) continue;
        currentParts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
      }
    }

    // 3. Format Chat History
    const contents = [];
    if (Array.isArray(chatHistory) && chatHistory.length > 0) {
      const historyToFormat = chatHistory.slice(0, -1); // Exclude current message
      historyToFormat.forEach(msg => {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      });
    }
    contents.push({ role: 'user', parts: currentParts });

    // 4. Start the Stream (Fallback loop through API keys)
    let streamResult = null;

    for (let i = 0; i < apiKeys.length; i++) {
      try {
        const genAI = new GoogleGenerativeAI(apiKeys[i]);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { maxOutputTokens: 8192, temperature: 0.7 }
        });

        streamResult = await model.generateContentStream({ contents });
        break; // Successfully connected, break the loop
      } catch (err) {
        console.log(`API key ${i + 1} failed:`, err.message);
      }
    }

    if (!streamResult) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "All API keys failed." }) };
    }

    // 5. Create a ReadableStream to send data chunk-by-chunk to the frontend
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of streamResult.stream) {
            const chunkText = chunk.text();
            controller.enqueue(encoder.encode(chunkText));
          }
        } catch (err) {
          console.error("Stream error:", err);
        } finally {
          controller.close();
        }
      }
    });

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked'
      },
      body: stream
    };

  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
