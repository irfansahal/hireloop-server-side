import "dotenv/config"
import express from "express"
import cors from "cors"
import { MongoClient, ObjectId } from "mongodb"

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

const port = process.env.port | "5000";

app.get("/", (req, res)=>{
    res.send("The Server Running On Port 5000")
})

app.get("/users", async (req , res)=>{
    const cursor = users.find({});
    const result = await cursor.toArray();
    res.send(result)
})

app.post("/create-jobs", async (req , res)=>{
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

app.delete("/jobs/:id", async (req, res)=>{
    const jobId = req.params.id
    const quary = {_id : new ObjectId(jobId)}
    const deletedData = await jobs.deleteOne(quary);
    res.send(deletedData)    
})

app.listen(port, ()=>{
    console.log(`The server is running ${port}`);
    
})