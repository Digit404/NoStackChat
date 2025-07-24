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
    popupClose: document.getElementById('popup-close'),

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
md.set({ breaks: true });

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
        this.pendingContent = new PendingContent();
        this.idCounter = 0;
    }

    getLastMessage() {
        return this.messages.length > 0 ? this.messages[this.messages.length - 1] : null;
    }

    removeMessage(id) {
        const index = this.messages.findIndex((message) => message.id === id);
        if (index !== -1) {
            const message = this.messages[index];
            message.destroy();
            this.messages.splice(index, 1);
        } else {
            console.warn(`Message with id ${id} not found.`);
        }
    }

    removeMessagesAfter(id) {
        const index = this.messages.findIndex((message) => message.id === id);
        if (index !== -1) {
            // remove all messages after the specified id
            for (let i = this.messages.length - 1; i > index; i--) {
                this.messages[i].destroy();
                this.messages.splice(i, 1);
            }
        } else {
            console.warn(`Message with id ${id} not found.`);
        }
    }

    toAPIFormat() {
        const conversation = this.messages.map((message) => message.toAPIFormat());
        const systemPrompt = Conversation.getSystemPrompt();
        if (systemPrompt) {
            conversation.unshift(systemPrompt);
        }
        return conversation;
    }

    interrupt() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.generating = false;
    }

    send() {
        if (this.generating) {
            // stop generating if already generating
            this.interrupt();
            dom.sendButton.innerText = 'send';
            return;
        }

        const prompt = dom.promptInput.value.trim();
        const hasPendingImages = this.pendingContent.images.length > 0;

        if (!prompt && !hasPendingImages) {
            return;
        }

        // add chat class to mainDiv if not already present
        dom.mainDiv.classList.add('chat');

        const lastMessage = this.getLastMessage();
        let userMessage = null;

        if (lastMessage && lastMessage.role === 'user') {
            // if last message is from user, append to it
            userMessage = lastMessage;
        } else {
            // create a new user message
            userMessage = new Message(this, 'user');
            this.messages.push(userMessage);
        }

        userMessage.addPart('text', prompt);

        if (hasPendingImages) {
            // apply pending images to the user message
            this.pendingContent.applyToMessage(userMessage);
        }

        // clear input
        dom.promptInput.value = '';
        dom.promptInput.style.height = 'auto';

        // add user message to DOM
        userMessage.addToDOM();

        this.createResponse();
    }

    createResponse() {
        const errorMessages = dom.messagesDiv.querySelectorAll('.message-container.error');
        if (errorMessages.length > 0) {
            // remove all error messages
            errorMessages.forEach((message) => {
                message.remove();
            });
        }

        this.streamResponse()
            .catch((error) => {
                if (error.name === 'AbortError') {
                    // request was aborted, do nothing
                    return;
                }
                console.error('Error during response streaming:', error);
                this.generating = false;
                dom.sendButton.innerText = 'send';
            })
            .then(() => {
                this.generating = false;
                window.scrollTo(0, document.body.scrollHeight);
                dom.sendButton.innerText = 'send';
            });
    }

    displayError(message) {
        const errorMessage = new Message(this, 'error');
        errorMessage.addPart('text', message);
        errorMessage.addToDOM();
    }

    async streamResponse() {
        const BotMessage = new Message(this, 'assistant');
        this.messages.push(BotMessage);
        const part = BotMessage.addPart('text', ''); // start with empty text part
        part.view.setPending(); // set pending state for the part
        BotMessage.addToDOM();

        this.generating = true;
        dom.sendButton.innerText = 'stop';

        const model = Model.getCurrentModel();

        const messages = this.toAPIFormat();
        const apiKey = dom.apiKeyInput.value.trim();

        if (!apiKey) {
            this.displayError('API key is required.');
            this.removeMessage(BotMessage.id);
            this.generating = false;
            dom.sendButton.innerText = 'send';
            return;
        }

        this.abortController = new AbortController();

        const requestBody = {
            model: model.id,
            messages: messages,
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
                signal: this.abortController.signal,
            });
        } catch (error) {
            if (error.name === 'AbortError') {
                return;
            }
            this.displayError('Failed to connect to the API. Please check your network connection.');
            this.removeMessage(BotMessage.id);
            return;
        }

        if (!response.ok) {
            const errorResponse = await response.text();
            const errorJSON = errorResponse ? JSON.parse(errorResponse) : {};
            const errorText = errorJSON.error?.message || 'An unknown error occurred.';
            this.displayError(`Error: ${response.status} - ${errorText}`);
            this.removeMessage(BotMessage.id);
            this.generating = false;
            dom.sendButton.innerText = 'send';
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');

        let done = false;
        let buffer = '';

        while (!done) {
            let { value, done: streamDone } = await reader.read();
            if (streamDone) {
                done = true;
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
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
                        if (part.view.pending) {
                            part.view.pending = false;
                            part.setContent('');
                        }

                        BotMessage.parts[0].content += content;
                        BotMessage.parts[0].view.updateContent();
                    }
                } catch (error) {
                    continue;
                }
            }
        }
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
    constructor(conversation, role = 'user') {
        this.id = conversation.idCounter++;
        this.conversation = conversation;
        this.role = role;

        this.parts = [];
    }

    addPart(type, content) {
        const part = new MessagePart(this, type, content);
        this.parts.push(part);
        part.view.updateContent();
        return part;
    }

    toAPIFormat() {
        const content = this.parts.map((part) => part.toAPIFormat());

        return {
            role: this.role,
            content: content,
        };
    }

    destroy() {
        this.parts.forEach((part) => {
            part.destroy();
        });
        this.parts = [];
    }

    removePart(part) {
        const index = this.parts.indexOf(part);

        if (index !== -1) {
            part.destroy();
            this.parts.splice(index, 1);
        } else {
            console.warn('Part not found in message.');
        }

        if (this.parts.length === 0) {
            this.conversation.removeMessage(this.id);
        }
    }

    addToDOM() {
        // display images first
        const imageContainer = document.createElement('div');
        imageContainer.classList.add('message-images', this.role);
        imageContainer.classList.add('hidden');
        dom.messagesDiv.appendChild(imageContainer);

        for (const part of this.parts) {
            if (part.type === 'image') {
                console.log('image found!');
                const img = part.view.elements.messageContainer;
                imageContainer.appendChild(img);
                imageContainer.classList.remove('hidden');
            }
        }

        for (const part of this.parts) {
            if (part.type !== 'image') {
                dom.messagesDiv.appendChild(part.view.elements.messageContainer);
            }
        }
    }

    regenerate() {
        if (this.role !== 'assistant' && this.role !== 'error') return;

        this.conversation.removeMessagesAfter(this.id);
        this.conversation.removeMessage(this.id);
        this.conversation.generating = false;
        dom.sendButton.innerText = 'send';
        this.conversation.createResponse();
    }
}

