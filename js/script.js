const profiles = [
    { name: "Luca", description: "Studente di ingegneria, cerca coinquilino tranquillo", img: "img/luca.jpg" },
    { name: "Sofia", description: "Ama i gatti, ordinata, non fuma", img: "img/sofia.jpg" },
    { name: "Marco", description: "Lavora in smart working, cerca ambiente sereno", img: "img/marco.jpg" }
];

let currentIndex = 0;

function showProfile(index) {
    const profileContainer = document.querySelector(".profile-card");
    profileContainer.innerHTML = `
        <div class="profile-images">
            <img src="${profiles[index].img}" alt="${profiles[index].name}" style="width: 100%; height: 100%; border-radius: 10px;">
        </div>
        <div class="profile-info" style="margin-top: 1rem; text-align: center;">
            <h2>${profiles[index].name}</h2>
            <p>${profiles[index].description}</p>
        </div>
    `;
}

function nextProfile() {
    currentIndex++;
    if (currentIndex >= profiles.length) {
        alert("Nessun altro profilo disponibile");
        currentIndex = 0;
    }
    showProfile(currentIndex);
}

document.addEventListener("DOMContentLoaded", () => {
    showProfile(currentIndex);

    document.querySelector(".btn-reject").addEventListener("click", nextProfile);
    document.querySelector(".btn-accept").addEventListener("click", nextProfile);
});



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

document.addEventListener("DOMContentLoaded", () => {
    const sendButton = document.querySelector(".send-btn");
    const inputField = document.getElementById("chat-input");

    sendButton.addEventListener("click", sendMessage);

    // Invio anche premendo Enter
    inputField.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            sendMessage();
        }
    });
});
