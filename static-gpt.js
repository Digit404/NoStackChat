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

apiKeyButton.addEventListener('click', () => {
    apiKeyBlock.classList.toggle('collapsed');
});

// resize prompt field on input
promptInput.addEventListener('input', () => {
    promptInput.style.height = 'auto';
    promptInput.style.height = `${promptInput.scrollHeight}px`;
});

// send on enter key press
promptInput.addEventListener('keydown', e => {
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

    const message = document.createElement('div');
    message.className = 'message user';
    message.innerText = prompt;

    messagesDiv.insertBefore(message, endSpacer);
});