class MessagePart {
    constructor(message, type, content) {
        this.message = message;
        this.type = type;
        this.content = content;
        this.view = new PartView(this);
    }

    setContent(content) {
        this.content = content;
        this.view.updateContent();
    }

    toAPIFormat() {
        if (this.type === 'text') {
            return { type: 'text', text: this.content };
        } else if (this.type === 'image') {
            return { type: 'image_url', image_url: { url: this.content } };
        }
        return null;
    }

    destroy() {
        if (this.view) {
            this.view.destroy();
            this.view = null;
        }
    }
}

class PartView {
    constructor(part) {
        this.part = part;
        this.elements = {};
        this.editing = false;
        this.pending = false;
        this.buttons = {};
        this.build();
    }

    createButton(icon, onclick) {
        const button = document.createElement('button');
        button.classList = `icon message-button`;
        button.innerText = icon;
        button.addEventListener('click', onclick);
        this.elements.buttonContainer.appendChild(button);
        return button;
    }

    updateContent() {
        this.pending = false;
        this.elements.messageDiv.classList.remove('pending');
        if (this.elements.messageDiv) {
            this.elements.messageDiv.innerHTML = DOMPurify.sanitize(md.render(this.part.content));
        }

        if (window.hljs) {
            // highlight code blocks
            const codeBlocks = this.elements.messageDiv.querySelectorAll('pre code');
            codeBlocks.forEach((block) => {
                hljs.highlightElement(block);
            });
        }

        this.addCopyButtons();
    }

    build() {
        // create container
        const el = this.elements;
        el.messageContainer = document.createElement('div');
        el.messageContainer.classList.add(this.part.message.role);

        // create message part
        if (this.part.type === 'text') {
            el.messageContainer.classList.add('message-container');
            el.messageDiv = document.createElement('div');
            el.messageDiv.classList.add('message', this.part.message.role);

            if (this.part.message.role === 'user') {
                el.messageDiv.classList.add('dark');
            }

            el.buttonContainer = document.createElement('div');
            el.buttonContainer.classList.add('message-button-container');

            this.buttons.cancelButton = this.createButton('cancel', () => this.cancelEdit());
            this.buttons.editButton = this.createButton('edit', () => this.edit());
            this.buttons.saveButton = this.createButton('save', () => this.saveEdit());
            this.buttons.resendButton = this.createButton('send', () => this.saveAndSend());
            this.buttons.copyButton = this.createButton('content_copy', () => this.copyText());
            this.buttons.deleteButton = this.createButton('delete', () => this.part.message.removePart(this.part));
            this.buttons.regenerateButton = this.createButton('refresh', () => this.part.message.regenerate());

            this.updateButtonVisibility();

            el.messageContainer.appendChild(el.messageDiv);
            el.messageContainer.appendChild(el.buttonContainer);
        } else if (this.part.type === 'image') {
            el.messageContainer.classList.add(`message-image-container`);
            el.messageDiv = document.createElement('img');
            el.messageDiv.src = this.part.content;
            el.messageDiv.alt = 'Uploaded image';
            el.messageDiv.classList.add('message-image');
            el.removeButton = document.createElement('button');
            el.removeButton.classList.add('icon', 'remove-image-button');
            el.removeButton.innerText = 'close';

            el.removeButton.addEventListener('click', () => {
                this.part.destroy();
            });

            el.messageContainer.appendChild(el.messageDiv);
            el.messageContainer.appendChild(el.removeButton);
        }
    }

