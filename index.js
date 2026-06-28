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

app.patch('/api/update-purchase-count/:userId', verifyToken, async (req, res) => {
    const id = req.params.userId;
    const upadatedUser = req.body;

    const filter = {
        _id: new ObjectId(id)
    }

    const updatedDoc = {
        $inc: {
            purchaseCount: 1
        }
    }

    const result = await userCollection.updateOne(filter, updatedDoc);
    res.send(result);
})

app.patch('/api/update-user-details/:userId', verifyToken, async (req, res) => {
    const id = req.params.userId;
    const { name, email } = req.body;

    const filter = {
        _id: new ObjectId(id)
    }

    const updateDoc = {
        $set: {
            name: name,
            email: email
        }
    }

    const result = await userCollection.updateOne(filter, updateDoc);
    res.send(result);
})

app.get('/api/user-purchased-artworks/:buyerId', verifyToken, async (req, res) => {
    try {
        const { buyerId } = req.params;

        // ১. ট্রানজেকশন কালেকশন থেকে ওই buyerId এর সব সফল ('success') কেনাকাটার ডাটা বের করা
        const transactions = await transactionCollection.find({
            buyerId: buyerId,
            status: "success",
            type: "Purchase"
        }).toArray();

        // ইউজার যদি এখনও কিছু না কিনে থাকে
        if (!transactions || transactions.length === 0) {
            return res.status(200).send([]);
        }

        // ২. সব ট্রানজেকশন থেকে artworkId গুলো বের করে একটা Clean Array তৈরি করা
        // এবং সেগুলোকে MongoDB এর 'ObjectId' তে কনভার্ট করা
        const artworkIds = transactions.map(item => new ObjectId(item.artworkId));

        // ৩. $in অপারেটর দিয়ে একবারে সব আর্টওয়ার্কের ডিটেইলস নিয়ে আসা
        const purchasedArtworks = await paintingCardCollection.find({
            _id: { $in: artworkIds }
        }).toArray();

        // ৪. ফ্রন্টএন্ডে একবারে সব আর্টওয়ার্কের ডিটেইলস অ্যারে আকারে রেসপন্স পাঠানো
        res.status(200).send(purchasedArtworks);

    } catch (error) {
        console.error("Error fetching purchased artworks:", error);
        res.status(500).send({ message: "Internal server error", error: error.message });
    }
});



app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});

module.exports = app;