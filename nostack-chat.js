const dom = {
    mainDiv: document.getElementById('main'),
    messagesDiv: document.getElementById('messages'),
    messagesViewport: document.getElementById('messages-viewport'),

    promptInput: document.getElementById('prompt'),
    sendButton: document.getElementById('send'),
    addButton: document.getElementById('add'),

    apiKeyBlock: document.getElementById('key-block'),
    apiKeyInput: document.getElementById('api-key'),
    apiKeyButton: document.getElementById('key-button'),
    verifyButton: document.getElementById('verify-button'),

    newChatButton: document.getElementById('new-chat-button'),

    popup: document.getElementById('popup'),

    modelSelect: document.getElementById('model-select'),
    currentModel: document.getElementById('current-model'),
    modelPopup: document.getElementById('model-popup'),
    modelList: document.getElementById('model-list'),
};

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const md = window.markdownit();

class Model {
    static models = [];
    static currentModel = null;
    static defaultModel = 'gpt-4o';

    constructor(data) {
        this.id = data.id;
        this.provider = data.provider;
        this.name = data.name;
        this.description = data.description;
        this.icon = data.icon;
        this.color = data.color;
        this.type = data.type || 'standard';
        this.capabilities = data.capabilities || [];
    }

    createPopupItem() {
        const item = document.createElement('div');
        item.className = 'model-item';
        item.title = this.description;

        const icon = document.createElement('img');
        icon.src = this.icon;
        icon.alt = this.name;
        icon.className = 'model-icon';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'model-name';
        nameDiv.innerText = this.name;

        const infoIcon = document.createElement('span');
        infoIcon.className = 'icon model-info-icon';
        infoIcon.innerText = 'info';

        infoIcon.addEventListener('mouseover', (e) => {
            this.createInfoPopup(e.clientX, e.clientY);
        });

        item.appendChild(icon);
        item.appendChild(nameDiv);
        item.appendChild(infoIcon);

        item.addEventListener('click', () => {
            Model.setCurrentModel(this.id);
            dom.modelPopup.classList.add('hidden');
        });

        return item;
    }

    createInfoPopup(x, y) {
        const infoPopup = document.createElement('div');
        infoPopup.className = 'model-info-popup';

        const title = document.createElement('h3');
        title.className = 'model-info-title';
        title.innerText = this.name;

        const description = document.createElement('p');
        description.className = 'model-info-description';
        description.innerText = this.description;

        const provider = document.createElement('p');
        provider.className = 'model-info-provider';
        provider.innerHTML = `<strong>Provider:</strong> ${this.provider}`;

        infoPopup.appendChild(title);
        infoPopup.appendChild(description);
        infoPopup.appendChild(provider);

        // position over mouse cursor
        infoPopup.style.left = `${x - 10}px`;
        infoPopup.style.top = `${y - 10}px`;

        infoPopup.addEventListener('mouseleave', () => {
            infoPopup.remove();
        }, { once: true });
        
        document.body.appendChild(infoPopup);
    }

    static async loadModels() {
        try {
            const response = await fetch('/known_models.json');
            const modelsData = await response.json();
            Model.models = modelsData.map((data) => new Model(data));
        } catch (error) {
            console.error('Failed to load models:', error);
        }

        // set default model if not already set
        if (!Model.currentModel) {
            const defaultModel = Model.models.find((m) => m.id === Model.defaultModel);
            if (defaultModel) {
                Model.setCurrentModel(defaultModel.id);
            } else {
                console.warn(`Default model ${Model.defaultModel} not found.`);
            }
        }
    }

    static buildPopup() {
        const types = Model.models.reduce((acc, model) => {
            if (!acc.includes(model.type)) {
                acc.push(model.type);
            }
            return acc;
        }, []);

        dom.modelPopup.innerHTML = ''; // clear existing content

        types.forEach((type) => {
            const typeSection = document.createElement('div');
            typeSection.className = 'model-list-section';
            typeSection.innerHTML = `<h2>${type.charAt(0).toUpperCase() + type.slice(1)}</h2>`;
            const typeList = document.createElement('div');
            typeList.className = 'model-list';
            typeSection.appendChild(typeList);
            dom.modelPopup.appendChild(typeSection);
            Model.models
                .filter((model) => model.type === type)
                .forEach((model) => {
                    typeList.appendChild(model.createPopupItem());
                });
        });

        dom.modelSelect.addEventListener('click', (e) => {
            e.stopPropagation();
            dom.modelPopup.classList.toggle('hidden');

            // click outside to close
            document.addEventListener(
                'click',
                (event) => {
                    if (!dom.modelPopup.contains(event.target) && !dom.modelSelect.contains(event.target)) {
                        dom.modelPopup.classList.add('hidden');
                    }
                },
                { once: true }
            );
        });
    }

