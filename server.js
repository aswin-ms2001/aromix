import dotenv from "dotenv";
import express from 'express';
import mongoose from "mongoose";
dotenv.config();
const app = express();

mongoose.connect(process.env.MONGO_URI).then(()=> {console.log("MongoDB connected")}).catch((err) => {console.log("Err");console.log(err)});
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.set("view engine", "ejs");
app.use(express.static("public"));


app.get ('/', (req, res) => {
  res.send ('Hello World!');
}
);

app.listen (3000, () => {
  console.log ('Server is running on port 3000');
}
);