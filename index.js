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



app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});

module.exports = app;