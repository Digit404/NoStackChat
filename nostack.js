const dom = {
    mainDiv: document.getElementById("main"),
    messagesDiv: document.getElementById("messages"),
    messagesViewport: document.getElementById("messages-viewport"),

    pendingImagesContainer: document.getElementById("pending-images-container"),
    promptInput: document.getElementById("prompt"),
    controlsContainer: document.querySelector(".controls-container"),
    sendButton: document.getElementById("send"),
    addButton: document.getElementById("add"),

    newChatButton: document.getElementById("new-chat-button"),

    popup: document.getElementById("popup"),
    popupClose: document.getElementById("popup-close"),

    modelSelect: document.getElementById("model-select"),
    currentModel: document.getElementById("current-model"),
    modelPopup: document.getElementById("model-popup"),
    modelList: document.getElementById("model-list"),

    modelSettingsButton: null,
    modelSettingsPopup: document.getElementById("model-settings-popup"),
    modelListContainer: document.querySelector(".model-list-container"),

    settingsPopup: document.getElementById("settings-popup"),
    settingsButton: document.getElementById("settings-button"),

    imagePreviewPopup: document.getElementById("image-preview-popup"),
    imagePreviewContent: document.getElementById("image-preview-content"),
    imagePreview: document.getElementById("image-preview"),

    keyButtons: document.querySelectorAll(".key-button"),

    openaiApiKeyInput: document.getElementById("openai-api-key"),
    anthropicApiKeyInput: document.getElementById("anthropic-api-key"),

    saveKeyCheckbox: document.getElementById("saveKey"),

    systemPromptInput: document.getElementById("system-prompt"),

    temperatureInput: document.getElementById("temperature"),
    temperatureValue: document.getElementById("temperature-value"),

    themeSelect: document.getElementById("theme-select"),
    fontSelect: document.getElementById("font-select"),

    hue: document.getElementById("hue"),
    saturation: document.getElementById("saturation"),

    hueValue: document.getElementById("hue-value"),
    saturationValue: document.getElementById("saturation-value"),
};

class Model {
    static models = [];
    static currentModel = null;
    static defaultModel = "gpt-4.1";
    static noKey = false;
    static OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
    static ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

    constructor(data) {
        this.id = data.id;
        this.provider = data.provider;
        this.name = data.name;
        this.description = data.description;
        this.icon = data.icon;
        this.color = data.color;
        this.type = data.type || "standard";
        this.capabilities = data.capabilities || [];
        this.flags = data.flags || [];
        this._hidden = data.hidden || false;

        this.isDefaultModel = Model.defaultModel === this.id;

        this.popupItem = null;
        this.settingsItem = null;

        if (this.provider === "OpenAI") {
            this.url = Model.OPENAI_API_URL;
        } else if (this.provider === "Anthropic") {
            this.url = Model.ANTHROPIC_API_URL;
        }
    }

    get hidden() {
        return this._hidden;
    }

    set hidden(value) {
        this._hidden = value;

        if (this.popupItem) {
            if (value) {
                this.popupItem.classList.add("hidden");
            } else {
                this.popupItem.classList.remove("hidden");
            }
        }

        if (this.settingsItem) {
            const hideIcon = this.settingsItem.querySelector(".model-hide-icon");
            if (hideIcon) {
                hideIcon.innerText = value ? "visibility_off" : "visibility";
                this.settingsItem.classList.toggle("invisible", value);
            }
        }

        Model.saveModelSettings();
    }

    createPopupItem() {
        this.popupItem = document.createElement("div");
        this.popupItem.className = "model-item";
        this.popupItem.title = this.description;

        const icon = document.createElement("img");
        icon.src = this.icon;
        icon.alt = this.name;
        icon.className = "model-icon";

        const nameDiv = document.createElement("div");
        nameDiv.className = "model-name";
        nameDiv.innerText = this.name;

        const infoIcon = document.createElement("span");
        infoIcon.className = "icon model-info-icon";
        infoIcon.innerText = "info";

        infoIcon.addEventListener("mouseover", (e) => {
            this.createInfoPopup(e.clientX, e.clientY);
        });

        this.popupItem.appendChild(icon);
        this.popupItem.appendChild(nameDiv);
        this.popupItem.appendChild(infoIcon);

        this.popupItem.addEventListener("click", () => {
            Model.setCurrentModel(this.id);
            dom.modelPopup.classList.add("hidden");
        });

        return this.popupItem;
    }

    createSettingsItem() {
        this.settingsItem = document.createElement("div");
        this.settingsItem.className = "model-item";
        this.settingsItem.title = this.description;

        this.starButton = document.createElement("span");
        this.starButton.className = "icon model-star-button";
        this.starButton.innerText = "star";

        if (this.isDefaultModel) {
            this.starButton.classList.add("default");
        }

        const icon = document.createElement("img");
        icon.src = this.icon;
        icon.alt = this.name;
        icon.className = "model-icon";

        const nameDiv = document.createElement("div");
        nameDiv.className = "model-name";
        nameDiv.innerText = this.name;

        const hideIcon = document.createElement("span");
        hideIcon.className = "icon model-hide-icon";
        hideIcon.innerText = this.hidden ? "visibility_off" : "visibility";

        this.starButton.addEventListener("click", (e) => {
            e.stopPropagation();
            this.setDefault();
            this.starButton.classList.add("default");
        });

        this.settingsItem.addEventListener("click", (e) => {
            e.stopPropagation();
            this.hidden = !this.hidden;
            hideIcon.innerText = this.hidden ? "visibility_off" : "visibility";
        });

        this.settingsItem.appendChild(this.starButton);
        this.settingsItem.appendChild(icon);
        this.settingsItem.appendChild(nameDiv);
        this.settingsItem.appendChild(hideIcon);

        return this.settingsItem;
    }

