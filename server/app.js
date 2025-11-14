const express = require("express");
const app = express();
app.use(express.json());
const mongoose = require("mongoose");

/** Do not change the connection string below */
mongoose.connect(
    "mongodb+srv://pulluru_dileep_1729:syDBLMxnrIks3NwC@cluster.idkuw6p.mongodb.net/?appName=Cluster",
    {}
);
/** connection ends */

const movieSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    duration: { type: Number, required: true },
    genre: { type: String, required: true },
    language: { type: String, required: true },
    releaseDate: { type: Date, required: true },
    poster: { type: String, required: true },
});

// Your code goes here. 

movieSchema.post('save', (Movie) => {
    console.log(`Movie ${Movie['title']} has been saved`)
    //this.title
})

const Movie = mongoose.model("Movie", movieSchema);

app.post("/createMovi", async (req, res) => {
    try {
        const data = new Movie(req.body);
        data.save();
    } catch (err) {
        res.status(401).send(err);
    }
})

app.listen(3000, () => {
    console.log("sever started")
})