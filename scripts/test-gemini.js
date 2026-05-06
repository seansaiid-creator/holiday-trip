require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testGemini() {
  console.log('Testing Gemini API...\n');

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = 'Say "Hello, HolidayTrip is working!" and tell me one interesting fact about Chuseok (Korean holiday).';

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    console.log('✓ Gemini API connection successful!\n');
    console.log('Response:');
    console.log('---');
    console.log(text);
    console.log('---\n');
    console.log('Token usage:', response.usageMetadata);
  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

testGemini();