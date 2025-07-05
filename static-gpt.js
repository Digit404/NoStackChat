const mainDiv = document.getElementById('main');
const messagesDiv = document.getElementById('messages');
const messagesViewport = document.getElementById('messages-viewport');
const endSpacer = document.getElementById('end-spacer');

const promptInput = document.getElementById('prompt');
const sendButton = document.getElementById('send');
const addButton = document.getElementById('add');

const apiKeyBlock = document.getElementById('key-block');
const apiKeyInput = document.getElementById('api-key');
const apiKeyButton = document.getElementById('key-button');
const verifyButton = document.getElementById('verify-button');

class Message {
    static messagesContainer = messagesDiv;
    static messages = [];

    constructor(text, type = 'user', pending = false) {
        this.text = text;
        this.type = type;
        this.pending = pending;
        this.element = this.createElement();
        Message.messages.push(this);
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
        Message.messagesContainer.insertBefore(this.element, endSpacer);
        messagesViewport.scrollTop = messagesViewport.scrollHeight;
    }
}

apiKeyButton.addEventListener('click', () => {
    apiKeyBlock.classList.toggle('collapsed');
});

// resize prompt field on input
promptInput.addEventListener('input', () => {
    promptInput.style.height = 'auto';
    promptInput.style.height = `${promptInput.scrollHeight}px`;
});

// send on enter key press
promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendButton.click();
    }
});

sendButton.addEventListener('click', () => {
    const prompt = promptInput.value.trim();

    if (!prompt) {
        return;
    }

    console.log('sending', prompt);

    mainDiv.classList.add('chat');

    const message = new Message(prompt, 'user');
    message.addMessageElement();

    const response = new Message('', 'bot', true);
    response.addMessageElement();

    messagesViewport.scrollTop = messagesViewport.scrollHeight;
});
