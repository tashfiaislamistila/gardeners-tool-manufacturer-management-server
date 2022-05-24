const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000

app.use(cors());
app.use(express.json());

const uri = "mongodb+srv://tool_admin:<password>@cluster0.xt38z.mongodb.net/?retryWrites=true&w=majority";

app.get('/', (req, res) => {
    res.send('Hello from gardeners tool management !')
})

app.listen(port, () => {
    console.log(`gardeners tool management App listening on port ${port}`)
})