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
const md = window.markdownit();

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
        this.setText(text);
        this.setType(type);
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
            messageDiv.innerHTML = this.html || this.text;
        }

        if (this.type === "user") {
            messageDiv.classList.add('dark');
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

        const deleteButton = document.createElement('button');
        deleteButton.classList = 'icon message-button';
        deleteButton.innerText = 'delete';
        deleteButton.addEventListener('click', () => {
            conversation.removeMessage(this.id);
        });

        messageContainer.appendChild(messageDiv);
        messageContainer.appendChild(copyButton);
        messageContainer.appendChild(deleteButton);

        return messageContainer;
    }

    setText(newText) {
        this.text = newText;
        this.html = DOMPurify.sanitize(md.render(newText));
        if (this.element) {
            const messageDiv = this.element.querySelector('.message');
            messageDiv.classList.remove('pending');
            this.pending = false;
            messageDiv.innerHTML = this.html || this.text;
            if (window.hljs) {
                hljs.highlightAll();
            }
        }
    }

    setType(newType) {
        this.type = newType;
        if (this.element) {
            this.element.classList = `message ${this.type}`;
            const messageDiv = this.element.querySelector('.message');
            messageDiv.classList = `message ${this.type}`;
            if (this.pending) {
                messageDiv.classList.add('pending');
                messageDiv.innerHTML = '<div class="pending-bar"></div><div class="pending-bar"></div><div class="pending-bar"></div>';
            }
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

async function streamOpenAIResponse(conversation, botMessage) {
    const messages = conversation.toAPIFormat();
    const apiKey = dom.apiKeyInput.value.trim();
    if (!apiKey) {
        botMessage.setText('API key is required.');
        botMessage.setType('error');
        return;
    }
    const requestBody = {
        model: 'gpt-4.1',
        messages,
        stream: true,
    };
    let response;
    try {
        response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(requestBody),
        });
    } catch (err) {
        botMessage.setText('API request failed.');
        botMessage.setType('error');
        return;
    }

    if (!response.body) {
        botMessage.setText('Streaming not supported by browser or API');
        botMessage.setType('error');
        return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    let buffer = '';
    let rawOutput = '';
    let done = false;

    const messageDiv = botMessage.element.querySelector('.message');
    messageDiv.classList.remove('pending');
    messageDiv.innerHTML = '';

    let lastRender = 0;
    let scheduled = false;
    function scheduleRender(force = false) {
        const now = Date.now();
        if (force || now - lastRender > 60) {
            messageDiv.innerHTML = DOMPurify.sanitize(md.render(rawOutput));
            lastRender = now;
            if (window.hljs) {
                hljs.highlightAll();
            }
        } else if (!scheduled) {
            scheduled = true;
            setTimeout(() => {
                scheduleRender(true);
                scheduled = false;
            }, 65);
        }
    }

    while (!done) {
        let { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        let lines = buffer.split('\n');

        buffer = lines.pop();

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            if (line === 'data: [DONE]') {
                done = true;
                break;
            }
            if (!line.startsWith('data: ')) continue;
            try {
                const payload = JSON.parse(line.slice(6));
                const content = payload.choices?.[0]?.delta?.content;
                if (content) {
                    rawOutput += content;
                    scheduleRender();
                }
            } catch (err) {
                continue;
            }
        }
    }
    
    scheduleRender(true);

    botMessage.setText(rawOutput);
}

function getResponse(conversation) {
    const botMessage = conversation.getLastMessage();
    streamOpenAIResponse(conversation, botMessage).catch((error) => {
        botMessage.setText('**Error:** ' + error.message);
        botMessage.setType('error');
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

    getResponse(conversation);
});

const conversation = new Conversation();
