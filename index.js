import "dotenv/config"
import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb"

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

app.listen(port, ()=>{
    console.log(`The server is running ${port}`);
    
})