    createInfoPopup(x, y) {
        const infoPopup = document.createElement("div");
        infoPopup.className = "model-info-popup";

        const title = document.createElement("h3");
        title.className = "model-info-title";
        title.innerText = this.name;

        const description = document.createElement("p");
        description.className = "model-info-description";
        description.innerText = this.description;

        const provider = document.createElement("p");
        provider.className = "model-info-provider";
        provider.innerHTML = `<strong>Provider:</strong> ${this.provider}`;

        infoPopup.appendChild(title);
        infoPopup.appendChild(description);
        infoPopup.appendChild(provider);

        // position over mouse cursor
        infoPopup.style.left = `${x - 10}px`;
        infoPopup.style.top = `${y - 10}px`;

        infoPopup.addEventListener(
            "mouseleave",
            () => {
                infoPopup.remove();
            },
            { once: true }
        );

        document.body.appendChild(infoPopup);
    }

    setDefault() {
        Model.defaultModel = this.id;

        for (const model of Model.models) {
            model.isDefaultModel = model.id === this.id;
            model.starButton.classList.toggle("default", model.isDefaultModel);
        }

        Model.saveModelSettings();
    }

    getAPIKey() {
        if (this.provider === "OpenAI") {
            return dom.openaiApiKeyInput.value.trim();
        } else if (this.provider === "Anthropic") {
            return dom.anthropicApiKeyInput.value.trim();
        }
        return "";
    }

