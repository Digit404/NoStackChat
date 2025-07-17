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

    newChatButton: document.getElementById('new-chat-button'),

    popup: document.getElementById('popup'),
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

    constructor(text, type = 'user') {
        this.id = Message.ticker++;
        this.setText(text);
        this.setType(type);
        this.buildElement();
    }

    buildElement() {
        const messageContainer = document.createElement('div');
        messageContainer.classList = `message-container ${this.type}`;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${this.type}`;

        messageDiv.innerHTML = this.html || this.text;

        if (this.type === 'user') {
            messageDiv.classList.add('dark');
        }

        this.copyButton = document.createElement('button');
        this.copyButton.classList = 'icon message-button';
        this.copyButton.innerText = 'content_copy';
        this.copyButton.addEventListener('click', () => {
            this.copyText();
        });

        this.deleteButton = document.createElement('button');
        this.deleteButton.classList = 'icon message-button';
        this.deleteButton.innerText = 'delete';
        this.deleteButton.addEventListener('click', () => {
            conversation.removeMessage(this.id);
        });

        this.editButton = document.createElement('button');
        this.editButton.classList = 'icon message-button';
        this.editButton.innerText = 'edit';
        this.editButton.addEventListener('click', () => {
            this.edit();
        });

        this.saveButton = document.createElement('button');
        this.saveButton.classList = 'icon message-button hidden';
        this.saveButton.innerText = 'save';
        this.saveButton.addEventListener('click', () => {
            this.saveEdit();
        });

        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'message-button-container';

        messageContainer.appendChild(messageDiv);
        messageContainer.appendChild(buttonsContainer);

        buttonsContainer.appendChild(this.editButton);
        buttonsContainer.appendChild(this.saveButton);
        buttonsContainer.appendChild(this.copyButton);
        buttonsContainer.appendChild(this.deleteButton);

        if (this.type === 'bot') {
            this.regenerateButton = document.createElement('button');
            this.regenerateButton.classList = 'icon message-button';
            this.regenerateButton.innerText = 'refresh';
            this.regenerateButton.addEventListener('click', () => {
                // delete all messages after this one
                const index = conversation.messages.findIndex((msg) => msg.id === this.id);
                if (index !== -1) {
                    for (let i = index + 1; i < conversation.messages.length; i++) {
                        conversation.messages[i].remove();
                        conversation.messages.splice(i, 1);
                        i--; // adjust index after removal
                    }
                }

                this.setPending();
                getResponse(conversation);
            });
            buttonsContainer.appendChild(this.regenerateButton);
        } else if (this.type === 'user') {
            this.resendButton = document.createElement('button');
            this.resendButton.classList = 'icon message-button hidden';
            this.resendButton.innerText = 'send';
            this.resendButton.addEventListener('click', () => {
                this.saveEdit();

                // delete all messages after this one
                const index = conversation.messages.findIndex((msg) => msg.id === this.id);
                if (index !== -1) {
                    for (let i = index + 1; i < conversation.messages.length; i++) {
                        conversation.messages[i].remove();
                        conversation.messages.splice(i, 1);
                        i--; // adjust index after removal
                    }
                }

                const responseMessage = conversation.newMessage('', 'bot');
                responseMessage.setPending();
                getResponse(conversation);
            });
            buttonsContainer.insertBefore(this.resendButton, this.copyButton);
        }
        
        this.messageContainer = messageContainer;
        this.messageElement = messageDiv;
    }

    setPending() {
        this.pending = true;
        this.messageElement.innerHTML = '<div class="pending-bar"></div><div class="pending-bar"></div><div class="pending-bar"></div>';
        this.messageElement.classList.add('pending');
    }

    copyText() {
        navigator.clipboard
            .writeText(this.text)
            .then(() => {
                this.copyButton.innerText = 'check';
                setTimeout(() => {
                    this.copyButton.innerText = 'content_copy';
                }, 2000);
            })
            .catch((err) => {
                console.error('Failed to copy text: ', err);
                this.copyButton.innerText = 'error';
                setTimeout(() => {
                    this.copyButton.innerText = 'content_copy';
                }, 2000);
            });
    }

    edit() {
        this.messageContainer.classList.add('editing');
        this.messageElement.innerText = this.text;
        this.messageElement.contentEditable = 'true';
        this.messageElement.focus();
        this.saveButton.classList.remove('hidden');
        this.editButton.classList.add('hidden');
        if (this.resendButton) {
            this.resendButton.classList.remove('hidden');
        }

        // move cursor to end of text
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(this.messageElement);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    saveEdit() {
        if (!this.messageContainer.classList.contains('editing')) {
            return;
        }
        const newText = this.messageElement.innerHTML
            .replace(/<div>/gi, '\n')
            .replace(/<\/div>/gi, '')
            .replace(/<br>/gi, '\n')
            .trim();
        this.setText(newText);
        this.messageContainer.classList.remove('editing');
        this.messageElement.contentEditable = 'false';
        this.messageElement.blur();
        this.saveButton.classList.add('hidden');
        this.editButton.classList.remove('hidden');
        if (this.resendButton) {
            this.resendButton.classList.add('hidden');
        }
    }

    setText(newText) {
        this.text = newText;
        this.html = DOMPurify.sanitize(md.render(newText));
        if (this.messageContainer) {
            this.messageElement.classList.remove('pending');
            this.pending = false;
            this.messageElement.innerHTML = this.html || this.text;
            if (window.hljs) {
                hljs.highlightAll();
            }
        }
    }

    setType(newType) {
        this.type = newType;
        if (this.messageContainer) {
            this.messageContainer.classList = `message ${this.type}`;
            this.messageElement.classList = `message ${this.type}`;
            if (this.pending) {
                this.messageElement.classList.add('pending');
                this.messageElement.innerHTML = '<div class="pending-bar"></div><div class="pending-bar"></div><div class="pending-bar"></div>';
            }
        }
    }

    remove() {
        if (this.messageContainer && this.messageContainer.parentNode) {
            this.messageContainer.parentNode.removeChild(this.messageContainer);
        }
    }

    addMessageElement() {
        Message.messagesContainer.insertBefore(this.messageContainer, dom.endSpacer);
        dom.messagesViewport.scrollTop = dom.messagesViewport.scrollHeight;
    }
}

function hidePopup() {
    dom.popup.classList.add('hidden');
}

if (!localStorage.getItem('notWarnedApiKey')) {
    dom.popup.classList.remove('hidden');
    localStorage.setItem('notWarnedApiKey', '1');
}

document.getElementById('popup-close').onclick = hidePopup;

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

    botMessage.messageElement.classList.remove('pending');
    botMessage.messageElement.innerHTML = '';

    let lastRender = 0;
    let scheduled = false;
    function scheduleRender(force = false) {
        const now = Date.now();
        if (force || now - lastRender > 60) {
            botMessage.messageElement.innerHTML = DOMPurify.sanitize(md.render(rawOutput));
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

dom.newChatButton.addEventListener('click', (e) => {
    e.preventDefault();
    dom.mainDiv.classList.remove('chat');
    dom.messagesDiv.innerHTML = '';
    dom.messagesDiv.appendChild(dom.endSpacer);
    dom.promptInput.value = '';
    dom.promptInput.style.height = 'auto';
    conversation = new Conversation();
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
    const responseMessage = conversation.newMessage('', 'bot');
    responseMessage.setPending();

    dom.promptInput.value = '';
    dom.promptInput.style.height = 'auto';

    getResponse(conversation);
});

let conversation = new Conversation();
