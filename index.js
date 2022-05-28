const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xt38z.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

//verifyJwt middleware function
function verifyJwt(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized Access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        await client.connect();
        const toolCollection = client.db('gardenres_tool_management').collection('tools');
        const orderCollection = client.db('gardenres_tool_management').collection('orders');
        const userCollection = client.db('gardenres_tool_management').collection('users');
        const reviewCollection = client.db('gardenres_tool_management').collection('reviews');
        const paymentCollection = client.db('gardenres_tool_management').collection('payments');
        const profileCollection = client.db('gardenres_tool_management').collection('profiles');

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            }
            else {
                res.status(403).send({ message: 'Forbidden' });
            }
        }

        //tools API
        app.get('/tools', async (req, res) => {
            const query = {};
            const cursor = toolCollection.find(query);
            const tools = await cursor.toArray();
            res.send(tools);
        });

        app.post('/tools', async (req, res) => {
            const product = req.body;
            const result = await toolCollection.insertOne(product);
            res.send(result);
        })

        //get single tools API
        app.get('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const tool = await toolCollection.findOne(query);
            res.send(tool);
        });
        //PUT
        app.put('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const updateQuantity = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedTools = {
                $set: {
                    availableQuantity: updateQuantity.availableQuantity,
                }
            };
            const result = await toolCollection.updateOne(filter, updatedTools, options);
            res.send(result);
        });

        //for my profile put data from body
        app.put('/profiles/:email', async (req, res) => {
            const email = req.params.email;
            const profiles = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updatedDoc = {
                $set: profiles,
            };
            const result = await profileCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        });

        //create review api for db
        app.get('/reviews', async (req, res) => {
            const query = {};
            const cursor = reviewCollection.find(query);
            const reviews = await cursor.toArray();
            res.send(reviews);
        });
        //insert one by one review in collection
        app.post('/reviews', async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send({ success: true, result });
        })

        //delete api tools
        app.delete('/tools/:id', verifyJwt, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await toolCollection.deleteOne(filter);
            res.send(result);
        });

        //add product api when i add tools from font end this api help to add data in backend 
        app.post('/orders', verifyJwt, verifyAdmin, async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            res.send(result);
        });


        //delete api when i want to delete tools from font end this api help to data data from backend 
        app.delete('/orders/:id', verifyJwt, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(filter);
            res.send(result);
        });

        //api for particular user
        app.get('/orders', verifyJwt, async (req, res) => {
            const customerEmail = req.query.customerEmail;
            const decodedEmail = req.decoded.email;
            if (decodedEmail == decodedEmail) {
                const query = { customerEmail: customerEmail };
                const purchases = await orderCollection.find(query).toArray();
                return res.send(purchases);
            }
            else {
                return res.status(403).send({ message: 'Forbidden access' });
            }
        });
        //get Api for manage orders by admin
        app.get('/manageOrders', verifyJwt, verifyAdmin, async (req, res) => {
            const manageOrders = await orderCollection.find().toArray();
            res.send(manageOrders)
        })
        //particular order for payment api with get
        app.get('/orders/:id', verifyJwt, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const orders = await orderCollection.findOne(query);
            res.send(orders);
        })


        app.get('/users', verifyJwt, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users)
        })


        //which user login is admin check this
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })

        //make admin 
        app.put('/user/admin/:email', verifyJwt, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        })
        // insert and update user for login
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token });
        });
        //payment intent API create
        app.post('/create-payment-intent', verifyJwt, async (req, res) => {
            const tools = req.body;
            const totalPrice = tools.totalPrice;
            const amount = totalPrice * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        });

        //updated client payment information by patch
        app.patch('/orders/:id', verifyJwt, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            // console.log(payment);
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: payment.status,
                    paid: true,
                    transactionId: payment.transactionId,

                }
            }
            const result = await paymentCollection.insertOne(payment);
            const updatedOrder = await orderCollection.updateOne(filter, updatedDoc);
            res.send(updatedDoc);

        })
    }
    finally {

    }
}

run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello from gardeners tool management !')
})
//test
app.get('/test', (req, res) => {
    res.send('test!!')
})

app.listen(port, () => {
    console.log(`gardeners tool management App listening on port ${port}`)
})