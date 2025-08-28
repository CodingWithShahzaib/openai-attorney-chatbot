import { NextRequest, NextResponse } from 'next/server';
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
    const { messages, prompt } = await request.json();

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
    });

    // Create system message with the LISA prompt
    const systemMessage: ChatMessage = {
      role: 'system',
      content: prompt
    };

    // Prepare messages for OpenAI
    const openAIMessages = [systemMessage, ...messages];

    // Create completion with search-enabled model
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-search-preview', // Using the search-enabled model
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
    });

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
      { status: 500 }
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
