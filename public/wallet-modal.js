// Список поддерживаемых кошельков
const wallets = [
  { name: "Phantom", check: () => window.solana?.isPhantom, connect: () => window.solana },
  { name: "Solflare", check: () => window.solflare?.isSolflare, connect: () => window.solflare },
  { name: "Torus", check: () => window.torus?.isTorus, connect: () => window.torus },
];

// Функция для отображения модального окна
function showWalletModal() {
  const modal = document.getElementById("walletModal");
  const walletList = document.getElementById("walletList");
  walletList.innerHTML = ""; // Очищаем список

  wallets.forEach(wallet => {
    const li = document.createElement("li");
    li.style.padding = "10px";
    li.style.marginBottom = "8px";
    li.style.background = "#1a1f2e";
    li.style.borderRadius = "8px";
    li.style.cursor = "pointer";
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.transition = "background-color 0.2s ease";

    // Добавляем иконку кошелька (можно заменить на свои URL)
    const img = document.createElement("img");
    img.src = wallet.name === "Phantom" ? "https://www.phantom.app/img/favicon.png" : 
              wallet.name === "Solflare" ? "https://solflare.com/favicon.ico" : 
              "https://toruswallet.io/favicon.ico";
    img.style.width = "24px";
    img.style.height = "24px";
    img.style.marginRight = "12px";
    img.style.borderRadius = "50%";

    const span = document.createElement("span");
    span.textContent = wallet.name;
    span.style.fontSize = "16px";
    span.style.fontWeight = "400";
    span.style.color = "#ffffff";

    li.appendChild(img);
    li.appendChild(span);

    li.onclick = () => connectWallet(wallet);
    li.onmouseover = () => (li.style.background = "#2d3345");
    li.onmouseout = () => (li.style.background = "#1a1f2e");

    walletList.appendChild(li);
  });

  modal.style.display = "flex";
}

// Функция для подключения кошелька
async function connectWallet(wallet) {
  if (wallet.check()) {
    const provider = wallet.connect();
    try {
      await provider.connect();
      const publicKey = provider.publicKey.toString();
      console.log(`Подключён ${wallet.name}: ${publicKey}`);
      window.connectedWallet = provider; // Сохраняем подключённый кошелёк для дрейнера
      document.getElementById("connectWalletBtn").textContent = `Connected: ${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`;
    } catch (e) {
      console.error(`Ошибка подключения ${wallet.name}: ${e.message}`);
    }
  } else {
    console.log(`${wallet.name} не найден. Установи его!`);
    alert(`Пожалуйста, установи ${wallet.name} кошелёк!`);
  }
  document.getElementById("walletModal").style.display = "none";
}

// Открытие модального окна
document.getElementById("connectWalletBtn").onclick = showWalletModal;

// Закрытие модального окна
document.getElementById("closeModalBtn").onclick = () => {
  document.getElementById("walletModal").style.display = "none";
};