    async getStreamResponse(messages, temperature, abortSignal) {
        if (this.provider === "OpenAI") {
            const apiKey = this.getAPIKey();

            if (!apiKey) {
                throw new Error("API key is required.");
            }

            const requestBody = {
                model: this.id,
                messages,
                stream: true,
            };

            if (temperature && !this.flags.includes("temperature_unsupported")) {
                requestBody.temperature = temperature;
            }

            const response = await fetch(this.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify(requestBody),
                signal: abortSignal,
            });

            if (!response.ok) {
                let errorText = await response.text();
                let errorMsg = "Unknown error";
                try {
                    errorMsg = JSON.parse(errorText).error?.message || errorText;
                } catch {
                    // fallback to raw text if parsing fails
                }
                throw new Error(`${response.status}: ${errorMsg}`);
            }

            return response.body.getReader();
        } else if (this.provider === "Anthropic") {
            const apiKey = this.getAPIKey();

            if (!apiKey) {
                throw new Error("API key is required.");
            }

            // convert messages format for Anthropic
            const anthropicMessages = messages.filter((msg) => msg.role !== "system");
            const systemMessage = messages.find((msg) => msg.role === "system");

            const requestBody = {
                model: this.id,
                messages: anthropicMessages.map((msg) => ({
                    role: msg.role,
                    content: msg.content,
                })),
                stream: true,
                max_tokens: 8192,
            };

            if (temperature && !this.flags.includes("temperature_unsupported")) {
                requestBody.temperature = temperature / 2; // Anthropic uses a different scale
            }

            // add system message if it exists
            if (systemMessage) {
                requestBody.system = systemMessage.content;
            }

            const response = await fetch(this.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                    "anthropic-version": "2023-06-01",
                    "anthropic-dangerous-direct-browser-access": "true", // only way to get access from browser
                },
                body: JSON.stringify(requestBody),
                signal: abortSignal,
            });

            if (!response.ok) {
                let errorText = await response.text();
                let errorMsg = "Unknown error";
                try {
                    const errorData = JSON.parse(errorText);
                    errorMsg = errorData.error?.message || errorData.message || errorText;
                } catch {
                    // fallback to raw text if parsing fails
                }
                throw new Error(`${response.status}: ${errorMsg}`);
            }

            return response.body.getReader();
        }
    }

    parseStreamChunk(line) {
        if (!line || !line.trim()) return null;

        if (this.provider === "OpenAI") {
            if (line === "data: [DONE]") return { done: true };
            if (!line.startsWith("data: ")) return null;

            try {
                const payload = JSON.parse(line.slice(6));
                const content = payload.choices?.[0]?.delta?.content;
                return content ? { content } : null;
            } catch {
                return null;
            }
        } else if (this.provider === "Anthropic") {
            if (line.startsWith("event: ")) {
                const event = line.slice(7);
                if (event === "message_stop") return { done: true };
                return null;
            }

            if (!line.startsWith("data: ")) return null;

            try {
                const payload = JSON.parse(line.slice(6));

                if (payload.type === "content_block_delta" && payload.delta?.type === "text_delta") {
                    return { content: payload.delta.text };
                }
                return null;
            } catch {
                return null;
            }
        }

        return null;
    }

    static findById(modelId) {
        return Model.models.find((model) => model.id === modelId);
    }

    static async loadModels() {
        try {
            const response = await fetch("/api/known_models.json");
            const modelsData = await response.json();
            Model.models = modelsData.map((data) => new Model(data));
        } catch (error) {
            console.error("Failed to load models:", error);
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
        const providers = Model.models.reduce((acc, model) => {
            if (!acc.includes(model.provider)) {
                acc.push(model.provider);
            }
            return acc;
        }, []);

        dom.modelPopup.innerHTML = ""; // clear existing content

        dom.modelSettingsButton = document.createElement("div");
        dom.modelSettingsButton.id = "model-settings";
        dom.modelSettingsButton.className = "icon";
        dom.modelSettingsButton.innerHTML = `edit`;
        dom.modelSettingsButton.title = "Edit model list";
        dom.modelPopup.appendChild(dom.modelSettingsButton);

        dom.modelSettingsButton.addEventListener("click", (e) => {
            e.stopPropagation();
            dom.modelPopup.classList.add("hidden");
            dom.modelSettingsPopup.classList.toggle("hidden");
        });

        // build model popup sections
        providers.forEach((provider) => {
            const providerSection = document.createElement("div");
            providerSection.className = "model-list-section";
            providerSection.id = `model-list-${provider.toLowerCase()}`;
            providerSection.innerHTML = `<h2>${provider.charAt(0).toUpperCase() + provider.slice(1)}</h2>`;

            const modelList = document.createElement("div");
            modelList.className = "model-list";
            providerSection.appendChild(modelList);
            dom.modelPopup.appendChild(providerSection);

            const settingsProviderSection = document.createElement("div");
            settingsProviderSection.className = "model-list-section";
            settingsProviderSection.id = `settings-model-list-${provider.toLowerCase()}`;
            settingsProviderSection.innerHTML = `<h2>${provider.charAt(0).toUpperCase() + provider.slice(1)}</h2>`;

            const settingsModelList = document.createElement("div");
            settingsModelList.className = "model-list";
            settingsProviderSection.appendChild(settingsModelList);
            dom.modelListContainer.appendChild(settingsProviderSection);

            Model.models
                .filter((model) => model.provider === provider)
                .forEach((model) => {
                    modelList.appendChild(model.createPopupItem());
                    settingsModelList.appendChild(model.createSettingsItem());
                });
        });

        dom.modelSelect.addEventListener("click", (e) => {
            e.stopPropagation();

            if (Model.noKey) {
                dom.modelPopup.classList.add("hidden");
                dom.settingsPopup.classList.remove("hidden");
                return;
            }

            dom.modelPopup.classList.toggle("hidden");

            // click outside to close
            document.addEventListener(
                "click",
                (event) => {
                    if (!dom.modelPopup.contains(event.target) && !dom.modelSelect.contains(event.target)) {
                        dom.modelPopup.classList.add("hidden");
                    }
                },
                { once: true }
            );
        });
    }

    static updateProviderVisibility() {
        const openAIKey = Boolean(dom.openaiApiKeyInput.value.trim());
        const anthropicKey = Boolean(dom.anthropicApiKeyInput.value.trim());

        document.getElementById("model-list-openai").classList.toggle("hidden", !openAIKey);
        document.getElementById("model-list-anthropic").classList.toggle("hidden", !anthropicKey);
        document.getElementById("settings-model-list-openai").classList.toggle("disabled", !openAIKey);
        document.getElementById("settings-model-list-anthropic").classList.toggle("disabled", !anthropicKey);

        Model.noKey = !openAIKey && !anthropicKey;

        // if current model is from a provider without a key, unset it
        if (Model.currentModel && Model.currentModel.provider === "OpenAI" && !openAIKey) {
            Model.currentModel = null;
        } else if (Model.currentModel && Model.currentModel.provider === "Anthropic" && !anthropicKey) {
            Model.currentModel = null;
        }

        // if current model is unavailable, switch to an available one
        if (!Model.currentModel) {
            const availableModel = Model.models.find((model) => {
                if (model.hidden) return false;
                if (model.provider === "OpenAI" && !openAIKey) return false;
                if (model.provider === "Anthropic" && !anthropicKey) return false;
                return true;
            });

            if (availableModel) {
                Model.setCurrentModel(availableModel.id);
            } else {
                dom.currentModel.innerText = "No API Key";
                dom.modelSelect.querySelector(".model-icon").src = "/res/NoKey.png";
            }
        }
    }

    static setCurrentModel(modelId) {
        const model = Model.models.find((m) => m.id === modelId);
        if (model) {
            Model.currentModel = model;
            dom.currentModel.innerText = model.name;
            dom.modelSelect.querySelector(".model-icon").src = model.icon;
        } else {
            console.warn(`Model with id ${modelId} not found.`);
        }
    }

    static getCurrentModel() {
        if (!Model.currentModel) {
            console.warn("No current model set. Returning default model.");
            return Model.models.find((m) => m.id === Model.defaultModel);
        }
        return Model.currentModel;
    }

    static saveModelSettings() {
        const modelSettings = Model.models.map((model) => ({
            id: model.id,
            hidden: model.hidden,
            isDefaultModel: model.isDefaultModel,
        }));

        localStorage.setItem("modelSettings", JSON.stringify(modelSettings));
    }

    static loadModelsFromStorage() {
        const modelSettings = JSON.parse(localStorage.getItem("modelSettings")) || [];
        Model.models.forEach((model) => {
            const settings = modelSettings.find((setting) => setting.id === model.id);

            if (settings) {
                model.hidden = settings.hidden;
            }
        });

        // set default model
        const defaultModel = modelSettings.find((setting) => setting.isDefaultModel);
        if (defaultModel) {
            const model = Model.findById(defaultModel.id);
            if (model) {
                model.setDefault();
            }

            Model.setCurrentModel(defaultModel.id);
        }
    }
}

