import path from "path";
import dotenv from "dotenv";
import nocache from "nocache";
import express from 'express';
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import cacheMid from "./middleware/cacheMid/cacheMid.js";
import router from "./routes/indexRoutes.js";
dotenv.config();
const app = express();

mongoose.connect(process.env.MONGO_URI).then(()=> {console.log("MongoDB connected")}).catch((err) => {console.log("Err");console.log(err)});


app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.set("view engine", "ejs");
app.use(express.static("public"));
// app.use(cacheMid);
app.use(nocache());
// app.use((err,req, res, next) => {
//   res.status(404).render("error", { status: 404, message: "Page Not Found" });
// });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


app.use("/",router)
// app.get ('/', (req, res) => {
//   res.sendFile(path.join(__dirname, "public","images","Home.png"))
// }
// );

app.listen (3000, () => {
  console.log ('Server is running on port 3000');
}
);