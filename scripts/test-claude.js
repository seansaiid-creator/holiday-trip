require('dotenv').config({ path: '.env.local' });
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function testClaude() {
  console.log('Testing Claude API...\n');

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: 'Say "Hello, HolidayTrip is working!" and tell me one interesting fact about Chuseok (Korean holiday).',
        },
      ],
    });

    console.log('✓ Claude API connection successful!\n');
    console.log('Response:');
    console.log('---');
    console.log(message.content[0].text);
    console.log('---\n');
    console.log('Token usage:', message.usage);
  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

testClaude();