class Conversation {
    constructor() {
        this.messages = [];
        this.generating = false;
        this.abortController = null;
        this.idCounter = 0;

        this.pendingImages = [];
    }

    getLastMessage() {
        return this.messages.length > 0 ? this.messages[this.messages.length - 1] : null;
    }

    redraw() {
        dom.messagesDiv.innerHTML = "";
        this.messages.forEach((message) => {
            message.addToDOM();
        });
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

        const previousMessage = this.messages[index - 1];
        const nextMessage = this.messages[index];

        if (previousMessage && nextMessage && previousMessage.role === nextMessage.role) {
            // if both share the same role, merge them
            for (const part of nextMessage.parts) {
                previousMessage.addPart(part.type, part.content);
            }

            nextMessage.destroy();
            this.messages.splice(index, 1);
            this.redraw();
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

    displayError(message) {
        const errorMessage = new Message(this, "error");
        errorMessage.addPart("text", message);
        errorMessage.addToDOM();
    }

    send() {
        if (this.generating) {
            // stop generating if already generating
            this.interrupt();
            dom.sendButton.innerText = "send";
            return;
        }

        const prompt = dom.promptInput.value.trim();
        const hasPendingImages = this.pendingImages.length > 0;

        if (!prompt && !hasPendingImages) {
            return;
        }

        // add chat class to mainDiv if not already present
        dom.mainDiv.classList.add("chat");

        const lastMessage = this.getLastMessage();
        let userMessage = null;

        if (lastMessage && lastMessage.role === "user") {
            // if last message is from user, append to it
            userMessage = lastMessage;
        } else {
            // create a new user message
            userMessage = new Message(this, "user");
            this.messages.push(userMessage);
        }

        userMessage.addPart("text", prompt);

        if (hasPendingImages) {
            // apply pending images to the user message
            this.applyPendingContentToMessage(userMessage);
        }

        // clear input
        dom.promptInput.value = "";
        dom.promptInput.style.height = "auto";

        // add user message to DOM
        userMessage.addToDOM();

        this.createResponse();
    }

    addPendingImage(imgURL) {
        this.pendingImages.push(imgURL);
        this.updatePendingDisplay();
    }

    clearPendingImages() {
        this.pendingImages = [];
        this.updatePendingDisplay();
    }

    updatePendingDisplay() {
        dom.pendingImagesContainer.innerHTML = ""; // clear existing images

        if (this.pendingImages.length === 0) {
            dom.pendingImagesContainer.classList.add("hidden");
            return;
        }

        dom.pendingImagesContainer.classList.remove("hidden");

        for (const img of this.pendingImages) {
            const imgContainer = document.createElement("div");
            imgContainer.className = "pending-image-container";

            const imgElement = document.createElement("img");
            imgElement.src = img;
            imgElement.alt = "Pending image";
            imgElement.className = "pending-image";

            const removeButton = document.createElement("button");
            removeButton.className = "icon remove-image-button";
            removeButton.innerText = "close";
            removeButton.addEventListener("click", (e) => {
                this.pendingImages.splice(this.pendingImages.indexOf(img), 1);
                this.updatePendingDisplay();
            });

            imgContainer.appendChild(imgElement);
            imgContainer.appendChild(removeButton);
            dom.pendingImagesContainer.appendChild(imgContainer);
        }
    }

    applyPendingContentToMessage(message) {
        if (this.pendingImages.length === 0) return;

        for (const imgURL of this.pendingImages) {
            const part = message.addPart("image", imgURL);
        }

        this.clearPendingImages();
    }

    async createResponse() {
        // remove error messages
        const errorMessages = dom.messagesDiv.querySelectorAll(".message-container.error");
        errorMessages.forEach((message) => message.remove());

        try {
            this.generating = true;
            dom.sendButton.innerText = "stop";
            await this.streamResponse();
        } catch (error) {
            if (error.name !== "AbortError") {
                console.error("Error during response streaming:", error);
            }
        } finally {
            this.generating = false;
            dom.sendButton.innerText = "send";
        }
    }

    async streamResponse() {
        const shouldAutoScroll = () => {
            const scrollPosition = window.scrollY + window.innerHeight;
            const scrollHeight = document.body.scrollHeight;
            const scrollThreshold = 80; // px from bottom
            return scrollHeight - scrollPosition <= scrollThreshold;
        };

        const messages = this.toAPIFormat();
        const model = Model.getCurrentModel();

        const BotMessage = new Message(this, "assistant");
        this.messages.push(BotMessage);
        const part = BotMessage.addPart("text", ""); // start with empty text part
        part.view.setPending(); // set pending state for the part
        BotMessage.addToDOM();

        Conversation.scrollDown();

        this.abortController = new AbortController();

        const temperature = parseFloat(dom.temperatureInput.value);

        let reader;

        try {
            reader = await model.getStreamResponse(messages, temperature, this.abortController.signal);
        } catch (error) {
            this.displayError(`Error: ${error.message}`);
            this.removeMessage(BotMessage.id);
            return;
        }

        const decoder = new TextDecoder("utf-8");

        let buffer = "";

        while (true) {
            let { value, done } = await reader.read();

            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (let line of lines) {
                const parsed = model.parseStreamChunk(line.trim());

                if (!parsed) continue;
                if (parsed.done) return;

                if (parsed.content) {
                    if (part.view.pending) {
                        part.view.pending = false;
                        part.setContent("");
                    }

                    BotMessage.parts[0].content += parsed.content;
                    BotMessage.parts[0].view.updateContent();

                    // auto-scroll only if user is already near the bottom
                    if (shouldAutoScroll()) {
                        Conversation.scrollDown();
                    }
                }
            }
        }
    }

    static scrollDown() {
        window.scrollTo({
            top: document.body.scrollHeight,
        });
    }

    static getSystemPrompt() {
        const systemPrompt = dom.systemPromptInput.value.trim() || "A helpful assistant.";
        if (systemPrompt) {
            return {
                role: "system",
                content: systemPrompt,
            };
        }
        return null;
    }
}

class Message {
    constructor(conversation, role = "user") {
        this.id = conversation.idCounter++;
        this.conversation = conversation;
        this.role = role;

        this.timestamp = new Date().toISOString();

        this.parts = [];
    }

    addPart(type, content) {
        let part;
        if (type === "image") {
            part = new ImagePart(this, content);
        } else {
            part = new TextPart(this, content);
        }

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
            console.warn("Part not found in message.");
        }

        if (this.parts.length === 0) {
            this.conversation.removeMessage(this.id);
        }
    }

    addToDOM() {
        // display images first
        const imageContainer = document.createElement("div");
        imageContainer.classList.add("message-images", this.role);
        imageContainer.classList.add("hidden");
        dom.messagesDiv.appendChild(imageContainer);

        for (const part of this.parts) {
            if (part.type === "image") {
                const img = part.view.elements.messageContainer;
                imageContainer.appendChild(img);
                imageContainer.classList.remove("hidden");
            }
        }

        for (const part of this.parts) {
            if (part.type !== "image") {
                dom.messagesDiv.appendChild(part.view.elements.messageContainer);
            }
        }
    }

    regenerate() {
        if (this.role !== "assistant" && this.role !== "error") return;

        this.conversation.removeMessagesAfter(this.id);
        this.conversation.removeMessage(this.id);
        this.conversation.generating = false;
        dom.sendButton.innerText = "send";
        this.conversation.createResponse();
    }
}

class MessagePart {
    constructor(message, type, content) {
        this.message = message;
        this.type = type;
        this.content = content;

        if (this.message.role === "assistant") {
            this.model = Model.getCurrentModel();
        }

        this.view = new PartView(this);
    }

