const express = require('express');
var cors = require('cors')
const RabbitConnection = require("./rabbitConnection");
var rabbitmq = new RabbitConnection();

const app = express();
const port = 3000

app.use(express.json());
app.use(cors());

app.use((req, res, next) => {
    if (req.path == "/api/login" && req.method == 'POST') return next();
    if (req.path == "/api/logout" && req.method == 'POST') return next();

    if (req.headers["x-user-id"]) {
        req.user = req.headers["x-user-id"];
        if (rabbitmq.GetCurrentUser(req.user))
            return next();
    }
    
    res.status(401).send({ error: "Unauthorized." });
})

app.post('/api/login', async (req, res) => {
    var userName = req.body.userName;
    if (!userName || userName.length < 4 || userName.length > 16)
        return res.status(400).send({ error: "Nome de usuário inválido. Mínimo 4 caracteres, máximo 16 caracteres." });

    try {
        var user = await rabbitmq.SetCurrentUser(userName);
        res.status(200).send(user);
    }
    catch (err) {
        res.status(400).send({ error: err.message });
    }
});

app.get('/api/user', (req, res) => {
    var user = rabbitmq.GetCurrentUser(req.user);
    if (user)
        res.status(200).send(user);
    else res.status(404).send({ error: "Usuário não encontrado." });
})

app.post('/api/chat', (req, res) => {
    var chat = req.body.chat;
    if (!user || !user.startsWith("@") || user.length < 5 || user.length > 17)
        return res.status(400).send({ error: "Chat inválido. Mínimo 5 caracteres, máximo 17 caracteres." });

    rabbitmq.SetCurrentChat(req.user, chat);
    res.status(200).send();
});

app.post('/api/message', (req, res) => {
    var message = req.body.message;
    var chat = req.body.to;
    if (!message || message.length > '500')
        return res.status(400).send({ error: "Mensagem não fornecida ou muito longa." });

    var chatExists = rabbitmq.ListChats().find(c => c === chat);
    if (!chatExists)
        return res.status(400).send({ error: "Destinatário não encontrado." })

    try {
        rabbitmq.PublishToChatUser(req.user, chat, message);
        res.sendStatus(202);
    }
    catch (err) {
        res.status(422).send({ error: err.message });
    }
});

app.get('/api/chats', (req, res) => {
    var chats = rabbitmq.ListChats();
    res.send({ chats });
})

app.post('/api/logout', (req, res) => {
    rabbitmq.RemoveUser(req.user);
    res.status(200).send();
})

app.listen(port, () => {
  console.log(`Server online!`);
})
