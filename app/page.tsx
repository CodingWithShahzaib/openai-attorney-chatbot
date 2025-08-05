'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './page.module.css';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    detectedLocation?: string;
    detectedIssue?: string;
  };
}

interface AttorneyInfo {
  name: string;
  firm: string;
  phone: string;
  email?: string;
  address: string;
  experience: string;
  specializations: string[];
  consultation: string;
}

export default function AttorneyChatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState('');
  const [legalIssue, setLegalIssue] = useState('');
  const [attorneyResults, setAttorneyResults] = useState<AttorneyInfo[]>([]);
  const [showAttorneyCard, setShowAttorneyCard] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initialize with welcome message on client side to avoid hydration mismatch
    if (!isInitialized) {
      setMessages([
        {
          role: 'assistant',
          content: '👋 Hello! I\'m your AI legal assistant. I\'m here to help you find the right attorney for your legal needs.\n\nTo get started, please tell me:\n\n1️⃣ **What legal issue are you facing?** (e.g., divorce, personal injury, criminal defense)\n2️⃣ **Where are you located?** (city and state)\n\nI\'ll then search for qualified attorneys in your area who specialize in your specific legal matter.',
          timestamp: new Date().toISOString()
        }
      ]);
      setIsInitialized(true);
    }
  }, [isInitialized]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  // Typing indicator effect
  useEffect(() => {
    if (isLoading) {
      setIsTyping(true);
      const timer = setTimeout(() => setIsTyping(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: inputValue,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          userLocation,
          legalIssue
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: data.timestamp,
        metadata: {
          detectedLocation: data.detectedLocation,
          detectedIssue: data.detectedIssue
        }
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Update detected information from backend response
      if (data.detectedLocation && data.detectedLocation !== 'Not provided yet') {
        setUserLocation(data.detectedLocation);
      }
      if (data.detectedIssue && data.detectedIssue !== 'Not identified yet') {
        setLegalIssue(data.detectedIssue);
      }

      // Check if the response contains attorney information
      if (data.message.includes('attorney') || data.message.includes('lawyer') || 
          data.message.includes('contact') || data.message.includes('phone')) {
        setShowAttorneyCard(true);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again or check your internet connection.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearConversation = () => {
    setMessages([
      {
        role: 'assistant',
        content: '👋 Hello! I\'m your AI legal assistant. I\'m here to help you find the right attorney for your legal needs.\n\nTo get started, please tell me:\n\n1️⃣ **What legal issue are you facing?** (e.g., divorce, personal injury, criminal defense)\n2️⃣ **Where are you located?** (city and state)\n\nI\'ll then search for qualified attorneys in your area who specialize in your specific legal matter.',
        timestamp: new Date().toISOString()
      }
    ]);
    setUserLocation('');
    setLegalIssue('');
    setAttorneyResults([]);
    setShowAttorneyCard(false);
  };

  return (
    <div className={styles.container}>
      {/* Modern Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className={styles.logoText}>
              <h1>Legal AI Assistant</h1>
              <p>Find the right attorney for your needs</p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button onClick={clearConversation} className={styles.clearButton}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 6H5H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Clear Chat
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        {/* Chat Container */}
        <div className={styles.chatContainer}>
          <div className={styles.messagesContainer} ref={chatContainerRef}>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`${styles.message} ${
                  message.role === 'user' ? styles.userMessage : styles.assistantMessage
                }`}
              >
                <div className={styles.messageContent}>
                  <div className={styles.messageHeader}>
                    <div className={styles.messageAvatar}>
                      {message.role === 'user' ? (
                        <div className={styles.userAvatar}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      ) : (
                        <div className={styles.assistantAvatar}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                      <div className={styles.messageInfo}>
                        <span className={styles.messageRole}>
                          {message.role === 'user' ? 'You' : 'Legal AI Assistant'}
                        </span>
                        <span className={styles.messageTime}>
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.messageText}>
                    <ReactMarkdown
                      components={{
                        a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" className={styles.link} />,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                  {message.metadata && (message.metadata.detectedLocation || message.metadata.detectedIssue) && (
                    <div className={styles.messageMetadata}>
                      {message.metadata.detectedLocation && (
                        <span className={styles.metadataTag}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M21 10C21 17 12 23 12 23S3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.364 3.63604C20.0518 5.32387 21 7.61305 21 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          {message.metadata.detectedLocation}
                        </span>
                      )}
                      {message.metadata.detectedIssue && (
                        <span className={styles.metadataTag}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          {message.metadata.detectedIssue}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Modern Typing Indicator */}
            {isLoading && (
              <div className={`${styles.message} ${styles.assistantMessage}`}>
                <div className={styles.messageContent}>
                  <div className={styles.messageHeader}>
                    <div className={styles.messageAvatar}>
                      <div className={styles.assistantAvatar}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div className={styles.messageInfo}>
                        <span className={styles.messageRole}>Legal AI Assistant</span>
                        <span className={styles.messageTime}>Typing...</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.typingIndicator}>
                    <div className={styles.typingDots}>
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Modern Input Area */}
          <div className={styles.inputContainer}>
            <div className={styles.inputWrapper}>
              <div className={styles.inputField}>
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Describe your legal issue or ask for attorney recommendations..."
                  className={styles.messageInput}
                  rows={1}
                  disabled={isLoading}
                />
                <div className={styles.inputActions}>
                  <button
                    onClick={sendMessage}
                    disabled={!inputValue.trim() || isLoading}
                    className={styles.sendButton}
                  >
                    {isLoading ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M12 18V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M4.93 4.93L7.76 7.76" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M16.24 16.24L19.07 19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M2 12H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M18 12H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M4.93 19.07L7.76 16.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M16.24 7.76L19.07 4.93" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
            <div className={styles.inputFooter}>
              <span>Press Enter to send, Shift+Enter for new line</span>
            </div>
          </div>
        </div>

        {/* Modern Sidebar */}
        {showAttorneyCard && (
          <div className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <h3>📋 Quick Info</h3>
            </div>
            <div className={styles.sidebarContent}>
              {userLocation && (
                <div className={styles.infoCard}>
                  <div className={styles.infoCardHeader}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21 10C21 17 12 23 12 23S3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.364 3.63604C20.0518 5.32387 21 7.61305 21 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <h4>Location</h4>
                  </div>
                  <p>{userLocation}</p>
                </div>
              )}
              {legalIssue && (
                <div className={styles.infoCard}>
                  <div className={styles.infoCardHeader}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <h4>Legal Issue</h4>
                  </div>
                  <p>{legalIssue}</p>
                </div>
              )}
              <div className={styles.infoCard}>
                <div className={styles.infoCardHeader}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <h4>Tips</h4>
                </div>
                <ul>
                  <li>Most attorneys offer free consultations</li>
                  <li>Ask about their experience with similar cases</li>
                  <li>Check their credentials and reviews</li>
                  <li>Discuss fees and payment plans upfront</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
