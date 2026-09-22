import {
    useEffect,
    useRef,
    useState,
} from "react";

import {
    MessageCircle,
    Sparkles,
    RotateCcw,
} from "lucide-react";

import Navbar
    from "./components/Navbar";

import Sidebar
    from "./components/Sidebar";

import ChatMessage
    from "./components/ChatMessage";

import TypingIndicator
    from "./components/TypingIndicator";

import ImageUploadModal
    from "./components/ImageUploadModal";

import {
    sendMessage,
    searchByImage,
    checkHealth,
} from "./services/api";


// ============================================================
// WELCOME MESSAGE
// ============================================================

const welcomeMessage = {
    role: "assistant",

    content:
        "Hi! I'm ShopAI 👋\n\n" +
        "Tell me what you're looking for " +
        "and I'll search the store, compare " +
        "ratings, and help you choose the " +
        "right product.\n\n" +
        "You can also upload a product image " +
        "and I'll find similar items.",
};


// ============================================================
// APP
// ============================================================

function App() {

    // ========================================================
    // STATE
    // ========================================================

    const  [messages , setmessages] = 
userstate([]);
    const[input, setinput] = useState("");    

   const [setSessioId, setSessionId] = 
usestate(
    localStorage.getItem("session_Id") ||
""    
 );   


    const [
        loading,
        setLoading,
    ] = useState(false);


    const [
        connected,
        setConnected,
    ] = useState(false);


    const [
        showImageModal,
        setShowImageModal,
    ] = useState(false);


    // ========================================================
    // REFERENCES
    // ========================================================

    const messagesEndRef =
        useRef(null);


    const inputRef =
        useRef(null);


    // ========================================================
    // BACKEND HEALTH CHECK
    // ========================================================

    useEffect(() => {

        const checkBackend =
            async () => {

                try {

                    const data =
                        await checkHealth();

                    setConnected(
                        data?.status === "ok"
                    );

                } catch (error) {

                    console.error(
                        "Health check failed:",
                        error
                    );

                    setConnected(false);
                }
            };


        // Check immediately
        checkBackend();


        // Check every 30 seconds
        const interval =
            setInterval(
                checkBackend,
                30000
            );


        return () =>
            clearInterval(interval);

    }, []);


    // ========================================================
    // SCROLL TO LATEST MESSAGE
    // ========================================================

    useEffect(() => {

        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth",
        });

    }, [
        messages,
        loading,
    ]);


    // ========================================================
    // ADD MESSAGE
    // ========================================================

    const addMessage = (
        role,
        content,
        extra = {}
    ) => {

        setMessages(
            (previous) => [

                ...previous,

                {
                    role,
                    content,
                    ...extra,
                },

            ]
        );
    };


    // ========================================================
    // BUILD CHAT HISTORY
    // ========================================================

    const getConversationHistory = (
        currentMessages
    ) => {

        return currentMessages
            .filter(
                (message) =>
                    message.role === "user" ||
                    message.role === "assistant"
            )
            .filter(
                (message) =>
                    message.content &&
                    message.content.trim()
            )
            .map(
                (message) => ({
                    role: message.role,
                    content: message.content,
                })
            );
    };


    // ========================================================
    // SEND CHAT MESSAGE
    // ========================================================

    const handleSend = async (
        customMessage = null
    ) => {

        const message = (
            customMessage ?? input
        ).trim();


        // Stop empty messages
        if (
            !message ||
            loading
        ) {

            return;
        }


        // ----------------------------------------------------
        // CREATE USER MESSAGE
        // ----------------------------------------------------

        const userMessage = {
            role: "user",
            content: message,
        };


        // ----------------------------------------------------
        // CREATE HISTORY BEFORE STATE UPDATE
        // ----------------------------------------------------
        //
        // This is important.
        //
        // React state updates are asynchronous, so we cannot
        // depend on `messages` immediately after setMessages().
        //
        // Instead, create the complete history here.
        // ----------------------------------------------------

        const conversationHistory =
            getConversationHistory(
                messages
            );


        const updatedHistory = [
            ...conversationHistory,
            userMessage,
        ];


        // ----------------------------------------------------
        // CLEAR INPUT
        // ----------------------------------------------------

        setInput("");


        // ----------------------------------------------------
        // SHOW USER MESSAGE
        // ----------------------------------------------------

        setMessages(
            (previous) => [
                ...previous,
                userMessage,
            ]
        );


        // ----------------------------------------------------
        // START LOADING
        // ----------------------------------------------------

        setLoading(true);


        try {

            // ------------------------------------------------
            // SEND MESSAGE + FULL HISTORY
            // ------------------------------------------------

            const data =
                await sendMessage(
                    message,
                    updatedHistory
                );


            console.log(
                "ShopAI response:",
                data
            );


            // ------------------------------------------------
            // BACKEND ERROR
            // ------------------------------------------------

            if (
                data?.success === false
            ) {

                throw new Error(
                    data?.response ||
                    "Shopping agent returned an error."
                );
            }


            // ------------------------------------------------
            // GET RESPONSE
            // ------------------------------------------------

            const assistantResponse =
                (
                    data?.response ||
                    ""
                ).trim();


            // ------------------------------------------------
            // HANDLE EMPTY RESPONSE
            // ------------------------------------------------

            if (!assistantResponse) {

                throw new Error(
                    "The shopping assistant returned an empty response."
                );
            }


            // ------------------------------------------------
            // DISPLAY AI RESPONSE
            // ------------------------------------------------

            const assistantMessage = {
                role: "assistant",
                content: assistantResponse,
            };


            setMessages(
                (previous) => [
                    ...previous,
                    assistantMessage,
                ]
            );


            // Backend successfully responded
            setConnected(true);


        } catch (error) {

            console.error(
                "Chat error:",
                error
            );


            // ------------------------------------------------
            // SHOW ACTUAL ERROR
            // ------------------------------------------------

            const errorMessage = {
                role: "assistant",

                content:
                    `ShopAI error: ${
                        error?.message ||
                        "Something went wrong."
                    }`,
            };


            setMessages(
                (previous) => [
                    ...previous,
                    errorMessage,
                ]
            );


            // ------------------------------------------------
            // IMPORTANT
            // ------------------------------------------------
            //
            // A failed AI request does NOT automatically mean
            // that FastAPI is offline.
            // ------------------------------------------------

            setConnected(true);

        } finally {

            setLoading(false);


            setTimeout(() => {

                inputRef.current?.focus();

            }, 100);

        }

    };


    // ========================================================
    // IMAGE SEARCH
    // ========================================================

    const handleImageUpload =
        async (file) => {

        if (
            !file ||
            loading
        ) {

            return;
        }


        // ----------------------------------------------------
        // CLOSE MODAL
        // ----------------------------------------------------

        setShowImageModal(false);


        // ----------------------------------------------------
        // SHOW UPLOAD MESSAGE
        // ----------------------------------------------------

        const userImageMessage = {
            role: "user",

            content:
                "Searching for similar products...",

            imageName:
                file.name,
        };


        setMessages(
            (previous) => [
                ...previous,
                userImageMessage,
            ]
        );


        // ----------------------------------------------------
        // START LOADING
        // ----------------------------------------------------

        setLoading(true);


        try {

            const data =
                await searchByImage(
                    file
                );


            console.log(
                "ShopAI image response:",
                data
            );


            // ------------------------------------------------
            // BACKEND ERROR
            // ------------------------------------------------

            if (
                data?.success === false
            ) {

                throw new Error(
                    data?.response ||
                    "Image search failed."
                );
            }


            // ------------------------------------------------
            // GET RESPONSE
            // ------------------------------------------------

            const assistantResponse =
                (
                    data?.response ||
                    ""
                ).trim();


            if (!assistantResponse) {

                throw new Error(
                    "The image search returned an empty response."
                );
            }


            // ------------------------------------------------
            // DISPLAY RESPONSE
            // ------------------------------------------------

            setMessages(
                (previous) => [

                    ...previous,

                    {
                        role: "assistant",
                        content: assistantResponse,
                    },

                ]
            );


            setConnected(true);


        } catch (error) {

            console.error(
                "Image search error:",
                error
            );


            setMessages(
                (previous) => [

                    ...previous,

                    {
                        role: "assistant",

                        content:
                            `Image search error: ${
                                error?.message ||
                                "Something went wrong."
                            }`,
                    },

                ]
            );


            setConnected(true);


        } finally {

            setLoading(false);

        }

    };


    // ========================================================
    // NEW CONVERSATION
    // ========================================================

    const clearConversation =
        () => {

        if (loading) {

            return;
        }


        setMessages([
            welcomeMessage,
        ]);


        setInput("");

        setTimeout(() => {

            inputRef.current?.focus();

        }, 100);

    };


    // ========================================================
    // KEYBOARD HANDLER
    // ========================================================

    const handleKeyDown =
        (event) => {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            handleSend();
        }

    };


    // ========================================================
    // UI
    // ========================================================

    return (

        <div className="app-shell">


            {/* =================================================
                NAVBAR
            ================================================= */}

            <Navbar
                connected={
                    connected
                }
            />


            {/* =================================================
                APPLICATION BODY
            ================================================= */}

            <div className="app-body">


                {/* =================================================
                    SIDEBAR
                ================================================= */}

                <Sidebar

                    onImageClick={() =>
                        setShowImageModal(
                            true
                        )
                    }


                    onSuggestion={(
                        text
                    ) =>
                        handleSend(
                            text
                        )
                    }

                />


                {/* =================================================
                    CHAT PANEL
                ================================================= */}

                <main className="chat-panel">


                    {/* =================================================
                        CHAT HEADER
                    ================================================= */}

                    <div className="chat-header">


                        <div className="chat-header-left">


                            <div className="chat-header-icon">

                                <MessageCircle
                                    size={19}
                                />

                            </div>


                            <div>

                                <h2>
                                    AI Shopping Assistant
                                </h2>

                                <p>
                                    Search. Compare.
                                    Shop smarter.
                                </p>

                            </div>

                        </div>


                        {/* =================================================
                            NEW CHAT
                        ================================================= */}

                        <button

                            className="new-chat-button"

                            onClick={
                                clearConversation
                            }

                            disabled={
                                loading
                            }

                        >

                            <RotateCcw
                                size={14}
                            />

                            New chat

                        </button>

                    </div>


                    {/* =================================================
                        MESSAGES
                    ================================================= */}

                    <section
                        className="messages-area"
                    >

                        <div
                            className="messages-inner"
                        >

                            {messages.map(
                                (
                                    message,
                                    index
                                ) => (

                                    <ChatMessage
                                        key={
                                            index
                                        }

                                        message={
                                            message
                                        }
                                    />

                                )
                            )}


                            {/* =================================================
                                TYPING INDICATOR
                            ================================================= */}

                            {loading && (

                                <TypingIndicator />

                            )}


                            <div
                                ref={
                                    messagesEndRef
                                }
                            />

                        </div>

                    </section>


                    {/* =================================================
                        MESSAGE COMPOSER
                    ================================================= */}

                    <div className="composer-wrapper">


                        <div className="composer">


                            <button
                                className="composer-ai-icon"
                                type="button"
                                aria-label="AI assistant"
                            >

                                <Sparkles
                                    size={17}
                                />

                            </button>


                            <textarea

                                ref={
                                    inputRef
                                }

                                value={
                                    input
                                }

                                onChange={(
                                    event
                                ) =>
                                    setInput(
                                        event.target.value
                                    )
                                }

                                onKeyDown={
                                    handleKeyDown
                                }

                                placeholder="Ask ShopAI to find a product..."

                                rows={1}

                                disabled={
                                    loading
                                }

                            />


                            <button

                                className="send-button"

                                onClick={() =>
                                    handleSend()
                                }

                                disabled={
                                    loading ||
                                    !input.trim()
                                }

                                type="button"

                                aria-label="Send message"

                            >

                                <svg

                                    width="17"
                                    height="17"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"

                                >

                                    <path
                                        d="M22 2L11 13"
                                    />

                                    <path
                                        d="M22 2L15 22L11 13L2 9L22 2Z"
                                    />

                                </svg>

                            </button>

                        </div>


                        <p className="composer-disclaimer">

                            ShopAI uses AI to help
                            you discover products.
                            Always review product
                            details before ordering.

                        </p>

                    </div>

                </main>

            </div>


            {/* =================================================
                IMAGE UPLOAD MODAL
            ================================================= */}

            {showImageModal && (

                <ImageUploadModal

                    onClose={() =>
                        setShowImageModal(
                            false
                        )
                    }

                    onUpload={
                        handleImageUpload
                    }

                    loading={
                        loading
                    }

                />

            )}

        </div>
    );
}


export default App;