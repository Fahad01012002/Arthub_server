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

app.get('/api/user-transaction-history/:buyerId', verifyToken, async (req, res) => {
    try {
        const { buyerId } = req.params;

        const transactions = await transactionCollection.find({
            buyerId: buyerId,
            status: "success",
            $or: [
                { type: "Purchase" },
                { type: "Subscription" }
            ]
        }).sort({ createdAt: -1 }).toArray();

        // ইউজার যদি কোনো কেনাকাটা বা সাবস্ক্রিপশন না করে থাকে, তবে খালি অ্যারে রিটার্ন করবে
        if (!transactions || transactions.length === 0) {
            return res.status(200).json([]);
        }

        // ২. ট্রানজেকশনগুলো থেকে শুধুমাত্র ভ্যালিড artworkId গুলো ফিল্টার করে একটি অ্যারে তৈরি করা
        const artworkIds = transactions
            .filter(item => item.artworkId && ObjectId.isValid(item.artworkId))
            .map(item => new ObjectId(item.artworkId));

        // ৩. যদি ভ্যালিড artworkId থেকে থাকে, তবে একবারে paintingCardCollection থেকে সব আর্টওয়ার্কের ডিটেইলস নিয়ে আসা
        let artworksMap = {};
        if (artworkIds.length > 0) {
            const artworks = await paintingCardCollection.find({
                _id: { $in: artworkIds }
            }).toArray();

            // ডাটা সহজে ম্যাচ করার জন্য একটি অবজেক্ট ম্যাপ (Map) তৈরি করা যেন লুপের ভেতর বারবার ডাটাবেজ হিট না হয়
            artworksMap = artworks.reduce((acc, art) => {
                acc[art._id.toString()] = art;
                return acc;
            }, {});
        }

        // ৪. ট্রানজেকশন ডাটা এবং আর্টওয়ার্ক ডিটেইলস কম্বাইন করে ফ্রন্টএন্ডের টেবিল ডিজাইনের উপযোগী ফরম্যাট তৈরি করা
        const transactionHistory = transactions.map((tx, index) => {
            // ট্রানজেকশনের artworkId দিয়ে ম্যাপ থেকে নির্দিষ্ট আর্টওয়ার্কের ডাটা খুঁজে বের করা
            const associatedArtwork = tx.artworkId ? artworksMap[tx.artworkId.toString()] : null;

            // ISO ডেট ফরম্যাট (2026-06-23T08:00:59...) থেকে শুধুমাত্র YYYY-MM-DD ফরম্যাটে ডেট আলাদা করা
            const formattedDate = tx.createdAt
                ? new Date(tx.createdAt).toISOString().split('T')[0]
                : "N/A";

            return {
                _id: tx._id,
                // আপনার UI ডিজাইন অনুযায়ী সুন্দর সিরিয়াল TXN আইডি জেনারেট করা (যেমন: TXN-001, TXN-002)
                transactionId: `TXN-${String(index + 1).padStart(3, '0')}`,

                // যদি আর্টওয়ার্ক থাকে তবে তার টাইটেল, নতুবা সাবস্ক্রিপশন প্ল্যানের নাম (যেমন: Premium Plan)
                artworkName: associatedArtwork ? associatedArtwork.title : (tx.planName || "Premium Subscription"),

                // আর্টওয়ার্ক থাকলে আর্টিস্টের নাম, না থাকলে সাবস্ক্রিপশনের জন্য 'System'
                artistName: associatedArtwork ? "Leila Nasser" : "System",

                // ট্রানজেকশনের অ্যামাউন্ট, কোনো কারণে অ্যামাউন্ট না থাকলে আর্টওয়ার্কের ডিফল্ট প্রাইস
                price: tx.amount || (associatedArtwork ? associatedArtwork.price : 0),
                date: formattedDate,

                // স্ট্যাটাস 'success' হলে UI-তে 'Completed' দেখাবে
                status: tx.status === "success" ? "Completed" : tx.status,
                type: tx.type // 'Purchase' নাকি 'Subscription' তা ট্র‍্যাক রাখার জন্য
            };
        });

        // ৫. ফাইনাল কম্বাইন্ড ডাটা রেসপন্স পাঠানো
        res.status(200).json(transactionHistory);

    } catch (error) {
        console.error("Error fetching transaction history:", error);
        res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
});

app.patch('/api/update-status/:artworkId', verifyToken, async (req, res) => {
    const id = req.params.artworkId;
    const updatedStatus = req.body;

    const filter = {
        _id: new ObjectId(id)
    }

    const updateDoc = {
        $set: {
            Status: updatedStatus?.status
        }
    }

    const result = await paintingCardCollection.updateOne(filter, updateDoc);
    res.send(result);
})

app.get('/api/user/:userId', verifyToken, async (req, res) => {
    const id = req.params.userId;

    const filter = {
        _id: new ObjectId(id)
    }

    const result = await userCollection.findOne(filter);
    res.send(result);
})

app.get('/api/artwork-transaction/:userId', verifyToken, async (req, res) => {
    const id = req.params.userId;

    const filter = {
        userId: id
    }

    const result = await transactionCollection.find(filter).toArray();
    res.send(result);
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});

module.exports = app;