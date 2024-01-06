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
    if (req.path == "/api/basic" && req.method == 'GET') return next();

    if (req.headers["x-user-id"]) {
        req.user = req.headers["x-user-id"];
        if (rabbitmq.GetCurrentUser(req.user))
            return next();
        else if (req.path == "/api/logout" && req.method == 'POST')
            return next();
    }else if (req.path == "/api/logout" && req.method == 'POST')
        return next();
    
    res.status(401).send({ error: "Unauthorized." });
})

app.get("/api/basic", (req, res) => {
    var query = req.query.from;
    if (!query || query !== "bZelXcVrsRHHYVCdwaT7dvECG5vxpX3KdWAFmwI8zyugl2Ovhjp34aefkBRlduAUNzZlVZ08STr6xU20JTscwkcRW3dFScuuTjjJjFVB4kTuezpam9uhDJDBQ37PITH2rVriJXc958uPEfvmPAXwwEwazjgiKfXuRJ2ETZmdMzwoD6iEGZv6xIu7qg5WfbRF6s1LpriNQ2ZND0dguPrKMDfofwSG10UzIaJ2CoCJpshgytXIF2DZNMaoQ0vUkA7pDEacsmJf4POx2wSgKw6KHxJJTJCn8TUIpcf8FQIQS2tlV27zPoV5Eho7IQFlo9mR")
        return res.status(404).send();

    var data = { HOST: 'ws://ws.rabbitmq.projetosufs.cloud/ws', USER: 'rabbit_client', PWD: 'AK5NQZK7cD2R9YqT*', DATE: new Date() };
    var b64 = Buffer.from(JSON.stringify(data)).toString('base64');
    var b64s = b64.slice(0, 1) + "scwkcRW3dFScuuTjjJ" + b64.slice(1);
    var final = b64s.slice(0, 18+17) + "vECG5vxpX3KdWAFmwI8zyu" + b64s.slice(18+17);
    
    return res.send(final);
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
