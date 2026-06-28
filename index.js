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





app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});

module.exports = app;