    setPending() {
        this.pending = true;
        this.elements.messageDiv.classList.add('pending');
        this.elements.messageDiv.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            const pendingBar = document.createElement('div');
            pendingBar.classList.add('pending-bar');
            this.elements.messageDiv.appendChild(pendingBar);
        }
        this.updateButtonVisibility();
    }

    copyText() {
        if (this.part.type === 'text') {
            navigator.clipboard
                .writeText(this.part.content)
                .then(() => {
                    this.buttons.copyButton.innerText = 'check';
                    setTimeout(() => {
                        this.buttons.copyButton.innerText = 'content_copy';
                    }, 1000);
                })
                .catch((error) => {
                    // really unnecessary error handling
                    console.error('Failed to copy text: ', error);
                    this.buttons.copyButton.innerText = 'error';
                    setTimeout(() => {
                        this.buttons.copyButton.innerText = 'content_copy';
                    }, 1000);
                });
        }
    }

    edit() {
        if (this.part.type !== 'text' || this.editing) return;

        this.editing = true;
        this.elements.messageContainer.classList.add('editing');
        this.elements.messageDiv.innerText = this.part.content;
        this.elements.messageDiv.contentEditable = 'true';
        this.elements.messageDiv.focus();

        this.updateButtonVisibility();

        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(this.elements.messageDiv);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    saveEdit() {
        if (this.part.type !== 'text' || !this.editing) return;

        const newText = this.elements.messageDiv.innerHTML
            .replace(/<div>/gi, '\n')
            .replace(/<\/div>/gi, '')
            .replace(/<br>/gi, '\n')
            .trim();

        this.part.setContent(newText);
        this.editing = false;
        this.elements.messageDiv.contentEditable = 'false';
        this.elements.messageContainer.classList.remove('editing');
        this.elements.messageDiv.blur();

        this.updateButtonVisibility();
    }

    saveAndSend() {
        if (this.part.type !== 'text' || !this.editing || this.part.message.role !== 'user') return;

        this.saveEdit();
        this.part.message.conversation.removeMessagesAfter(this.part.message.id);
        this.part.message.conversation.createResponse();
    }

    cancelEdit() {
        if (this.part.type !== 'text' || !this.editing) return;

        this.editing = false;
        this.elements.messageDiv.contentEditable = 'false';
        this.elements.messageContainer.classList.remove('editing');
        this.updateContent();
        this.elements.messageDiv.blur();

        this.updateButtonVisibility();
    }

    updateButtonVisibility() {
        const b = this.buttons;
        const vis = [];

        vis.push(b.copyButton);
        vis.push(b.deleteButton);

        if (this.part.message.role === 'error') {
            vis.push(b.regenerateButton);
        } else if (this.part.type === 'text') {
            if (this.editing) {
                vis.push(b.saveButton);
                vis.push(b.cancelButton);

                if (this.part.message.role === 'user') {
                    vis.push(b.resendButton);
                }
            } else {
                vis.push(b.editButton);
            }

            if (this.part.message.role === 'assistant') {
                vis.push(b.regenerateButton);
            }
        }

        for (const button of Object.values(b)) {
            if (vis.includes(button)) {
                button.classList.remove('hidden');
            } else {
                button.classList.add('hidden');
            }
        }
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
                    .catch((error) => {
                        console.error('Failed to copy code: ', error);
                        copyButton.innerText = 'error';
                        setTimeout(() => {
                            copyButton.innerText = 'content_copy';
                        }, 2000);
                    });
            });
        }
    }

    destroy() {
        if (this.elements.messageContainer) {
            this.elements.messageContainer.remove();
            this.elements = {};
        }
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
        if (this.images.length === 0) return;

        this.images.forEach((img) => {
            message.addPart('image', img.src);
        });

        this.clearImages();
    }
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

let conversation = new Conversation();

Model.loadModels().then(() => {
    Model.buildPopup(dom.modelSelect);
    Model.setCurrentModel(Model.defaultModel);
});

if (!localStorage.getItem('notWarnedApiKey')) {
    dom.popup.classList.remove('hidden');
    localStorage.setItem('notWarnedApiKey', '1');
}

getSavedSettings();

// buttons
dom.popupClose.addEventListener('click', () => {
    dom.popup.classList.add('hidden');
});

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
                    conversation.pendingContent.addImage(img);
                };
            };
            reader.readAsDataURL(file);
        });
    });

    input.click();
});

// prompt event listeners
dom.promptInput.addEventListener('input', () => {
    dom.promptInput.style.height = 'auto';
    dom.promptInput.style.height = `${dom.promptInput.scrollHeight}px`;
});

dom.sendButton.addEventListener('click', () => {
    conversation.send();
});

dom.promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        conversation.send();
    }
});

// settings
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
    dom.saturationValue.innerText = saturation;
});
