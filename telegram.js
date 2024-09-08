const { Telegraf } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf('API_Key');

// Function to register user
async function registerUser(ctx, playerId) {
    try {
        const response = await axios.post('http://212.47.228.161:3000/api/set_user_data', {
            name: ctx.from.first_name,
            playerId: playerId,
            telegramId: ctx.from.id.toString(),
            tonAddress: null
        });
        return true;
    } catch (error) {
        console.error('Error registering user:', error);
        return false;
    }
}

bot.start(async (ctx) => {
    const startParam = ctx.startPayload;
    if (startParam) {
        if (await registerUser(ctx, startParam)) {
            await ctx.reply('You have been registered. Please enter your TON address:');
        } else {
            await ctx.reply('An error occurred during registration. Please try again.');
        }
    } else {
        await ctx.reply('Welcome! Please scan the QR code from the terminal to start.');
    }
});

bot.on('text', async (ctx) => {
    try {
        const response = await axios.get(`http://212.47.228.161:3000/api/check_player/${ctx.from.id}`);
        const userExists = response.data.exists;

        if (userExists) {
            const tonAddress = ctx.message.text.trim();
            if (tonAddress.startsWith('EQ') || tonAddress.startsWith('UQ')) {
                try {
                    // Get the user's playerId from the database
                    const userResponse = await axios.get(`http://212.47.228.161:3000/api/get_user/${ctx.from.id}`);
                    const playerId = userResponse.data.playerId;

                    await axios.post('http://212.47.228.161:3000/api/set_user_data', {
                        name: ctx.from.first_name,
                        playerId: playerId,
                        telegramId: ctx.from.id.toString(),
                        tonAddress: tonAddress
                    });
                    
                    await ctx.reply('Your TON address has been successfully registered!');
                } catch (error) {
                    console.error('Error setting TON address:', error);
                    await ctx.reply('An error occurred while registering your TON address. Please try again later.');
                }
            } else {
                await ctx.reply('Invalid TON address. It should start with EQ or UQ. Please try again.');
            }
        } else {
            await ctx.reply('You are not registered. Please scan the QR code from the terminal to start.');
        }
    } catch (error) {
        console.error('Error checking user existence:', error);
        await ctx.reply('An error occurred. Please try again later.');
    }
});

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));