    static setCurrentModel(modelId) {
        const model = Model.models.find((m) => m.id === modelId);
        if (model) {
            Model.currentModel = model;
            dom.currentModel.innerText = model.name;
            dom.modelSelect.querySelector('.model-icon').src = model.icon;
        } else {
            console.warn(`Model with id ${modelId} not found.`);
        }
    }

    static getCurrentModel() {
        if (!Model.currentModel) {
            console.warn('No current model set. Returning default model.');
            return Model.models.find((m) => m.id === Model.defaultModel);
        }
        return Model.currentModel;
    }
}

class Conversation {
    constructor() {
        this.messages = [];
    }

    newMessage(text, type = 'user', pending = false) {
        const message = new Message(text, type, pending);
        this.messages.push(message);

        const view = new MessageView(message, dom.messagesDiv, this);
        message.view = view;

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
        } else {
            console.warn(`Message with id ${id} not found.`);
        }
    }

    deleteMessagesAfter(messageId) {
        const index = this.messages.findIndex((msg) => msg.id === messageId);
        if (index !== -1) {
            for (let i = index + 1; i < this.messages.length; i++) {
                if (this.messages[i].view) {
                    this.messages[i].view.remove();
                }
            }
            this.messages.splice(index + 1);
        }
    }
}

class Message {
    static ticker = 0;

    constructor(text, type = 'user', pending = false) {
        this.id = Message.ticker++;
        this.text = text;
        this.type = type;
        this.pending = pending;
        this.html = null;
        this.view = null;
        this.updateHtml();
    }

    setText(text) {
        this.text = text;
        this.pending = false;
        this.updateHtml();
        if (this.view) {
            this.view.update();
        }
    }

    setType(type) {
        this.type = type;
        if (this.view) {
            this.view.update();
        }
    }

    setPending(pending = true) {
        this.pending = pending;
        if (this.view) {
            this.view.update();
        }
    }

    remove() {
        if (this.messageContainer && this.messageContainer.parentNode) {
            this.messageContainer.parentNode.removeChild(this.messageContainer);
        }
    }

    updateHtml() {
        this.html = DOMPurify.sanitize(md.render(this.text));
    }
}

class MessageView {
    constructor(message, container, conversation) {
        this.message = message;
        this.container = container;
        this.conversation = conversation;
        this.elements = {};
        this.render();
        this.addToDOM();
    }

    createButton(icon, onClick, className = '') {
        const button = document.createElement('button');
        button.classList = `icon message-button ${className}`;
        button.innerText = icon;
        button.addEventListener('click', onClick);
        return button;
    }

