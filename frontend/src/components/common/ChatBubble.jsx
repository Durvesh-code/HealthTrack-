import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';
import api from '../../config/api';
import ReactMarkdown from 'react-markdown';
import '../../styles/chatbot.css';

const ChatBubble = () => {
    const { user } = useAuth();
    const location = useLocation();
    
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Draggable and Resizable state
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [size, setSize] = useState({ width: 400, height: window.innerHeight - 60 });
    
    const messagesEndRef = useRef(null);
    
    // Dragging refs
    const dragStart = useRef({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const posRef = useRef({ x: 0, y: 0 });

    // Sync posRef with position state to avoid closure issues in event listeners
    useEffect(() => {
        posRef.current = position;
    }, [position]);

    // Resizing refs
    const resizeStart = useRef({ width: 0, height: 0, startX: 0, startY: 0 });
    const isResizing = useRef(false);
    const resizeType = useRef('');
    const sizeRef = useRef({ width: 400, height: window.innerHeight - 60 });

    useEffect(() => {
        sizeRef.current = size;
    }, [size]);

    // Update size height dynamically on window resize (if not custom resized yet)
    useEffect(() => {
        const handleResize = () => {
            if (!isResizing.current) {
                setSize(prev => ({
                    ...prev,
                    height: window.innerHeight - 60
                }));
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Load history when chat is opened
    useEffect(() => {
        if (isOpen && messages.length === 0 && user) {
            api.get('/api/chat/history')
                .then(r => setMessages(r.data.messages || []))
                .catch(err => console.error("Failed to load chat history", err));
        }
    }, [isOpen, user, messages.length]);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, loading]);

    // Draggable Event Handlers
    const handleHeaderMouseDown = (e) => {
        if (e.button !== 0 || e.target.closest('.chat-header-actions')) return;
        isDragging.current = true;
        dragStart.current = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        e.preventDefault();
    };

    const handleMouseMove = (e) => {
        if (!isDragging.current) return;
        const newX = e.clientX - dragStart.current.x;
        const newY = e.clientY - dragStart.current.y;
        setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    // Resizable Event Handlers
    const handleResizeMouseDown = (e, type) => {
        if (e.button !== 0) return;
        isResizing.current = true;
        resizeType.current = type;
        resizeStart.current = {
            width: sizeRef.current.width,
            height: sizeRef.current.height,
            startX: e.clientX,
            startY: e.clientY
        };
        document.addEventListener('mousemove', handleResizeMouseMove);
        document.addEventListener('mouseup', handleResizeMouseUp);
        e.preventDefault();
    };

    const handleResizeMouseMove = (e) => {
        if (!isResizing.current) return;
        const deltaX = e.clientX - resizeStart.current.startX;
        const deltaY = e.clientY - resizeStart.current.startY;
        
        let newWidth = sizeRef.current.width;
        let newHeight = sizeRef.current.height;

        if (resizeType.current === 'left' || resizeType.current === 'top-left') {
            newWidth = Math.max(320, Math.min(800, resizeStart.current.width - deltaX));
        }
        if (resizeType.current === 'top' || resizeType.current === 'top-left') {
            newHeight = Math.max(350, Math.min(window.innerHeight - 60, resizeStart.current.height - deltaY));
        }

        setSize({ width: newWidth, height: newHeight });
    };

    const handleResizeMouseUp = () => {
        isResizing.current = false;
        document.removeEventListener('mousemove', handleResizeMouseMove);
        document.removeEventListener('mouseup', handleResizeMouseUp);
    };

    const handleShareLocation = async (originalMessage) => {
        setMessages(prev => prev.filter(m => !m.isLocationPrompt));
        
        try {
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
            });
            const locationData = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            handleSend(null, originalMessage, locationData);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: '❌ Could not access location. Please try searching by city name.' }]);
        }
    };

    const handleSend = async (e, forcedMessage = null, locationData = null) => {
        if (e) e.preventDefault();
        
        const userMsg = forcedMessage !== null ? forcedMessage : input.trim();
        if (!userMsg || loading) return;

        if (forcedMessage === null) setInput('');

        // Location Check Interception
        const isLocationQuery = /(near me|my location|closest|nearby|around me|nearest)/i.test(userMsg);
        let finalLocation = locationData;
        
        if (isLocationQuery && !finalLocation) {
            try {
                const perm = await navigator.permissions.query({name: 'geolocation'});
                if (perm.state === 'granted') {
                    const pos = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
                    });
                    finalLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
                } else if (perm.state === 'prompt') {
                    if (forcedMessage === null) {
                        setMessages(prev => [...prev, { role: 'user', content: userMsg }, { 
                            role: 'assistant', 
                            isLocationPrompt: true, 
                            originalMessage: userMsg 
                        }]);
                    }
                    return;
                }
            } catch (err) {
                console.log("Geolocation permission query failed:", err);
            }
        }
        
        const newMessages = forcedMessage !== null ? messages : [...messages, { role: 'user', content: userMsg }];
        if (forcedMessage === null) setMessages(newMessages);
        
        setLoading(true);

        try {
            const token = localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000'}/api/chat/stream`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    message: userMsg,
                    route: location.pathname,
                    location: finalLocation
                })
            });

            if (response.status === 429) {
                setMessages([...newMessages, { role: 'assistant', content: '⚠️ You are sending messages too fast. Please slow down.' }]);
                setLoading(false);
                return;
            }

            if (!response.ok) {
                throw new Error("Network response was not ok");
            }

            setLoading(false);
            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let assistantMessage = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.replace('data: ', '').trim();
                        if (dataStr === '[DONE]') break;
                        if (!dataStr) continue;
                        
                        try {
                            const data = JSON.parse(dataStr);
                            if (data.error) {
                                assistantMessage += `\n*Error: ${data.error}*`;
                            } else if (data.content) {
                                assistantMessage += data.content;
                            }
                            
                            setMessages(prev => {
                                const newArr = [...prev];
                                newArr[newArr.length - 1] = { role: 'assistant', content: assistantMessage };
                                return newArr;
                            });
                        } catch (e) {
                            console.error("Error parsing stream chunk", e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Chat error", error);
            setMessages([...newMessages, { role: 'assistant', content: '⚠️ Sorry, I encountered an error. Please try again.' }]);
            setLoading(false);
        }
    };

    const clearHistory = async () => {
        try {
            if (user) {
                await api.delete('/api/chat/history');
            }
            setMessages([]);
        } catch (error) {
            console.error("Failed to clear history", error);
        }
    };

    return (
        <div className="chatbot-container">
            {/* Expanded Chat Panel */}
            <div 
                className={`chat-panel ${isOpen ? 'open' : ''}`}
                style={{
                    width: `${size.width}px`,
                    height: `${size.height}px`,
                    transform: `translate(${position.x}px, ${position.y}px)`,
                    bottom: isOpen ? '24px' : '0'
                }}
            >
                {/* Resize Handles */}
                {isOpen && (
                    <>
                        <div 
                            className="resize-handle resize-handle-l" 
                            onMouseDown={(e) => handleResizeMouseDown(e, 'left')}
                        />
                        <div 
                            className="resize-handle resize-handle-t" 
                            onMouseDown={(e) => handleResizeMouseDown(e, 'top')}
                        />
                        <div 
                            className="resize-handle resize-handle-tl" 
                            onMouseDown={(e) => handleResizeMouseDown(e, 'top-left')}
                        />
                    </>
                )}

                <div 
                    className={`chat-header ${user?.role || 'visitor'}`}
                    onMouseDown={handleHeaderMouseDown}
                    style={{ cursor: 'move' }}
                >
                    <div className="chat-header-info">
                        <i className="fa-solid fa-robot"></i>
                        <span>
                            {user?.role === 'doctor' 
                                ? 'Doctor Assistant' 
                                : user?.role === 'pharmacist' 
                                    ? 'Pharmacist Assistant' 
                                    : user?.role === 'patient'
                                        ? 'Patient Assistant'
                                        : 'HealthTrack Assistant'}
                        </span>
                    </div>
                    <div className="chat-header-actions">
                        <button className="icon-btn" onClick={clearHistory} title="Clear Chat">
                            <i className="fa-solid fa-trash-can"></i>
                        </button>
                        <button className="icon-btn" onClick={() => setIsOpen(false)} title="Close">
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <div className="chat-messages">
                    {messages.length === 0 && !loading && (
                        <div className="chat-empty">
                            <div className="chat-empty-icon">
                                <i className="fa-solid fa-robot"></i>
                            </div>
                            <div className="chat-empty-title">
                                Hi {user ? user.name : 'there'}!
                            </div>
                            <div className="chat-empty-desc">
                                How can I assist you with your health or workflow needs today?
                            </div>
                        </div>
                    )}
                    
                    {messages.map((msg, index) => (
                        <div key={index} className={`chat-message ${msg.role}`}>
                            <div className="msg-bubble">
                                {msg.isLocationPrompt ? (
                                    <div className="location-prompt">
                                        <p style={{ margin: '0 0 10px 0' }}>It looks like you're searching for nearby hospitals. Please share your location for accurate results:</p>
                                        <button 
                                            className="btn btn-primary" 
                                            onClick={() => handleShareLocation(msg.originalMessage)}
                                            style={{ fontSize: '14px', padding: '8px 12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                        >
                                            <i className="fa-solid fa-location-dot"></i> Share My Location
                                        </button>
                                    </div>
                                ) : msg.role === 'assistant' ? (
                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                ) : (
                                    msg.content
                                )}
                            </div>
                        </div>
                    ))}
                    
                    {loading && (
                        <div className="chat-message assistant">
                            <div className="msg-bubble typing">
                                <div className="dot"></div>
                                <div className="dot"></div>
                                <div className="dot"></div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <form className="chat-input-area" onSubmit={handleSend}>
                    <input 
                        type="text" 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your message..."
                        disabled={loading}
                    />
                    <button type="submit" disabled={!input.trim() || loading}>
                        <i className="fa-solid fa-paper-plane"></i>
                    </button>
                </form>
            </div>

            {/* Bubble Button */}
            {!isOpen && (
                <button 
                    className="chat-bubble-btn"
                    onClick={() => setIsOpen(true)}
                >
                    <i className="fa-solid fa-comment-dots"></i>
                </button>
            )}
        </div>
    );
};

export default ChatBubble;
