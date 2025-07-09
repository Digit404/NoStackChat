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
}

class Message {
    static messagesContainer = dom.messagesDiv;
    static ticker = 0;

    constructor(text, type = 'user', pending = false) {
        this.id = Message.ticker++;
        this.text = text;
        this.type = type;
        this.pending = pending;
        this.element = this.createElement();
    }

    createElement() {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${this.type}`;
        if (this.pending) {
            messageDiv.innerHTML = '<div class="pending-bar"></div><div class="pending-bar"></div><div class="pending-bar"></div>';
            messageDiv.classList.add('pending');
        } else {
            messageDiv.innerText = this.text;
        }
        return messageDiv;
    }

    addMessageElement() {
        Message.messagesContainer.insertBefore(this.element, dom.endSpacer);
        dom.messagesViewport.scrollTop = dom.messagesViewport.scrollHeight;
    }
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

    console.log('sending', prompt);

    dom.mainDiv.classList.add('chat');

    conversation.newMessage(prompt, 'user');
    conversation.newMessage('', 'bot', true);
});

const conversation = new Conversation();
