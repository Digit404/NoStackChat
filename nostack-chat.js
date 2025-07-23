const dom = {
    mainDiv: document.getElementById('main'),
    messagesDiv: document.getElementById('messages'),
    messagesViewport: document.getElementById('messages-viewport'),

    pendingImagesContainer: document.getElementById('pending-images-container'),
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

    settingsPopup: document.getElementById('settings-popup'),
    settingsButton: document.getElementById('settings-button'),

    systemPromptInput: document.getElementById('system-prompt'),

    temperatureInput: document.getElementById('temperature'),
    temperatureValue: document.getElementById('temperature-value'),

    themeSelect: document.getElementById('theme-select'),
    fontSelect: document.getElementById('font-select'),

    hue: document.getElementById('hue'),
    saturation: document.getElementById('saturation'),

    hueValue: document.getElementById('hue-value'),
    saturationValue: document.getElementById('saturation-value'),
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

        infoPopup.addEventListener(
            'mouseleave',
            () => {
                infoPopup.remove();
            },
            { once: true }
        );

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
        this.generating = false;
        this.abortController = null;
    }

    newMessage(type = 'user', pending = false) {
        const message = new Message(type);
        if (pending) message.setPending();
        this.messages.push(message);

        return message;
    }

    addMessageToDOM(message) {
        const view = new MessageView(message, dom.messagesDiv, this);
        return message;
    }

    getLastMessage() {
        return this.messages.length > 0 ? this.messages[this.messages.length - 1] : null;
    }

    toAPIFormat() {
        const conversation = this.messages.map((msg) => msg.toAPIFormat());
        const systemPrompt = Conversation.getSystemPrompt();
        if (systemPrompt) {
            conversation.unshift(systemPrompt);
        }

        return conversation;
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

    interrupt() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.generating = false;
    }

    static getSystemPrompt() {
        const systemPrompt = dom.systemPromptInput.value.trim() || 'A helpful assistant.';
        if (systemPrompt) {
            return {
                role: 'system',
                content: systemPrompt,
            };
        }
        return null;
    }
}

class Message {
    static ticker = 0;

    constructor(type = 'user') {
        this.id = Message.ticker++;
        this.type = type;
        this.pending = false;
        this.view = null;
        this.content = {
            text: '',
            images: [],
        };
    }

    setText(text) {
        this.content.text = text;
        this.pending = false;
        this.updateView();
    }

    addImage(imageData) {
        this.content.images.push(imageData);
        this.updateView();
    }

    setType(type) {
        this.type = type;
        this.updateView();
    }

    setPending(pending = true) {
        this.pending = pending;
        this.updateView();
    }

    updateView() {
        if (this.view) {
            this.view.update();
        }
    }

    renderContent() {
        if (this.content.text) {
            return DOMPurify.sanitize(md.render(this.content.text));
        }
        return '';
    }

    toAPIFormat() {
        let content = [];

        if (this.content.text) {
            content.push({
                type: 'text',
                text: this.content.text,
            });
        }

        this.content.images.forEach((img) => {
            content.push({
                type: 'image_url',
                image_url: {
                    url: img.src,
                },
            });
        });

        return {
            role: this.type === 'user' ? 'user' : 'assistant',
            content: content.length === 1 && content[0].type === 'text' ? content[0].text : content,
        };
    }

