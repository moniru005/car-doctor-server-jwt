const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId, MaxKey } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const port = process.env.PORT || 5000;
const app = express();

app.use(express.json());
app.use(cors({
  origin:['http://localhost:5173'],
  credentials: true
}));
app.use(cookieParser());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.t2hcl8v.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

//middlewares
const logger = (req, res, next) =>{
  console.log('log: info', req.method, req.url);
  next(); // use next function: going to next step after checking by middleware
}

const verifyToken = (req, res, next) =>{
  const token = req?.cookies?.token; // access token from cookies
  // console.log('token in the middleware', token);
  if(!token){
    return res.status(401).send({message: 'Unauthorized access'})
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) =>{
    if(err){
      return res.status(401).send({message: 'Unauthorized Access'})
    }
    req.user = decoded;
    next();
  })
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
     client.connect();

    const serviceCollection = client.db("carDoctor").collection("services");
    const bookingCollection = client.db("carDoctor").collection("bookings");


    //Auth related API
    app.post('/jwt', logger, async(req, res) =>{
      const user = req.body;
      console.log('user for token', user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '10h'})
      res
      .cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none'
      })
      .send({success: true});
    })
    
    app.post('/logout', async(req, res) =>{
      const user = req.body;
      console.log('logging out', user);
      res.clearCookie('token', {maxAge: 0} ).send({success: true})
    })


    //Services related API
    app.get("/services", async (req, res) => {
      const services = await serviceCollection.find().toArray();
      res.send(services);
      // console.log(services);
    });

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = {
        projections: { title: 1, price: 1, service_id: 1 },
      };
      const result = await serviceCollection.findOne(query, options);
      res.send(result);
    });

     //Bookings
     app.get('/bookings', logger, verifyToken, async(req, res) => {
      console.log(req.query.email);
      console.log('Token owner info:', req.user);
      if(req.user.email !== req.query.email){
        return res.status(403).send({message: 'Forbidden Access'} )
      }
      let query = {};
      if(req.query?.email){
        query = {email: req.query.email}
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    })

    app.patch('/bookings/:id', async(req, res) =>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updatedBooking = req.body;
      console.log(updatedBooking);
      const updateDoc = {
        $set: {
          status: updatedBooking.status
        },
      }
      const result = await bookingCollection.updateOne(filter, updateDoc);
      res.send(result);

    })

    app.delete('/bookings/:id', async(req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    })

   

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) =>{
    res.send('Car Doctor Server is running');
})

app.listen(port, () =>{
    console.log(`Car doctor server is running port on: ${port}`);
})