    render() {
        // create container
        const messageContainer = document.createElement('div');
        messageContainer.classList = `message-container ${this.message.type}`;

        // create message div
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${this.message.type}`;
        if (this.message.type === 'user') {
            messageDiv.classList.add('dark');
        }

        // create buttons container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'message-button-container';

        // create standard buttons
        this.elements.editButton = this.createButton('edit', () => this.edit());
        this.elements.saveButton = this.createButton('save', () => this.saveEdit(), 'hidden');
        this.elements.copyButton = this.createButton('content_copy', () => this.copyText());
        this.elements.deleteButton = this.createButton('delete', () => {
            this.conversation.removeMessage(this.message.id);
            this.remove();
        });

        // add buttons to container
        buttonsContainer.appendChild(this.elements.editButton);
        buttonsContainer.appendChild(this.elements.saveButton);

        // add type-specific buttons
        if (this.message.type === 'user') {
            this.elements.resendButton = this.createButton(
                'send',
                () => {
                    this.saveEdit();
                    this.conversation.deleteMessagesAfter(this.message.id);
                    const responseMessage = this.conversation.newMessage('', 'bot');
                    responseMessage.setPending();
                    getResponse(this.conversation);
                },
                'hidden'
            );
            buttonsContainer.appendChild(this.elements.resendButton);
        }

        buttonsContainer.appendChild(this.elements.copyButton);
        buttonsContainer.appendChild(this.elements.deleteButton);

        if (this.message.type === 'bot') {
            this.elements.regenerateButton = this.createButton('refresh', () => {
                this.conversation.deleteMessagesAfter(this.message.id);
                this.message.setPending();
                getResponse(this.conversation);
            });
            buttonsContainer.appendChild(this.elements.regenerateButton);
        }

        // assemble elements
        messageContainer.appendChild(messageDiv);
        messageContainer.appendChild(buttonsContainer);

        this.elements.container = messageContainer;
        this.elements.messageDiv = messageDiv;
        this.elements.buttonsContainer = buttonsContainer;

        this.updateContent();
    }

    updateContent() {
        if (this.message.pending) {
            this.elements.messageDiv.innerHTML = '<div class="pending-bar"></div><div class="pending-bar"></div><div class="pending-bar"></div>';
            this.elements.messageDiv.classList.add('pending');
        } else {
            this.elements.messageDiv.classList.remove('pending');
            this.elements.messageDiv.innerHTML = this.message.html || this.message.text;
            if (window.hljs) {
                hljs.highlightAll();
            }
        }
    }

    update() {
        // update classes
        this.elements.container.classList = `message-container ${this.message.type}`;
        this.elements.messageDiv.classList = `message ${this.message.type}`;
        if (this.message.type === 'user') {
            this.elements.messageDiv.classList.add('dark');
        } else {
            this.elements.messageDiv.classList.remove('dark');
        }

        this.updateContent();
    }

    copyText() {
        if (this.message.pending) {
            return;
        }

        navigator.clipboard
            .writeText(this.message.text)
            .then(() => {
                this.elements.copyButton.innerText = 'check';
                setTimeout(() => {
                    this.elements.copyButton.innerText = 'content_copy';
                }, 2000);
            })
            .catch((err) => {
                console.error('Failed to copy text: ', err);
                this.elements.copyButton.innerText = 'error';
                setTimeout(() => {
                    this.elements.copyButton.innerText = 'content_copy';
                }, 2000);
            });
    }

    edit() {
        if (this.message.pending) {
            return;
        }

        this.elements.container.classList.add('editing');
        this.elements.messageDiv.innerText = this.message.text;
        this.elements.messageDiv.contentEditable = 'true';
        this.elements.messageDiv.focus();
        this.elements.saveButton.classList.remove('hidden');
        this.elements.editButton.classList.add('hidden');
        if (this.elements.resendButton) {
            this.elements.resendButton.classList.remove('hidden');
        }

        // move cursor to end of text
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(this.elements.messageDiv);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    saveEdit() {
        if (!this.elements.container.classList.contains('editing')) {
            return;
        }

        const newText = this.elements.messageDiv.innerHTML
            .replace(/<div>/gi, '\n')
            .replace(/<\/div>/gi, '')
            .replace(/<br>/gi, '\n')
            .trim();

        this.message.setText(newText);
        this.elements.container.classList.remove('editing');
        this.elements.messageDiv.contentEditable = 'false';
        this.elements.messageDiv.blur();
        this.elements.saveButton.classList.add('hidden');
        this.elements.editButton.classList.remove('hidden');
        if (this.elements.resendButton) {
            this.elements.resendButton.classList.add('hidden');
        }
    }

    remove() {
        if (this.elements.container && this.elements.container.parentNode) {
            this.elements.container.parentNode.removeChild(this.elements.container);
        }
    }

    addToDOM() {
        this.container.appendChild(this.elements.container);
        window.scrollTo(0, document.body.scrollHeight);
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
        model: Model.getCurrentModel().id,
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

    // stream updates
    const messageElement = botMessage.view.elements.messageDiv;
    messageElement.classList.remove('pending');
    messageElement.innerHTML = '';

    let lastRender = 0;
    let scheduled = false;

    function scheduleRender(force = false) {
        const now = Date.now();
        if (force || now - lastRender > 60) {
            messageElement.innerHTML = DOMPurify.sanitize(md.render(rawOutput));
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
    }).then(() => {
        window.scrollTo(0, document.body.scrollHeight);
    });
}

dom.apiKeyButton.addEventListener('click', () => {
    dom.apiKeyBlock.classList.toggle('collapsed');
});

dom.newChatButton.addEventListener('click', (e) => {
    e.preventDefault();
    dom.mainDiv.classList.remove('chat');
    dom.messagesDiv.innerHTML = '';
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

Model.loadModels().then(() => {
    Model.buildPopup(dom.modelSelect);
    Model.setCurrentModel(Model.defaultModel);
});
