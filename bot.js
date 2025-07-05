const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, delay } = require('@whiskeysockets/baileys');
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');
const player = require('play-sound')();
const fs = require('fs');
const P = require('pino');

const CHANNEL_LINK = 'https://whatsapp.com/channel/0029VapeRwaLikg710DWS41q';

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        logger: P({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection }) => {
        if (connection === 'open') {
            console.log('✅ Bot connected!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || '';

        await sock.sendPresenceUpdate('composing', from);
        await delay(1000);

        if (text.toLowerCase().startsWith('.play')) {
            const query = text.substring(5).trim();
            if (!query) {
                await sock.sendMessage(from, { text: `🎵 Please provide a song or artist name. Example:\n.play Burna Boy` });
                return;
            }

            await sock.sendMessage(from, { text: `🔎 Searching YouTube for: *${query}*` });

            const results = await ytSearch(query);
            const video = results.videos.length > 0 ? results.videos[0] : null;

            if (!video) {
                await sock.sendMessage(from, { text: `❌ No results found for: *${query}*` });
                return;
            }

            await sock.sendMessage(from, { text: `🎶 Now playing: *${video.title}*\n🔗 ${video.url}` });

            const stream = ytdl(video.url, { filter: 'audioonly' });
            const output = `song-${Date.now()}.mp3`;

            stream.pipe(fs.createWriteStream(output)).on('finish', () => {
                console.log('🎵 Music downloaded:', output);

                player.play(output, (err) => {
                    if (err) console.error(err);
                    fs.unlinkSync(output); // delete after playing
                });
            });

        } else {
            await sock.sendMessage(from, { text: `🤖 Thanks! Join my channel: ${CHANNEL_LINK}` });
        }
    });

    sock.ev.on('messages.update', updates => {
        for (const u of updates) {
            if (u.status === 3) {
                sock.readMessages([u.key]);
                console.log('👀 Viewed status of', u.key.remoteJid);
            }
        }
    });
}

startBot();
