const express = require('express');
const app = express();
const port = 5000;

const cors = require('cors');
require('dotenv').config();

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = process.env.MONGO_URI;



app.get('/', (req, res) => {
    res.send('Hello World!');
});


const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

client.connect(() => {
    console.log('conecting to MongoDb');
}).catch(console.dir)

const database = client.db("art_hub_db");
const paintingCardCollection = database.collection('paintingCard');
const userCollection = database.collection('user');
const planCollection = database.collection('plans');
const transactionCollection = database.collection('transactions');
const sessionCollection = database.collection('session');


const verifyToken = async (req, res, next) => {

    const headers = req.headers?.authorization;

    if (!headers) {
        return res.status(401).send({
            messagte: 'Unauthorized access'
        })
    }

    const token = headers.split(' ')[1];

    if (!token) {
        return res.status(401).send({
            message: 'Unauthorised Access'
        })
    }

    const query = {
        token: token
    }
    const session = await sessionCollection.findOne(query);
    const userId = session.userId;

    const userQuery = {
        _id: userId
    }

    const user = await userCollection.findOne(userQuery);
    req.user = user;
    next();
}

const verifyAdmin = async (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).send({ message: 'Forbidden Access' })
    }
    next();
}

const verifyArtist = async (req, res, next) => {

    if (req.user?.role !== 'artist') {
        return res.status(403).send({ message: 'Forbidden Access' })
    }

    next();
}

const verifyUser = async (req, res, next) => {

    if (req.user?.role !== 'user') {
        return res.status(403).send({ message: 'Forbidden Access' })
    }

    next();
}

app.get('/api/artworks', async (req, res) => {
    const cursor = paintingCardCollection.find();
    const result = await cursor.toArray();

    res.json(result);
})

app.get('/api/all-users', verifyToken, async (req, res) => {
    const cursor = userCollection.find();
    const result = await cursor.toArray();

    res.send(result);
})

app.get('/api/artwork-details/:id', async (req, res) => {

    try {
        const id = req.params.id;

        const filter = {
            _id: new ObjectId(id)
        };

        const artwork = await paintingCardCollection.findOne(filter);

        if (!artwork) {
            return res.status(404).send({ message: "Artwork not found" });
        }

        const userFilter = {
            _id: new ObjectId(artwork.userId)
        };

        const artist = await userCollection.findOne(userFilter);

        artwork.artistName = artist?.name || "Unknown Artist";
        artwork.plan = artist?.plan || "user_free";

        res.send(artwork);

    } catch (error) {
        res.status(500).send({
            message: error.message || "Server Error"
        });
    }
});

app.get('/api/plans/:id', verifyToken, async (req, res) => {
    const planId = req.params.id;

    const filter = {
        id: planId
    }

    const cursor = await planCollection.findOne(filter);
    res.send(cursor);

})

app.get('/api/transaction-history', verifyToken, async (req, res) => {
    const cursor = transactionCollection.find();
    const result = await cursor.toArray();

    res.send(result);
})

app.post('/api/artistcard', verifyToken, async (req, res) => {
    const data = req.body;

    const cardInfo = {
        ...data,
        createdAt: new Date()
    }

    const result = await paintingCardCollection.insertOne(cardInfo);
    res.send(result);
})





app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});

module.exports = app;