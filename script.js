function openChat() {
    const panel = document.getElementById("chat-panel");
    panel.classList.remove("closing");
    panel.classList.add("open");
}

function closeChat() {
    const panel = document.getElementById("chat-panel");
    panel.classList.remove("open");
    panel.classList.add("closing");

    // Aspetta che finisca l'animazione prima di nascondere
    setTimeout(() => {
        panel.classList.remove("closing");
    }, 300);
}

function sendMessage() {
    const input = document.getElementById("chat-input");
    const messageText = input.value.trim();
    if (messageText === "") return;

    const messagesContainer = document.querySelector(".chat-messages");

    const message = document.createElement("div");
    message.className = "message sent";
    message.innerHTML = `<strong>Tu:</strong> ${messageText}`;
    messagesContainer.appendChild(message);

    input.value = "";
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