    remove() {
        if (this.view) {
            this.view.remove();
            this.view = null;
        }
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
        this.editing = false;

        this.message.view = this;
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

        const imagesContainer = document.createElement('div');
        imagesContainer.className = 'message-images';

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
        this.elements.cancelEditButton = this.createButton('cancel', () => this.cancelEdit(), 'hidden');
        this.elements.copyButton = this.createButton('content_copy', () => this.copyText());
        this.elements.deleteButton = this.createButton('delete', () => {
            this.conversation.removeMessage(this.message.id);
            this.remove();
        });

        // add buttons to container
        buttonsContainer.appendChild(this.elements.cancelEditButton);
        buttonsContainer.appendChild(this.elements.editButton);
        buttonsContainer.appendChild(this.elements.saveButton);

        // add type-specific buttons
        if (this.message.type === 'user') {
            this.elements.resendButton = this.createButton(
                'send',
                () => {
                    this.saveEdit();
                    this.conversation.deleteMessagesAfter(this.message.id);
                    const responseMessage = this.conversation.newMessage('bot');
                    responseMessage.setPending();
                    this.conversation.addMessageToDOM(responseMessage);
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
        messageContainer.appendChild(imagesContainer);
        messageContainer.appendChild(messageDiv);
        messageContainer.appendChild(buttonsContainer);

        this.elements.container = messageContainer;
        this.elements.messageDiv = messageDiv;
        this.elements.imagesContainer = imagesContainer;
        this.elements.buttonsContainer = buttonsContainer;

        this.updateContent();
    }

    updateContent() {
        // images
        this.elements.imagesContainer.innerHTML = '';
        if (this.message.content.images.length > 0) {
            this.message.content.images.forEach((img) => {
                const imageContainer = document.createElement('div');
                imageContainer.className = 'message-image-container';
                this.elements.imagesContainer.appendChild(imageContainer);
                const imgElement = document.createElement('img');
                imgElement.src = img.src;
                imgElement.alt = 'Uploaded image';
                imgElement.className = 'message-image';
                imageContainer.appendChild(imgElement);
                const removeButton = document.createElement('button');
                removeButton.className = 'icon remove-image-button';
                removeButton.innerText = 'close';
                removeButton.addEventListener('click', () => {
                    const index = this.message.content.images.indexOf(img);
                    if (index !== -1) {
                        this.message.content.images.splice(index, 1);
                        this.updateContent();
                    }
                });
                imageContainer.appendChild(removeButton);
            });

            this.elements.imagesContainer.classList.remove('hidden');
        } else {
            this.elements.imagesContainer.classList.add('hidden');
        }

        // text
        if (this.message.pending) {
            this.elements.messageDiv.innerHTML = '<div class="pending-bar"></div><div class="pending-bar"></div><div class="pending-bar"></div>';
            this.elements.messageDiv.classList.add('pending');
        } else {
            this.elements.messageDiv.classList.remove('pending');
            this.elements.messageDiv.classList.remove('error');

            const textHtml = this.message.content.text ? DOMPurify.sanitize(md.render(this.message.content.text)) : '';
            this.elements.messageDiv.innerHTML = textHtml;

            if (window.hljs) {
                hljs.highlightAll();
            }

            this.addCopyButtons();
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
            .writeText(this.message.content.text)
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

    addCopyButtons() {
        for (const block of this.elements.messageDiv.querySelectorAll('pre:has(code)')) {
            if (block.parentNode.classList.contains('code-wrapper')) {
                continue; // already wrapped
            }

            const wrapper = document.createElement('div');
            wrapper.className = 'code-wrapper';

            block.parentNode.insertBefore(wrapper, block);
            wrapper.appendChild(block);

            const copyButton = document.createElement('button');
            copyButton.className = 'icon button copy-button corner-button';
            copyButton.innerText = 'content_copy';
            wrapper.appendChild(copyButton);

            console.log('Adding copy button to block:', wrapper);

            copyButton.addEventListener('click', () => {
                const codeText = block.innerText || block.textContent;
                navigator.clipboard
                    .writeText(codeText)
                    .then(() => {
                        copyButton.innerText = 'check';
                        setTimeout(() => {
                            copyButton.innerText = 'content_copy';
                        }, 2000);
                    })
                    .catch((err) => {
                        console.error('Failed to copy code: ', err);
                        copyButton.innerText = 'error';
                        setTimeout(() => {
                            copyButton.innerText = 'content_copy';
                        }, 2000);
                    });
            });
        }
    }

    edit() {
        if (this.message.pending) {
            return;
        }

        this.editing = true;
        this.elements.container.classList.add('editing');
        this.elements.messageDiv.innerText = this.message.content.text;
        this.elements.messageDiv.contentEditable = 'true';
        this.elements.messageDiv.focus();
        this.elements.saveButton.classList.remove('hidden');
        this.elements.cancelEditButton.classList.remove('hidden');
        this.elements.editButton.classList.add('hidden');
        this.elements.copyButton.classList.add('hidden');
        this.elements.deleteButton.classList.add('hidden');

        if (this.elements.resendButton) {
            this.elements.resendButton.classList.remove('hidden');
        }

        if (this.elements.regenerateButton) {
            this.elements.regenerateButton.classList.add('hidden');
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
        if (!this.editing) {
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
        this.elements.cancelEditButton.classList.add('hidden');
        this.elements.editButton.classList.remove('hidden');
        this.elements.copyButton.classList.remove('hidden');
        this.elements.deleteButton.classList.remove('hidden');

        if (this.elements.resendButton) {
            this.elements.resendButton.classList.add('hidden');
        }

        if (this.elements.regenerateButton) {
            this.elements.regenerateButton.classList.remove('hidden');
        }

        this.editing = false;
    }

    cancelEdit() {
        if (!this.editing) {
            return;
        }

        this.elements.container.classList.remove('editing');
        this.elements.messageDiv.innerHTML = this.message.renderContent();
        this.elements.messageDiv.contentEditable = 'false';
        this.elements.messageDiv.blur();
        this.elements.saveButton.classList.add('hidden');
        this.elements.cancelEditButton.classList.add('hidden');
        this.elements.editButton.classList.remove('hidden');
        this.elements.copyButton.classList.remove('hidden');
        this.elements.deleteButton.classList.remove('hidden');

        if (this.elements.resendButton) {
            this.elements.resendButton.classList.add('hidden');
        }

        if (this.elements.regenerateButton) {
            this.elements.regenerateButton.classList.remove('hidden');
        }

        this.updateContent();

        this.editing = false;
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

class PendingContent {
    constructor() {
        this.images = [];
        this.container = dom.pendingImagesContainer;
    }

    addImage(imageData) {
        this.images.push(imageData);
        this.updateDisplay();
    }

    clearImages() {
        this.images = [];
        this.updateDisplay();
    }

    updateDisplay() {
        this.container.innerHTML = '';

        if (this.images.length === 0) {
            this.container.style.display = 'none';
            return;
        }

        this.container.style.display = 'flex';

        this.images.forEach((img, index) => {
            const imgContainer = document.createElement('div');
            imgContainer.className = 'pending-image-container';

            const imgElement = document.createElement('img');
            imgElement.src = img.src;
            imgElement.alt = 'Pending image';
            imgElement.className = 'pending-image';

            const removeButton = document.createElement('button');
            removeButton.className = 'icon remove-image-button';
            removeButton.innerText = 'close';
            removeButton.addEventListener('click', () => {
                this.images.splice(index, 1);
                this.updateDisplay();
            });

            imgContainer.appendChild(imgElement);
            imgContainer.appendChild(removeButton);
            this.container.appendChild(imgContainer);
        });
    }

    applyToMessage(message) {
        this.images.forEach((img) => {
            message.addImage(img);
        });
        this.clearImages();
    }
}

function hidePopup() {
    dom.popup.classList.add('hidden');
}

async function streamOpenAIResponse(conversation, botMessage) {
    const messages = conversation.toAPIFormat();
    const apiKey = dom.apiKeyInput.value.trim();

    if (!apiKey) {
        botMessage.setText('API key is required.');
        botMessage.setType('error');
        return;
    }

    conversation.abortController = new AbortController();

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
            signal: conversation.abortController.signal,
        });
    } catch (err) {
        if (err.name === 'AbortError') {
            return;
        }
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

            botMessage.view.addCopyButtons();
        } else if (!scheduled) {
            scheduled = true;
            setTimeout(() => {
                scheduleRender(true);
                scheduled = false;
            }, 65);
        }
    }

    try {
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
    } catch (err) {
        if (err.name !== 'AbortError') {
            throw err;
        }
    }

    scheduleRender(true);

    botMessage.setText(rawOutput);
}

function getResponse(conversation) {
    const botMessage = conversation.getLastMessage();

    conversation.generating = true;
    dom.sendButton.innerText = 'stop';

    streamOpenAIResponse(conversation, botMessage)
        .catch((error) => {
            if (error.name !== 'AbortError') {
                botMessage.setText('**Error:** ' + error.message);
                botMessage.setType('error');
            }
        })
        .then(() => {
            window.scrollTo(0, document.body.scrollHeight);
            conversation.generating = false;
            dom.sendButton.innerText = 'send';
        });
}

function getSavedSettings() {
    const font = localStorage.getItem('font') || 'sans-serif';
    const theme = localStorage.getItem('theme') || 'light';
    const systemPrompt = localStorage.getItem('systemPrompt');
    const hue = localStorage.getItem('hue') || '230';
    const saturation = localStorage.getItem('saturation') || '5';

    dom.fontSelect.value = font;
    dom.themeSelect.value = theme;
    dom.hue.value = hue;
    dom.hueValue.innerText = hue;
    dom.saturation.value = saturation;
    dom.saturationValue.innerText = saturation;

    document.documentElement.classList.remove('mono', 'slab', 'serif', 'sans-serif');
    document.documentElement.classList.add(font);

    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);

    document.documentElement.style.setProperty('--hue', hue);
    document.documentElement.style.setProperty('--saturation', `${saturation}%`);

    if (systemPrompt) {
        dom.systemPromptInput.value = systemPrompt;
    }
}

const pendingContent = new PendingContent();

let conversation = new Conversation();

Model.loadModels().then(() => {
    Model.buildPopup(dom.modelSelect);
    Model.setCurrentModel(Model.defaultModel);
});

if (!localStorage.getItem('notWarnedApiKey')) {
    dom.popup.classList.remove('hidden');
    localStorage.setItem('notWarnedApiKey', '1');
}

document.getElementById('popup-close').onclick = hidePopup;

getSavedSettings();

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
    if (conversation.generating) {
        // stop generating if already generating
        conversation.interrupt();
        dom.sendButton.innerText = 'send';
        return;
    }

    const prompt = dom.promptInput.value.trim();
    const hasPendingImages = pendingContent.images.length > 0;

    if (!prompt && !hasPendingImages) {
        return;
    }

    dom.mainDiv.classList.add('chat');

    const lastMessage = conversation.getLastMessage();

    if (lastMessage && lastMessage.type === 'error') {
        conversation.removeMessage(lastMessage.id);
    }

    const userMessage = conversation.newMessage('user');
    if (prompt) {
        userMessage.setText(prompt);
    }

    pendingContent.applyToMessage(userMessage);
    conversation.addMessageToDOM(userMessage);

    const responseMessage = conversation.newMessage('bot', true);
    conversation.addMessageToDOM(responseMessage);

    dom.promptInput.value = '';
    dom.promptInput.style.height = 'auto';

    getResponse(conversation);
});

dom.addButton.addEventListener('click', () => {
    // upload image
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;

    input.addEventListener('change', (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach((file) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    pendingContent.addImage(img);
                };
            };
            reader.readAsDataURL(file);
        });
    });

    input.click();
});

dom.settingsButton.addEventListener('click', () => {
    dom.settingsPopup.classList.toggle('hidden');
});

dom.fontSelect.addEventListener('change', (e) => {
    const font = e.target.value;
    document.documentElement.classList.remove('mono', 'slab', 'serif');
    document.documentElement.classList.add(font);

    localStorage.setItem('font', font);
});

dom.themeSelect.addEventListener('change', (e) => {
    let theme = e.target.value;

    if (theme === 'system') {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);

    localStorage.setItem('theme', theme);
});

dom.systemPromptInput.addEventListener('blur', () => {
    localStorage.setItem('systemPrompt', dom.systemPromptInput.value.trim());
});

dom.hue.addEventListener('input', (e) => {
    const hue = e.target.value;
    document.documentElement.style.setProperty('--hue', hue);
    localStorage.setItem('hue', hue);
    dom.hueValue.innerText = hue;
});

dom.saturation.addEventListener('input', (e) => {
    const saturation = e.target.value;
    document.documentElement.style.setProperty('--saturation', `${saturation}%`);
    localStorage.setItem('saturation', saturation);
    console.log('Saturation set to:', saturation);
    dom.saturationValue.innerText = saturation;
});
