document.addEventListener('DOMContentLoaded', function() {
    // DOM Element Selectors
    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('messageInput');
    const messagesArea = document.getElementById('messagesArea');
    const newChatBtn = document.getElementById('newChatBtn');
    const chatHistory = document.getElementById('chatHistory');
    const sendButton = document.querySelector('.send-btn');
    const chatSearchInput = document.getElementById('chatSearch');
    const clearInputBtn = document.getElementById('clearInputBtn');
    const historyEmptyState = document.getElementById('historyEmptyState');
    const messagesEmptyState = document.getElementById('messagesEmptyState');
    const initiateButton = document.getElementById('initiateButton');


    const mobileMenuBtn = document.createElement('button');
    mobileMenuBtn.className = 'mobile-menu-btn';
    mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
    document.body.appendChild(mobileMenuBtn);


    const sidebar = document.querySelector('.sidebar');

    // Application State
    const STATE = {
        chatCounter: 0,
        currentChatId: null,
        chats: {},
        MAX_MESSAGES_PER_CHAT: 50,
        MAX_INPUT_LENGTH: 1000,
        STORAGE_KEY: 'senthrixChatState'
    };

    // Utility Functions
    const utils = {
        generateId() {
            return `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        },

        sanitizeInput(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML.trim();
        },

        truncateText(text, maxLength = 50) {
            return text.length > maxLength
                ? text.substring(0, maxLength) + '...'
                : text;
        },

        saveState() {
            try {
                localStorage.setItem(STATE.STORAGE_KEY, JSON.stringify({
                    chatCounter: STATE.chatCounter,
                    chats: STATE.chats
                }));
            } catch (error) {
                errorHandler.log('Failed to save state to local storage: ' + error);
            }
        },

        loadState() {
            try {
                const storedState = localStorage.getItem(STATE.STORAGE_KEY);
                if (storedState) {
                    const parsedState = JSON.parse(storedState);
                    STATE.chatCounter = parsedState.chatCounter || 0;
                    STATE.chats = parsedState.chats || {};
                    return true;
                }
                return false;
            } catch (error) {
                errorHandler.log('Failed to load state from local storage: ' + error);
                return false;
            }
        }
    };

    // Error Handling
    const errorHandler = {
        show(message, type = 'error') {
            const errorDiv = document.createElement('div');
            errorDiv.className = `${type}-state`;
            errorDiv.textContent = message;
            messagesArea.appendChild(errorDiv);

            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.parentNode.removeChild(errorDiv);
                }
            }, 3000);
        },

        log(error) {
            console.error('Senthrix Error:', error);
            this.show('An unexpected error occurred');
        }
    };

    // UI Management
    const uiManager = {
        setLoading(isLoading) {
            messageInput.disabled = isLoading;
            sendButton.innerHTML = isLoading
                ? '<i class="fas fa-spinner fa-spin"></i>'
                : '<i class="fas fa-paper-plane"></i>';
            sendButton.disabled = isLoading;
        },

        autoResizeTextarea() {
            messageInput.style.height = 'auto';
            messageInput.style.height = `${messageInput.scrollHeight}px`;

            const maxHeight = parseInt(window.getComputedStyle(messageInput).maxHeight);
            messageInput.style.overflowY =
                messageInput.scrollHeight > maxHeight ? 'auto' : 'hidden';
        },

        updateEmptyStates() {
            const hasChats = Object.keys(STATE.chats).length > 0;
            const hasMessages = STATE.currentChatId &&
                STATE.chats[STATE.currentChatId]?.messages.length > 0;

            historyEmptyState.style.display = hasChats ? 'none' : 'flex';
            messagesEmptyState.style.display = hasMessages ? 'none' : 'flex';
        }
    };

    // Chat Management
    const chatManager = {
        createNewChat(initialTitle = null) {
            try {
                const chatId = utils.generateId();
                const title = initialTitle || `Chat ${STATE.chatCounter + 1}`;
                STATE.chatCounter++;

                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                historyItem.dataset.chatId = chatId;
                historyItem.innerHTML = `
                    <i class="fas fa-message"></i>
                    <span class="chat-title">${utils.truncateText(title)}</span>
                    <i class="fas fa-edit edit-icon" title="Edit chat title"></i>
                    <i class="fas fa-trash delete-icon" title="Delete chat"></i>
                `;

                this.setupHistoryItemListeners(historyItem, chatId);
                chatHistory.appendChild(historyItem);

                STATE.chats[chatId] = {
                    messages: [],
                    title: title,
                    createdAt: new Date().toISOString()
                };

                this.switchChat(chatId);
                uiManager.updateEmptyStates();
                utils.saveState();

                return chatId;
            } catch (error) {
                errorHandler.log(error);
                return null;
            }
        },

        setupHistoryItemListeners(historyItem, chatId) {
            historyItem.addEventListener('click', (e) => {
                const isEditOrDelete =
                    e.target.classList.contains('delete-icon') ||
                    e.target.classList.contains('edit-icon');

                if (!isEditOrDelete) {
                    this.switchChat(chatId);
                }
            });

            const editIcon = historyItem.querySelector('.edit-icon');
            editIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editChatTitle(chatId, historyItem);
            });

            const deleteIcon = historyItem.querySelector('.delete-icon');
            deleteIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteChat(chatId);
            });
        },

        editChatTitle(chatId, historyItem) {
            const titleSpan = historyItem.querySelector('.chat-title');
            const currentTitle = titleSpan.textContent;

            const inputField = document.createElement('input');
            inputField.type = 'text';
            inputField.className = 'edit-title-input';
            inputField.value = currentTitle;

            titleSpan.replaceWith(inputField);
            inputField.focus();
            inputField.select();

            const saveTitle = () => {
                const newTitle = utils.sanitizeInput(inputField.value.trim());
                if (newTitle && newTitle !== currentTitle) {
                    STATE.chats[chatId].title = newTitle;
                    titleSpan.textContent = utils.truncateText(newTitle);
                    utils.saveState();
                }
                inputField.replaceWith(titleSpan);
            };

            inputField.addEventListener('blur', saveTitle);
            inputField.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') saveTitle();
            });
        },

        deleteChat(chatId) {
            if (Object.keys(STATE.chats).length <= 1) {
                errorHandler.show('Cannot delete the last chat', 'warning');
                return;
            }

            const historyItem = document.querySelector(
                `.history-item[data-chat-id="${chatId}"]`
            );

            if (historyItem) historyItem.remove();
            delete STATE.chats[chatId];

            if (STATE.currentChatId === chatId) {
                const remainingChats = Object.keys(STATE.chats);
                this.switchChat(remainingChats[0]);
            }

            uiManager.updateEmptyStates();
            utils.saveState();
        },

        switchChat(chatId) {
            if (!STATE.chats[chatId]) return;

            // Save current chat's messages
            if (STATE.currentChatId) {
                STATE.chats[STATE.currentChatId].messages =
                    Array.from(messagesArea.children)
                        .filter(el => el.classList.contains('message'))
                        .map(msg => ({
                            text: msg.textContent,
                            isUser: msg.classList.contains('user-message')
                        }));
            }


            // Clear messages and update state
            messagesArea.innerHTML = '';
            STATE.currentChatId = chatId;

            // Restore chat messages
            const currentChat = STATE.chats[chatId];
            currentChat.messages.forEach(msg =>
                this.addMessage(msg.text, msg.isUser)
            );

            // Update sidebar active state
            document.querySelectorAll('.history-item')
                .forEach(item => {
                    item.classList.remove('active');
                    if (item.dataset.chatId === chatId) {
                        item.classList.add('active');
                    }
                });

            messageInput.value = '';
            uiManager.autoResizeTextarea();
            uiManager.updateEmptyStates();
        },

       addMessage(text, isUser) {
           
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
             messageDiv.innerHTML = text;


            messagesArea.appendChild(messageDiv);
            messagesArea.scrollTop = messagesArea.scrollHeight;

            // Limit messages per chat
            if (STATE.currentChatId) {
                const currentChat = STATE.chats[STATE.currentChatId];
                if (currentChat.messages.length >= STATE.MAX_MESSAGES_PER_CHAT) {
                    currentChat.messages.shift();
                }
            }
        }
    };

    // Bot Simulation
    const botResponder = {
        responses: [
            "Hello! How can I help you today?",
            "Interesting. Tell me more.",
            "I'm listening...",
            "That's an intriguing point.",
            "Is there anything specific you'd like to discuss?",
            "I see...",
            "How fascinating!",
            "Understood.",
            "I'm processing that...",
            "Let me think about that."
        ],

        generateResponse(userMessage) {
             const link = '<a href="https://craftedcodex.vercel.app/" target="_blank" style="color: #00d2ff; font-weight: bold; text-decoration: underline;">CraftedCodeX</a>';
             return `I am still being trained.\n\nMy abilities are limited at the moment.\n\nThank you for your patience. Till then explore ${link}`;
        },

        simulate(userMessage) {
            const typingIndicator = document.createElement('div');
            typingIndicator.className = 'message bot-message typing-indicator';
            typingIndicator.innerHTML =
                '<div class="dots"><span></span><span></span><span></span></div>';

            messagesArea.appendChild(typingIndicator);
            messagesArea.scrollTop = messagesArea.scrollHeight;

            setTimeout(() => {
                messagesArea.removeChild(typingIndicator);
                const botResponse = this.generateResponse(userMessage);
                chatManager.addMessage(botResponse, false);
            }, 1000 + Math.random() * 1500);
        }
    };

    // Event Listeners
    function setupEventListeners() {
        messageForm.addEventListener('submit', handleMessageSubmit);
        messageInput.addEventListener('input', uiManager.autoResizeTextarea);
        messageInput.addEventListener('keypress', handleKeyPress);
        newChatBtn.addEventListener('click', () => chatManager.createNewChat());
        clearInputBtn.addEventListener('click', clearInput);
        chatSearchInput.addEventListener('input', handleChatSearch);


         mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });

        // Close sidebar if clicked outside of it on mobile
         document.addEventListener('click', (event) => {
        if (window.innerWidth <= 768 && !sidebar.contains(event.target) && !mobileMenuBtn.contains(event.target)) {
            sidebar.classList.remove('open');
        }
    });

        // Global error handling
        window.addEventListener('error', (event) => {
            errorHandler.log(event.error);
        });
    }

    function handleMessageSubmit(e) {
        e.preventDefault();
        const message = messageInput.value.trim();

        if (!message || !STATE.currentChatId) return;

        if (message.length > STATE.MAX_INPUT_LENGTH) {
            errorHandler.show('Message too long', 'warning');
            return;
        }

        uiManager.setLoading(true);
        chatManager.addMessage(message, true);
        botResponder.simulate(message);
        messageInput.value = '';
        uiManager.autoResizeTextarea();


        setTimeout(() => {
            uiManager.setLoading(false);
        }, 1500);
    }

    function handleKeyPress(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            messageForm.dispatchEvent(new Event('submit'));
        }
    }

    function clearInput() {
        messageInput.value = '';
        uiManager.autoResizeTextarea();
    }

    function handleChatSearch() {
        const searchTerm = chatSearchInput.value.trim().toLowerCase();
        const historyItems = document.querySelectorAll('.history-item');

        historyItems.forEach(item => {
            const title = item.querySelector('.chat-title')
                .textContent.toLowerCase();

            item.style.display = title.includes(searchTerm) ? '' : 'none';
        });
    }

    function init() {
        setupEventListeners();

          if(initiateButton) {
              initiateButton.addEventListener('click', function(event) {
                   event.preventDefault(); // Prevent form submission
                  window.location.href = 'Senthrix.pdf';
               });
          }

        const hasLoadedState = utils.loadState();

        const chatIds = Object.keys(STATE.chats);
        
        const startChat = () => {
            if(hasLoadedState && chatIds.length > 0){
               chatIds.forEach(chatId => {
                const chat = STATE.chats[chatId];
                 const historyItem = document.createElement('div');
                    historyItem.className = 'history-item';
                    historyItem.dataset.chatId = chatId;
                    historyItem.innerHTML = `
                        <i class="fas fa-message"></i>
                        <span class="chat-title">${utils.truncateText(chat.title)}</span>
                        <i class="fas fa-edit edit-icon" title="Edit chat title"></i>
                        <i class="fas fa-trash delete-icon" title="Delete chat"></i>
                    `;
                  chatManager.setupHistoryItemListeners(historyItem, chatId);
                chatHistory.appendChild(historyItem);
            })
              chatManager.switchChat(chatIds[0])
          } else {
              chatManager.createNewChat();
        }
        }
       
        setTimeout(startChat, 1500);
    }

    // Start the application
    init();
});