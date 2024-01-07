const amqplib = require('amqplib');
const { randomUUID }  = require('node:crypto');

const HOST = process.env.SD_RABBITMQ_HOST;
const USER = process.env.SD_RABBITMQ_USER;
const PWD = process.env.SD_RABBITMQ_PWD;
const EXCHANGE_DIRECT = "chatmq";

module.exports = class RabbitConnection {
    constructor() {
        this.connection = null;
        this.channel = null;
        this.users = [];
        this.Connect();
    }

    async Connect() {
        const opt = { credentials: require('amqplib').credentials.plain(USER, PWD) };
        this.connection = await amqplib.connect(`amqp://${HOST}/chat_sd`, opt);
        this.channel = await this.connection.createChannel();
        this.channel.assertExchange(EXCHANGE_DIRECT, "direct", { durable: true });
        if (this.connection) console.log("RabbitMQ Connected!");
    }

    AddQueueUser(user) {
        var userQueue = `@${user.toLowerCase()}`;
        this.channel.assertQueue(userQueue, { durable: true });
        this.channel.bindQueue(userQueue, EXCHANGE_DIRECT, userQueue);
    }

    SetCurrentUser(currentUser) { 
        var userExists = this.users.findIndex(u => u.currentUser?.toLowerCase() === currentUser.toLowerCase());
        if (userExists == -1) {
            var newUser = {
                id: randomUUID(),
                currentUser: currentUser,
                currentChat: null
            }
            this.users.push(newUser);
            this.AddQueueUser(newUser.currentUser);
            return newUser;
        }
        else throw new Error("Usuário já logado.");
    }
    GetCurrentUser(userId) { return this.users.find(u => u.id == userId); }

    SetCurrentChat(userId, currentChat) {
        var user = this.GetCurrentUser(userId);
        if (user) {
            user.currentChat = currentChat.toLowerCase();
        }
        else throw new Error("Usuário logado não encontrado");
    }
    GetCurrentChat(currentUser) { return this.GetCurrentUser(currentUser)?.currentChat?.toLowerCase() }

    RemoveUser(userId) {
        var userIndex = this.users.findIndex(u => u.id === userId);
        if (userIndex > -1) {
            this.users.splice(userIndex, 1);
        }
    }

    PublishToCurrentChat(userId, message) {
        var user = this.GetCurrentUser(userId);
        if (user) {
            var obj = {
                sender: this.currentUser,
                date: new Date().ToLocaleString('pt-br', { timeZone: 'America/Sao_Paulo' }),
                message
            }
    
            var body = JSON.stringify(obj);
            if (user.currentChat)
                this.channel.publish(EXCHANGE_DIRECT, user.currentChat.toLowerCase(), Buffer.from(body));
        }
        else throw new Error("401");
    }

    PublishToChatUser(userId, chat, message) {
        var user = this.GetCurrentUser(userId);
        
        if (`@${user.currentUser?.toLowerCase()}` === chat)
            throw new Error("Não é possível mandar uma mensagem para sí mesmo.");
        
        var now = new Date();
        if (user) {
            var obj = {
                sender: user.currentUser,
                date: now.toLocaleString('pt-br', { timeZone: 'America/Sao_Paulo' }),
                message
            }
            var body = JSON.stringify(obj);
            this.channel.publish(EXCHANGE_DIRECT, chat.toLowerCase(), Buffer.from(body));
        }
        else throw new Error("401");
    }

    ListChats() {
        return this.users.map(u => `@${u.currentUser.toLowerCase()}`);
    }
}