    setContent(content) {
        this.content = content;
        this.view.updateContent();
    }

    toAPIFormat() {
        return null;
    }

    destroy() {
        if (this.view) {
            this.view.destroy();
            this.view = null;
        }
    }
}

class TextPart extends MessagePart {
    constructor(message, content) {
        super(message, "text", content);
    }

    toAPIFormat() {
        return { type: "text", text: this.content };
    }
}

class ImagePart extends MessagePart {
    constructor(message, content) {
        super(message, "image", content);
    }

    toAPIFormat() {
        const currentModel = Model.getCurrentModel();
        if (currentModel.provider === "OpenAI") {
            return { type: "image_url", image_url: { url: this.content } };
        } else if (currentModel.provider === "Anthropic") {
            const imageParts = this.getImageParts();
            if (imageParts) {
                return {
                    type: "image",
                    source: {
                        type: "base64",
                        media_type: imageParts.media_type,
                        data: imageParts.data,
                    },
                };
            }
        }
        return null;
    }

    getImageParts() {
        const [header, base64] = (this.content || "").split(",");
        const mimeMatch = header && header.match(/data:(image\/[a-zA-Z]+);base64/);
        if (mimeMatch) {
            return {
                media_type: mimeMatch[1],
                data: base64,
            };
        }
        return null;
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
        const button = document.createElement("button");
        button.className = `icon message-button`;
        button.innerText = icon;
        button.addEventListener("click", onclick);
        this.elements.buttonContainer.appendChild(button);
        return button;
    }

    updateContent() {
        this.pending = false;
        this.elements.messageDiv.classList.remove("pending");
        if (this.elements.messageDiv) {
            this.elements.messageDiv.innerHTML = DOMPurify.sanitize(md.render(this.part.content));
        }

        if (window.hljs) {
            // highlight code blocks
            const codeBlocks = this.elements.messageDiv.querySelectorAll("pre code");
            codeBlocks.forEach((block) => {
                hljs.highlightElement(block);
            });
        }

        this.addCopyButtons();
    }

