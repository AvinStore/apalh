const {
    default: makeWaSocket,
    DisconnectReason,
    useMultiFileAuthState,
    Browsers,
    client
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const inquirer = require("inquirer");

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
    const sock = makeWaSocket({
        logger: pino({ level: "fatal" }),
        auth: state,
        printQRInTerminal: false,
        defaultQueryTimeoutMs: undefined,
        keepAliveIntervalMs: 30000,
        browser: Browsers.macOS("Edge"),
        shouldSyncHistoryMessage: () => false,
        markOnlineOnConnect: true,
        syncFullHistory: false,
        generateHighQualityLinkPreview: true,
    });

    let useCode = { isTrue: true };

    if (useCode.isTrue && !sock.authState.creds.registered) {
        const { isTrue } = await inquirer.prompt({
            type: "confirm",
            name: "isTrue",
            message: "Terhubung pairing Code?",
            default: true
        });

        if (isTrue) {
            const { res } = await inquirer.prompt({
                type: "input",
                name: "res",
                message: "Masukan Nomor WA Anda:"
            });
            // Use 'res' directly to request the pairing code
            const code = await sock.requestPairingCode(res);
            console.log("Pairing Code:", code);
        } else {
            useCode.isTrue = false;
            return connectToWhatsApp(); // Exit and restart
        }
    }

    sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
        if (connection === "close") {
            const shouldReconnect =
                lastDisconnect.error?.output.statusCode !==
                DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log("Masukan Lagi Sayang");
                connectToWhatsApp();
            }
        }
        if (connection === "open") {
            console.log("Masuk Sayang");
        }
    });

    sock.ev.on("creds.update", saveCreds);
    //Event message
    sock.ev.on('messages.upsert', ({ messages }) => {
        const msg = messages[0];
        // Jika bukan sebuah pesan text atau media kita abaikan saja
        if(!msg.message) return;
        console.log(msg);
        // message Jid
        msg.jid = msg.key.remoteJid;
        // jika sebuah status kita tambahkan auto read
        if(msg.jid === "status@broadcast") return sock.readMessages([messages[0].key]);
        // message from group
        msg.isGroup = msg.jid.endsWith("@g.us");
        //user jid
        msg.userjid = msg.isGroup ? msg.key.participant : msg.key.remoteJid //atau msg.jid
        //nama dari profile pengirim
        msg.userName = msg.pushName;
        //jika pesan dari bot
        msg.fromMe = msg.key.fromMe;
        //type dari sebuah pesan
        msg.type = Object.keys(msg.message)[0];
        //pesan text
        msg.text = msg.type === "extendedTextMessage" ? msg.message.extendedTextMessage.text : msg.type === "conversation" ? msg.message.conversation : "";
        
        console.log(msg);
        //sock.readMessages([messages[0].key])
        console.log(msg);
    //});
    //sock.ev.on("call", (call) => {
        //sock.rejectCall(call[0].id, call[0].from);
        //console.log(call)
    });
}

connectToWhatsApp();