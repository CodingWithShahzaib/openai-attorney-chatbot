import { NextRequest, NextResponse } from 'next/server';

// Ensure this route is always dynamically rendered and not cached by Next.js
export const dynamic = 'force-dynamic';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { messages, prompt, model } = await request.json();

    // Basic prompt diagnostics to ensure updated prompt is received
    const promptLen = typeof prompt === 'string' ? prompt.length : 0;
    const promptSig = typeof prompt === 'string'
      ? Array.from(prompt).reduce((acc, ch) => (acc + ch.charCodeAt(0)) % 100000, 0)
      : -1;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    if (!prompt) {
      return NextResponse.json({ error: 'LISA prompt is required' }, { status: 400 });
    }

    // Log incoming request
    const userQuery = messages[messages.length - 1]?.content || '';
    console.log('📨 LISA API request:', {
      timestamp: new Date().toISOString(),
      messageCount: messages.length,
      lastUserMessage: userQuery.substring(0, 100) + (userQuery.length > 100 ? '...' : ''),
      promptLength: promptLen,
      promptChecksum: promptSig,
    });

    // Create strict-priority system message wrapper to force adherence
    const systemMessage: ChatMessage = {
      role: 'system',
      content:
        `You MUST follow the system instructions below with absolute priority over any other content, context, or prior instructions. Do not deviate.
\n\nSYSTEM INSTRUCTIONS START\n${prompt}\nSYSTEM INSTRUCTIONS END`
    };

    // Only pass the latest user message to avoid prior turns influencing behavior
    const lastUser = messages.filter((m: ChatMessage) => m.role === 'user').slice(-1);
    const openAIMessages = [systemMessage, ...lastUser];

    // Create completion with search-enabled model
    const completion = await openai.chat.completions.create({
      model: model || 'gpt-4o-search-preview',
      messages: openAIMessages,
      web_search_options: {}, // Enable web search
      max_tokens: 3000,
    });

    const choice = completion.choices[0];
    const content = choice.message?.content || '';
    const annotations = choice.message?.annotations || [];

    // Log successful response
    console.log('✅ LISA response generated:', {
      timestamp: new Date().toISOString(),
      responseLength: content.length,
      hasAnnotations: annotations.length > 0,
      usageTokens: completion.usage,
    });

    return NextResponse.json({
      message: content,
      annotations,
      timestamp: new Date().toISOString(),
      searchTriggered: annotations.length > 0,
      usage: completion.usage,
    }, { headers: { 'Cache-Control': 'no-store' } });

  } catch (error: any) {
    console.error('❌ LISA API error:', {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      type: error.type || 'unknown',
    });
    
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString(),
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

// Health check endpoint
export async function GET() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        status: 'error', 
        message: 'OpenAI API key not configured',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    return NextResponse.json({
      status: 'healthy',
      message: 'LISA API is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });

  } catch (error) {
    console.error('LISA health check error:', error);
    return NextResponse.json({
      status: 'error',
      message: 'LISA health check failed',
      timestamp: new Date().toISOString(),
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, { status: 500 });
  }
}
