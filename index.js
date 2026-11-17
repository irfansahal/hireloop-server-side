import "dotenv/config"
import express from "express"
import cors from "cors"
import { MongoClient, ObjectId } from "mongodb"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const app = express();

app.use(express.json())
app.use(cors())

const client = new MongoClient(`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.nphrpiz.mongodb.net/`)

async  function connectToMongoDB(){
   try {
    await client.connect();
    console.log("You Successfully Connected To MongoDB");
    return client;
   } catch (error) {
    console.log(error);
    
   }
}

const connnectedClient = await connectToMongoDB();

const hireloopDB = await connnectedClient.db("hireloopDB");

const users = await hireloopDB.collection("user")
const jobs = await hireloopDB.collection("jobs")
const applications = await hireloopDB.collection("applications")
const payments = await hireloopDB.collection("payments");
const sessions = await hireloopDB.collection("session");

const port = process.env.port | "5000";

const myLogg = (req, res, next) => {
  console.log(`now hitting on `, req.url , req.query);
     
  next()
}

const verifyToken = async (req, res, next) => {
     const authHeader = req.headers.authorization;
     if(!authHeader){
         res.status(401).send({ message : "Unauthorized"})
         return
     }

     const token = authHeader.split(" ")[1]
     if(!token){
       res.status(401).send({ message : "Unauthorized" });
       return 
     }
     const query = { token };
     const session = await sessions.findOne(query);
     if(!session){
        res.status(401).send({message : "Unauthorized"})
        return
     }
    
     const userId = session.userId
     const userQuery = { _id : new ObjectId(userId)}
     const user = await users.findOne(userQuery);
     if(!user){
          res.status(401).json({
            message : "Unaoturized"
         });
         return 
     }
     req.user = user;
     next()
}

const verifySeeker = (req, res, next) => {
  
    if(req.user.role !== "seeker"){
      res.status(403).send({ message : "Forbodden" })
    }

 next()
}

const verifyRecruiter = (req , res, next ) => {
    if(req.user.role !== "recruiter"){
        res.status(403).send({ message : "Forbidden" })
    }
    next()
}

const verifyAdmin = (req, res , next ) => {
if(req.user.role !== "admin"){
        res.status(403).send({ message : "Forbidden" })
    }
    next()
}
app.get("/", (req, res)=>{
    res.send("The Server Running On Port 5000")
})

// users related data 
app.get("/users", async (req , res)=>{
    const cursor = users.find({});
    const result = await cursor.toArray();
    res.send(result)
})

app.get("/users/:id/premium", async (req , res)=>{
   const id = req.params.id;
   const query = { _id : new ObjectId(id)};
   const result = await users.findOne(query, {projection : { premium : 1 }});
   console.log(result);
   
   res.send(result)
})

app.get("/users/:id/role", verifyToken,verifyAdmin, async (req , res)=>{
    const { id } = req.params
    const query = { _id : new ObjectId(id) }
    const updateDoc = {
        $set: {
            role : req.body.role
        }
    }
    const result = await users.updateOne(
        query,
        updateDoc
    )
    res.send(result)
})

app.post("/create-jobs", verifyToken, verifyRecruiter, async (req , res)=>{
    const body = req.body
    const result = await jobs.insertOne(body);
    res.send(result) 
})

app.get("/jobs", async (req, res)=>{

    const query = {}
    
    if(req.query){
        if(req.query.typesOfJob){
             query.typesOfJob = req.query.typesOfJob
        }
        if(req.query.categoryOfJob){
            query.categoryOfJob = req.query.categoryOfJob
        }
        if(req.query.remote){
            query.remote = req.query.remote === 'true'
        }
        if(req.query.recruiterId){
          query.recruiterId = req.query.recruiterId
        }

        if(req.query.search){
           query.$or = [
             { title : { $regex : req.query.search , $options : 'i'}},
              { requirements : { $regex : req.query.search , $options : 'i'}},
                { city : { $regex : req.query.search , $options : 'i'}},  
            ]
        }
    }
    
    console.log("Search Quary", query);
   const cursor = jobs.find(query);
   const result = await cursor.toArray();
   res.send(result)
})

app.get("/job/:id", async (req , res)=>{
    const jobId = req.params.id;
    const quary = { _id : new ObjectId(jobId)};
    const result = await jobs.findOne(quary);
    res.send(result)
})

app.delete("/jobs/:id", async (req, res)=>{
    const jobId = req.params.id
    const quary = {_id : new ObjectId(jobId)}
    const deletedData = await jobs.deleteOne(quary);
    res.send(deletedData)    
})

app.post("/application", verifyToken, verifySeeker ,async (req , res) => {
    const body = req.body;
    const onApplication = await applications.insertOne(body);
    res.send(onApplication)
})

app.get("/application", verifyToken ,async (req , res)=>{
   
    console.log(req.headers);
    
    const query = {}
    
    if(req.query.applicationId){
        query.userId = req.query.applicationId
    }
    if(req.query.jobId){
         const jobQuery = { _id : new ObjectId(req.query.jobId)}
         const job = await jobs.findOne(jobQuery);

         if(job.recruiterId !== req.user._id.toString() && req.user.role !== "admin"){
            res.status(403).send({ message : "forbidden"})
           return
        }
        query.jobId = req.query.jobId
    }

  const cursor =  applications.find(query)
  const result = await cursor.toArray();
  res.send(result)
})

app.get("/application/count", async (req , res)=>{
    const query = {}
    if(req.query.applicationId){
        query.userId = req.query.applicationId 
    }
    const result = await applications.countDocuments(query);
    res.send({count : result })
})

app.patch("/applications/:id", async (req , res)=>{
    const { id } = req.params;
    const query = { _id : new ObjectId(id)}
    const updateDoc = {
        $set: {
            status : req.body.status
        }
    }
    const result = await applications.updateOne(
        query,
        updateDoc
    );
    res.send(result)
});

// payment related 
app.post("/payment/checkoute-varify" , async (req , res) => {
    const { sessionId } = req.body;
    
    if(!sessionId){
       return res.send({ success : false , message : "SessionId is required"})
    }

    const { 
    status,
    customer_email,
    metadata,
    payment_intent,
    payment_status,
    // session 
} = await stripe.checkout.sessions.retrieve(sessionId)

  if (status === 'complete' && payment_status === "paid" ) {
   
    const sessionQuery = {sessionId}

    const existingPayment = await payments.findOne(sessionQuery);

    if(existingPayment){
       return res.send({ success : false , message : "Payment Already Verfied"})
    }

    const payment = {
    sessionId,
    status,
    customer_email,
    userId: metadata.userId,
    payment_intent,
    payment_status,
    payment_date : new Date()
  }
   
   const result = await payments.insertOne(payment);
  
     const query = { _id : new ObjectId(metadata.userId)}
     const updateDoc = {
         $set : {
            premium : true
         }
     }

     const updateResult = await users.updateOne(
        query,
        updateDoc
     )
     res.send({ success : true , result , updateResult})
     return
  }
  
  res.send({ success : false ,message : "Pyament Varification failed"})
}) 


app.listen(port, ()=>{
    console.log(`The server is running ${port}`);
    
})

export default app