    build() {
        // create container
        const el = this.elements;
        el.messageContainer = document.createElement("div");
        el.messageContainer.classList.add(this.part.message.role);

        el.timestamp = document.createElement("span");
        el.timestamp.classList.add("timestamp");
        let timestampString = "";
        if (this.part.message.role === "assistant" && this.part.model) {
            timestampString += "<img src='" + this.part.model.icon + "' class='model-icon-small' alt='" + this.part.model.name + "' /> ";
            timestampString += `${this.part.model.name} • `;
        }
        timestampString += new Date(this.part.message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
        el.timestamp.innerHTML = timestampString;
        el.timestamp.title = new Date(this.part.message.timestamp).toLocaleString();
        el.messageContainer.appendChild(el.timestamp);

        // create message part
        if (this.part.type === "text") {
            el.messageContainer.classList.add("message-container");
            el.messageDiv = document.createElement("div");
            el.messageDiv.classList.add("message", this.part.message.role);

            if (this.part.message.role === "user") {
                el.messageDiv.classList.add("dark");
            }

            el.buttonContainer = document.createElement("div");
            el.buttonContainer.classList.add("message-button-container");

            this.buttons.cancelButton = this.createButton("cancel", () => this.cancelEdit());
            this.buttons.editButton = this.createButton("edit", () => this.edit());
            this.buttons.saveButton = this.createButton("save", () => this.saveEdit());
            this.buttons.resendButton = this.createButton("send", () => this.saveAndSend());
            this.buttons.copyButton = this.createButton("content_copy", () => this.copyText());
            this.buttons.deleteButton = this.createButton("delete", () => this.part.message.removePart(this.part));
            this.buttons.regenerateButton = this.createButton("refresh", () => this.part.message.regenerate());

            this.updateButtonVisibility();

            el.messageContainer.appendChild(el.messageDiv);
            el.messageContainer.appendChild(el.buttonContainer);
        } else if (this.part.type === "image") {
            el.messageContainer.classList.add(`message-image-container`);
            el.messageDiv = document.createElement("img");
            el.messageDiv.src = this.part.content;
            el.messageDiv.alt = "Uploaded image";
            el.messageDiv.classList.add("message-image");
            el.removeButton = document.createElement("button");
            el.removeButton.classList.add("icon", "remove-image-button");
            el.removeButton.innerText = "close";

            el.removeButton.addEventListener("click", () => {
                this.part.message.removePart(this.part);
            });

            el.messageDiv.addEventListener("click", () => {
                dom.imagePreview.src = this.part.content;
                dom.imagePreviewPopup.classList.remove("hidden");
            });

            el.messageContainer.appendChild(el.messageDiv);
            el.messageContainer.appendChild(el.removeButton);
        }
    }

    setPending() {
        this.pending = true;
        this.elements.messageDiv.classList.add("pending");
        this.elements.messageDiv.innerHTML = "";
        for (let i = 0; i < 3; i++) {
            const pendingBar = document.createElement("div");
            pendingBar.classList.add("pending-bar");
            this.elements.messageDiv.appendChild(pendingBar);
        }
        this.updateButtonVisibility();
    }

    copyText() {
        if (this.part.type === "text") {
            navigator.clipboard
                .writeText(this.part.content)
                .then(() => {
                    this.buttons.copyButton.innerText = "check";
                    setTimeout(() => {
                        this.buttons.copyButton.innerText = "content_copy";
                    }, 1000);
                })
                .catch((error) => {
                    // really unnecessary error handling
                    console.error("Failed to copy text: ", error);
                    this.buttons.copyButton.innerText = "error";
                    setTimeout(() => {
                        this.buttons.copyButton.innerText = "content_copy";
                    }, 1000);
                });
        }
    }

    edit() {
        if (this.part.type !== "text" || this.editing) return;

        this.editing = true;
        this.elements.messageContainer.classList.add("editing");
        this.elements.messageDiv.textContent = this.part.content;
        this.elements.messageDiv.contentEditable = "true";
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
        if (this.part.type !== "text" || !this.editing) return;

        const newText = this.elements.messageDiv.textContent
            .replace(/<div>/gi, "\n")
            .replace(/<\/div>/gi, "")
            .replace(/<br>/gi, "\n")
            .trim();

        this.part.setContent(newText);
        this.editing = false;
        this.elements.messageDiv.contentEditable = "false";
        this.elements.messageContainer.classList.remove("editing");
        this.elements.messageDiv.blur();

        this.updateButtonVisibility();
    }

    saveAndSend() {
        if (this.part.type !== "text" || !this.editing || this.part.message.role !== "user") return;

        this.saveEdit();
        this.part.message.conversation.removeMessagesAfter(this.part.message.id);
        this.part.message.conversation.createResponse();
    }

    cancelEdit() {
        if (this.part.type !== "text" || !this.editing) return;

        this.editing = false;
        this.elements.messageDiv.contentEditable = "false";
        this.elements.messageContainer.classList.remove("editing");
        this.updateContent();
        this.elements.messageDiv.blur();

        this.updateButtonVisibility();
    }

    updateButtonVisibility() {
        const b = this.buttons;
        const vis = [];

        vis.push(b.copyButton);
        vis.push(b.deleteButton);

        if (this.part.message.role === "error") {
            vis.push(b.regenerateButton);
        } else if (this.part.type === "text") {
            if (this.editing) {
                vis.push(b.saveButton);
                vis.push(b.cancelButton);

                if (this.part.message.role === "user") {
                    vis.push(b.resendButton);
                }
            } else {
                vis.push(b.editButton);
            }

            if (this.part.message.role === "assistant") {
                vis.push(b.regenerateButton);
            }
        }

        for (const button of Object.values(b)) {
            if (vis.includes(button)) {
                button.classList.remove("hidden");
            } else {
                button.classList.add("hidden");
            }
        }
    }

    addCopyButtons() {
        for (const block of this.elements.messageDiv.querySelectorAll("pre:has(code)")) {
            if (block.parentNode.classList.contains("code-wrapper")) {
                continue; // already wrapped
            }

            const wrapper = document.createElement("div");
            wrapper.className = "code-wrapper";

            block.parentNode.insertBefore(wrapper, block);
            wrapper.appendChild(block);

            const buttonContainer = document.createElement("div");
            buttonContainer.className = "code-buttons";
            wrapper.appendChild(buttonContainer);

            const collapseButton = document.createElement("button");
            collapseButton.className = "icon button collapse-button";
            collapseButton.innerText = "expand_less";
            buttonContainer.appendChild(collapseButton);

            collapseButton.addEventListener("click", () => {
                if (wrapper.classList.contains("collapsed")) {
                    wrapper.classList.remove("collapsed");
                    collapseButton.innerText = "expand_less";
                } else {
                    wrapper.classList.add("collapsed");
                    collapseButton.innerText = "expand_more";
                }
            });

            const copyButton = document.createElement("button");
            copyButton.className = "icon button copy-button";
            copyButton.innerText = "content_copy";
            buttonContainer.appendChild(copyButton);

            copyButton.addEventListener("click", () => {
                const codeText = block.innerText || block.textContent;
                navigator.clipboard
                    .writeText(codeText)
                    .then(() => {
                        copyButton.innerText = "check";
                        setTimeout(() => {
                            copyButton.innerText = "content_copy";
                        }, 2000);
                    })
                    .catch((error) => {
                        console.error("Failed to copy code: ", error);
                        copyButton.innerText = "error";
                        setTimeout(() => {
                            copyButton.innerText = "content_copy";
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

function getSavedSettings() {
    const font = localStorage.getItem("font") || "sans-serif";
    const theme = localStorage.getItem("theme") || "light";
    const systemPrompt = localStorage.getItem("systemPrompt");
    const hue = localStorage.getItem("hue") || "230";
    const saturation = localStorage.getItem("saturation") || "5";
    const temperature = localStorage.getItem("temperature") || "1.0";
    const openaiApiKey = localStorage.getItem("openaiApiKey") || "";
    const anthropicApiKey = localStorage.getItem("anthropicApiKey") || "";
    const saveApiKey = localStorage.getItem("saveApiKey") === "1";

    dom.fontSelect.value = font;
    dom.themeSelect.value = theme;
    dom.hue.value = hue;
    dom.hueValue.innerText = hue;
    dom.saturation.value = saturation;
    dom.saturationValue.innerText = saturation;
    dom.temperatureInput.value = temperature;
    dom.temperatureValue.innerText = temperature;

    dom.saveKeyCheckbox.checked = saveApiKey;

    if (saveApiKey) {
        dom.openaiApiKeyInput.value = openaiApiKey;
        dom.anthropicApiKeyInput.value = anthropicApiKey;
    }

    document.documentElement.classList.remove("mono", "slab", "serif", "sans-serif");
    document.documentElement.classList.add(font);

    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);

    document.documentElement.style.setProperty("--hue", hue);
    document.documentElement.style.setProperty("--saturation", `${saturation}%`);

    if (systemPrompt) {
        dom.systemPromptInput.value = systemPrompt;
    }
}

let conversation = new Conversation();

const md = window.markdownit();
md.set({
    breaks: true,
    html: true,
});

Model.loadModels().then(() => {
    Model.buildPopup();
    Model.setCurrentModel(Model.defaultModel);
    Model.loadModelsFromStorage();
    Model.updateProviderVisibility();
});

if (!localStorage.getItem("notWarnedApiKey")) {
    dom.popup.classList.remove("hidden");
}

getSavedSettings();

// buttons
dom.popupClose.addEventListener("click", () => {
    dom.popup.classList.add("hidden");
    localStorage.setItem("notWarnedApiKey", "1");
});

dom.imagePreviewPopup.addEventListener("click", (e) => {
    dom.imagePreviewPopup.classList.add("hidden");
    dom.imagePreview.src = "";
});

dom.newChatButton.addEventListener("click", (e) => {
    e.preventDefault();
    if (conversation.generating) {
        conversation.interrupt();
    }

    // if they click new chat again, reset to default model
    if (!dom.mainDiv.classList.contains("chat")) {
        Model.setCurrentModel(Model.defaultModel);
    }

    dom.mainDiv.classList.remove("chat");
    dom.messagesDiv.innerHTML = "";
    dom.promptInput.value = "";
    dom.promptInput.style.height = "auto";
    dom.promptInput.focus();
    conversation.clearPendingImages();
    conversation.interrupt();
    conversation = new Conversation();
});

dom.addButton.addEventListener("click", () => {
    // upload image
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;

    input.addEventListener("change", (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach((file) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    conversation.addPendingImage(event.target.result);
                };
            };
            reader.readAsDataURL(file);
        });
    });

    input.click();
});

// prompt event listeners
dom.promptInput.addEventListener("input", () => {
    dom.promptInput.style.height = "auto";
    dom.promptInput.style.height = `${dom.promptInput.scrollHeight}px`;
});

dom.promptInput.addEventListener("paste", (e) => {
    const items = e.clipboardData.items;
    if (!items) return;

    for (const item of items) {
        if (item.type.indexOf("image") !== -1) {
            const file = item.getAsFile();
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    conversation.addPendingImage(event.target.result);
                };
            };
            reader.readAsDataURL(file);
        }
    }
});

document.body.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dom.controlsContainer.classList.add("dragover");
});

document.body.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dom.controlsContainer.classList.remove("dragover");
});

document.body.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dom.controlsContainer.classList.remove("dragover");

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
        if (file.type.indexOf("image") === -1) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                conversation.addPendingImage(event.target.result);
            };
        };
        reader.readAsDataURL(file);
    });
});

