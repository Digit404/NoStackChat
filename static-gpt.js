const dom = {
    mainDiv: document.getElementById('main'),
    messagesDiv: document.getElementById('messages'),
    messagesViewport: document.getElementById('messages-viewport'),
    endSpacer: document.getElementById('end-spacer'),

    promptInput: document.getElementById('prompt'),
    sendButton: document.getElementById('send'),
    addButton: document.getElementById('add'),

    apiKeyBlock: document.getElementById('key-block'),
    apiKeyInput: document.getElementById('api-key'),
    apiKeyButton: document.getElementById('key-button'),
    verifyButton: document.getElementById('verify-button'),
};

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

class Conversation {
    constructor() {
        this.messages = [];
    }

    newMessage(text, type = 'user', pending = false) {
        const message = new Message(text, type, pending);
        this.messages.push(message);
        message.addMessageElement();
        return message;
    }

    getLastMessage() {
        return this.messages.length > 0 ? this.messages[this.messages.length - 1] : null;
    }

    toAPIFormat() {
        return this.messages.map((msg) => ({
            role: msg.type === 'user' ? 'user' : 'assistant',
            content: msg.text,
        }));
    }

    removeMessage(id) {
        const index = this.messages.findIndex((msg) => msg.id === id);
        if (index !== -1) {
            const message = this.messages[index];
            message.remove();
            this.messages.splice(index, 1);
        }
    }
}

class Message {
    static messagesContainer = dom.messagesDiv;
    static ticker = 0;

    constructor(text, type = 'user', pending = false) {
        this.id = Message.ticker++;
        this.text = text;
        this.type = type;
        this.pending = pending;
        this.element = this.buildElement();
    }

    buildElement() {
        const messageContainer = document.createElement('div');
        messageContainer.classList = `message-container ${this.type}`;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${this.type}`;
        if (this.pending) {
            messageDiv.innerHTML = '<div class="pending-bar"></div><div class="pending-bar"></div><div class="pending-bar"></div>';
            messageDiv.classList.add('pending');
        } else {
            messageDiv.innerText = this.text;
        }

        const copyButton = document.createElement('button');
        copyButton.classList = 'icon message-button';
        copyButton.innerText = 'content_copy';
        copyButton.addEventListener('click', () => {
            navigator.clipboard
                .writeText(this.text)
                .then(() => {
                    copyButton.innerText = 'check';
                    setTimeout(() => {
                        copyButton.innerText = 'content_copy';
                    }, 2000);
                })
                .catch((err) => {
                    console.error('Failed to copy text: ', err);
                    copyButton.innerText = 'error';
                    setTimeout(() => {
                        copyButton.innerText = 'content_copy';
                    }, 2000);
                });
        });

        messageContainer.appendChild(messageDiv);
        messageContainer.appendChild(copyButton);

        return messageContainer;
    }

    setText(newText) {
        this.text = newText;
        if (this.element) {
            const messageDiv = this.element.querySelector('.message');
            messageDiv.classList.remove('pending');
            this.pending = false;
            messageDiv.innerHTML = '';
            messageDiv.innerText = this.text;
        }
    }

    setType(newType) {
        this.type = newType;
        if (this.element) {
            this.element.className = `message ${this.type}`;
        }
    }

    remove() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }

    addMessageElement() {
        Message.messagesContainer.insertBefore(this.element, dom.endSpacer);
        dom.messagesViewport.scrollTop = dom.messagesViewport.scrollHeight;
    }
}

function getRespomse(conversation) {
    const messages = conversation.toAPIFormat();
    const apiKey = dom.apiKeyInput.value.trim();

    if (!apiKey) {
        console.error('API key is required');
        const botMessage = conversation.getLastMessage();
        botMessage.setText('API key is required.');
        botMessage.setType('error');
        return;
    }

    const requestBody = {
        model: 'gpt-4.1',
        messages: messages,
    };

    fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${dom.apiKeyInput.value.trim()}`,
        },
        body: JSON.stringify(requestBody),
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.choices && data.choices.length > 0) {
                const botMessage = conversation.getLastMessage();
                if (botMessage) {
                    botMessage.setText(data.choices[0].message.content);
                    // scroll to the bottom of the messages viewport
                    dom.messagesViewport.scrollTop = dom.messagesViewport.scrollHeight;
                } else {
                    console.error('No last message found in conversation');
                }
            } else {
                console.error('No choices in response:', data);
            }
        })
        .catch((error) => {
            console.error('Error fetching response:', error);
        });
}

dom.apiKeyButton.addEventListener('click', () => {
    dom.apiKeyBlock.classList.toggle('collapsed');
});

// resize prompt field on input
dom.promptInput.addEventListener('input', () => {
    dom.promptInput.style.height = 'auto';
    dom.promptInput.style.height = `${dom.promptInput.scrollHeight}px`;
});

// send on enter key press
dom.promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        dom.sendButton.click();
    }
});

dom.sendButton.addEventListener('click', () => {
    const prompt = dom.promptInput.value.trim();

    if (!prompt) {
        return;
    }

    dom.mainDiv.classList.add('chat');

    const lastMessage = conversation.getLastMessage();

    if (lastMessage && lastMessage.type === 'error') {
        conversation.removeMessage(lastMessage.id);
    }

    conversation.newMessage(prompt, 'user');
    conversation.newMessage('', 'bot', true);

    dom.promptInput.value = '';
    dom.promptInput.style.height = 'auto';

    getRespomse(conversation);
});

const conversation = new Conversation();
