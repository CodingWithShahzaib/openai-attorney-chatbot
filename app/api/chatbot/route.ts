import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const systemPrompt = `You are a professional legal assistant chatbot that helps users find qualified attorneys. Follow this EXACT flow:

**STEP 1: Inquire about legal issues**
- Ask empathetic, professional questions about the user's legal situation
- Get them to describe their legal problem in detail

**STEP 2: Identify legal problems**
- Based on their description, identify the specific area of law (family, criminal, personal injury, etc.)
- Confirm the legal issue with them

**STEP 3: Ask for city and state**
- ONLY after identifying the legal issue, ask for their city and state
- Say something like: "To help you find attorneys in your area, could you please provide your city and state?"

**STEP 4: Search for attorneys**
- ONLY after you have both the legal issue AND location, you MUST use web search to find exactly three attorneys who can help with the user's legal issue in their location.

SEARCH REQUIREMENTS:
- You MUST perform a web search when you have both the legal issue and location
- Search for terms like: "[legal issue] attorney [city] [state]" or "[legal issue] lawyer [city] [state]"
- Find attorneys with current contact information and websites
- Verify they handle the specific legal issue mentioned

For each attorney, format the information as a structured list:

- **[Attorney Name](website_url)** (or just **Attorney Name** if no website)
  - **Phone:** [phone number]
  - **Location:** [address/city/state]
  - **Practice Area:** [specific practice area]

Format the results as a clean markdown list with each attorney as a main list item containing sub-items for their details. Do not include extra commentary, summaries, or explanations beyond the attorney information. Only output the list of attorneys as described above. If you cannot find three, return as many as you can. If you cannot find any, say so clearly.

CRITICAL: Do not skip steps. Do not search until you have both the legal issue and the city/state. Do not provide general legal advice. Only focus on finding attorneys.
CRITICAL: If phone is not available, do not include it in the output.
When searching, be specific and thorough. Use multiple search strategies if needed to find qualified attorneys in the user's area.`;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OpenAIResponse {
  message: {
    content: string;
    annotations?: any[];
  };
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Enhanced logging function
const logSearchUsage = (annotations: any[], userQuery: string, response: string) => {
  const searchQueries = annotations
    .filter(annotation => annotation.type === 'web_search')
    .map(annotation => annotation.query || 'Unknown query');
  
  console.log('=== SEARCH TOOL USAGE LOG ===', {
    timestamp: new Date().toISOString(),
    userQuery: userQuery?.substring(0, 200) + (userQuery?.length > 200 ? '...' : ''),
    searchQueriesUsed: searchQueries,
    numberOfSearches: searchQueries.length,
    responseContainsAttorneys: response.toLowerCase().includes('attorney') || response.toLowerCase().includes('lawyer'),
    annotationsCount: annotations.length,
    fullAnnotations: annotations,
  });
  
  // Log to console for monitoring
  if (searchQueries.length > 0) {
    console.log(`🔍 Search queries executed: ${searchQueries.join(', ')}`);
  } else {
    console.log('⚠️ No search queries detected in annotations');
  }
};

// Function to check if we have required information to search
const shouldTriggerSearch = (messages: ChatMessage[]): boolean => {
  const conversation = messages.map(msg => msg.content).join(' ').toLowerCase();
  
  // Check if we have legal issue and location
  const hasLegalIssue = /\b(divorce|custody|criminal|injury|contract|employment|immigration|bankruptcy|estate|personal injury|family law|criminal defense|civil litigation|real estate|business law|tax law|intellectual property)\b/.test(conversation);
  
  const hasLocation = /\b(city|state|located|live|in [a-z]+ [a-z]+|[a-z]+,\s*[a-z]{2})\b/.test(conversation);
  
  return hasLegalIssue && hasLocation;
};

// Enhanced prompt injection to force search when conditions are met
const enhancePromptForSearch = (messages: ChatMessage[]): ChatMessage[] => {
  const lastMessage = messages[messages.length - 1];
  
  if (shouldTriggerSearch(messages)) {
    // Add explicit search instruction
    const enhancedSystemPrompt = `${systemPrompt}

IMPORTANT: Based on the conversation, you now have both the legal issue and location. You MUST immediately perform a web search to find attorneys. Do not ask for more information. Search now using terms like "[legal issue] attorney [city] [state]" or similar variations.`;
    
    return [
      { role: 'system', content: enhancedSystemPrompt },
      ...messages.slice(1), // Skip original system message
    ];
  }
  
  return [
    { role: 'system', content: systemPrompt },
    ...messages.slice(1),
  ];
};

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    // Log incoming request
    const userQuery = messages[messages.length - 1]?.content || '';
    console.log('📨 Incoming request:', {
      timestamp: new Date().toISOString(),
      messageCount: messages.length,
      lastUserMessage: userQuery.substring(0, 100) + (userQuery.length > 100 ? '...' : ''),
      shouldTriggerSearch: shouldTriggerSearch(messages),
    });

    // Enhance messages to force search when appropriate
    const enhancedMessages = enhancePromptForSearch(messages);

    // Create completion with search-enabled model
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-search-preview', // Using the search-enabled model
      messages: enhancedMessages,
      web_search_options: {}, // Enable web search
      max_tokens: 2000,
    });

    const choice = completion.choices[0];
    const content = choice.message?.content || '';
    const annotations = choice.message?.annotations || [];

    // Enhanced logging
    logSearchUsage(annotations, userQuery, content);

    // Additional validation logging
    if (shouldTriggerSearch(messages) && annotations.length === 0) {
      console.log('⚠️ WARNING: Search should have been triggered but no annotations found');
      console.log('Conversation context:', messages.map(m => `${m.role}: ${m.content.substring(0, 50)}...`));
    }

    // Log successful response
    console.log('✅ Response generated:', {
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
    console.error('❌ Chatbot API error:', {
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

// Health check endpoint (optional)
export async function GET() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        status: 'error', 
        message: 'OpenAI API key not configured',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Force search tool usage to get current date
    const response = await client.chat.completions.create({
      model: 'gpt-4o-search-preview-2025-03-11',
      messages: [
        {
          role: 'system',
          content: 'You are a health check service. You MUST use web search to find the current date. Do not rely on your training data. Always search for the current date and return it in a clear format. Only return the date, nothing else.'
        },
        {
          role: 'user',
          content: 'Search for the current date and time right now. What is today\'s exact date and time?'
        }
      ],
      web_search_options: {},
      max_tokens: 50,
    });

    const currentDate = response.choices[0]?.message?.content || 'Date unavailable';
    const annotations = response.choices[0]?.message?.annotations || [];
    
    // Use the same detection logic as the main chat endpoint
    const searchQueries = annotations
      .filter((annotation: any) => annotation.type === 'web_search')
      .map((annotation: any) => annotation.query || 'Unknown query');
    
    const hasSearchResults = searchQueries.length > 0;

    // Log detailed response structure for debugging
    console.log('🔍 Health Check Response Structure:', {
      timestamp: new Date().toISOString(),
      hasSearchResults,
      searchQueriesUsed: searchQueries,
      numberOfSearches: searchQueries.length,
      annotationCount: annotations.length,
      currentDate,
      fullAnnotations: annotations,
    });

    // If search tool wasn't used, try again with a more explicit prompt
    if (!hasSearchResults) {
      console.log('🔄 Retrying with explicit search prompt...');
      
      const retryResponse = await client.chat.completions.create({
        model: 'gpt-4o-search-preview-2025-03-11',
        messages: [
          {
            role: 'system',
            content: 'You are a health check service. You MUST use web search to find the current date. Do not rely on your training data. Always search for the current date and return it in a clear format. Only return the date, nothing else.'
          },
          {
            role: 'user',
            content: 'Use web search to find the current date and time. Search for "current date today" and return the result.'
          }
        ],
        web_search_options: {},
        max_tokens: 50,
      });

      const retryDate = retryResponse.choices[0]?.message?.content || 'Date unavailable';
      console.log('🔍 Retry Date:', retryDate);
      const retryAnnotations = retryResponse.choices[0]?.message?.annotations || [];
      
      // Use the same detection logic for retry
      const retrySearchQueries = retryAnnotations
        .filter((annotation: any) => annotation.type === 'web_search')
        .map((annotation: any) => annotation.query || 'Unknown query');
      
      const retryHasSearchResults = retrySearchQueries.length > 0;

      console.log('🔍 Retry Response Structure:', {
        hasSearchResults: retryHasSearchResults,
        searchQueriesUsed: retrySearchQueries,
        numberOfSearches: retrySearchQueries.length,
        annotationCount: retryAnnotations.length,
        currentDate: retryDate,
        fullAnnotations: retryAnnotations,
      });

      // Use retry result if it has search results, otherwise use original
      if (retryHasSearchResults) {
        return NextResponse.json({
          status: 'healthy',
          message: 'Chatbot API is running',
          currentDate: retryDate,
          searchToolUsed: true,
          searchToolRequired: true,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        });
      }
    }

    return NextResponse.json({
      status: 'healthy',
      message: 'Chatbot API is running',
      currentDate: currentDate,
      searchToolUsed: hasSearchResults,
      searchToolRequired: true,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });

  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, { status: 500 });
  }
}