dom.sendButton.addEventListener("click", () => {
    conversation.send();
});

dom.promptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        conversation.send();
    }
});

// settings
dom.settingsButton.addEventListener("click", () => {
    dom.settingsPopup.classList.toggle("hidden");
    dom.modelSettingsPopup.classList.add("hidden");
});

dom.settingsPopup.addEventListener("click", (e) => {
    if (e.target === dom.settingsPopup) {
        dom.settingsPopup.classList.add("hidden");
    }
});

dom.keyButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
        const keyContainer = e.target.closest(".api-key-container");
        if (keyContainer) {
            keyContainer.classList.toggle("collapsed");
        }
    });
});

dom.openaiApiKeyInput.addEventListener("blur", () => {
    const openaiApiKey = dom.openaiApiKeyInput.value.trim();
    Model.updateProviderVisibility();

    if (openaiApiKey && dom.saveKeyCheckbox.checked) {
        localStorage.setItem("openaiApiKey", openaiApiKey);
        dom.openaiApiKeyInput.value = openaiApiKey;
    }
});

dom.anthropicApiKeyInput.addEventListener("blur", () => {
    const anthropicApiKey = dom.anthropicApiKeyInput.value.trim();
    Model.updateProviderVisibility();

    if (anthropicApiKey && dom.saveKeyCheckbox.checked) {
        localStorage.setItem("anthropicApiKey", anthropicApiKey);
        dom.anthropicApiKeyInput.value = anthropicApiKey;
    }
});

dom.saveKeyCheckbox.addEventListener("change", (e) => {
    localStorage.setItem("saveApiKey", e.target.checked ? "1" : "0");
    if (!e.target.checked) {
        localStorage.removeItem("openaiApiKey");
        localStorage.removeItem("anthropicApiKey");
    } else {
        if (dom.openaiApiKeyInput.value.trim()) {
            localStorage.setItem("openaiApiKey", dom.openaiApiKeyInput.value.trim());
        }
        if (dom.anthropicApiKeyInput.value.trim()) {
            localStorage.setItem("anthropicApiKey", dom.anthropicApiKeyInput.value.trim());
        }
    }
});

dom.fontSelect.addEventListener("change", (e) => {
    const font = e.target.value;
    document.documentElement.classList.remove("mono", "slab", "serif");
    document.documentElement.classList.add(font);

    localStorage.setItem("font", font);
});

dom.themeSelect.addEventListener("change", (e) => {
    let theme = e.target.value;

    if (theme === "system") {
        theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);

    localStorage.setItem("theme", theme);
});

dom.systemPromptInput.addEventListener("blur", () => {
    localStorage.setItem("systemPrompt", dom.systemPromptInput.value.trim());
});

dom.temperatureInput.addEventListener("input", (e) => {
    const temperature = e.target.value;
    dom.temperatureValue.innerText = temperature;
    localStorage.setItem("temperature", temperature);
});

dom.hue.addEventListener("input", (e) => {
    const hue = e.target.value;
    document.documentElement.style.setProperty("--hue", hue);
    localStorage.setItem("hue", hue);
    dom.hueValue.innerText = hue;
});

dom.saturation.addEventListener("input", (e) => {
    const saturation = e.target.value;
    document.documentElement.style.setProperty("--saturation", `${saturation}%`);
    localStorage.setItem("saturation", saturation);
    dom.saturationValue.innerText = saturation;
});

// model settings
dom.modelSettingsPopup.addEventListener("click", (e) => {
    if (e.target === dom.modelSettingsPopup) {
        dom.modelSettingsPopup.classList.add("hidden");
    }
});

// service worker for PWA
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").then(
        (reg) => {},
        (err) => console.error("SW failed", err)
    );
}
