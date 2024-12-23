const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ir3lm70.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const reviewsCollection = client.db("beautyShop").collection("reviews");
    const allProductsCollection = client
      .db("beautyShop")
      .collection("allProducts");
    const cartsCollection = client.db("beautyShop").collection("carts");

    const usersCollection = client.db("beautyShop").collection("users");

    app.get("/reviews", async (req, res) => {
      const results = await reviewsCollection.find().toArray();
      res.send(results);
    });

    app.post("/user", async (req, res) => {
      const data = req.body;
      const query = { email: data.email };
      const result = await usersCollection.findOne(query);
      if (result) {
        res.send(result);
      } else {
        const createUser = await usersCollection.insertOne(data);
        res.send({ result: createUser });
      }
    });

    app.get("/userInfo", async (req, res) => {
      const data = req.query.email;
      const query = { email: data };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    app.get("/details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allProductsCollection.findOne(query);
      res.send(result);
    });

    app.get("/allProducts/:filter", async (req, res) => {
      const sort = req.query.sort;
      const sorting = parseInt(sort);
      const filter = req.params.filter;
      const searchQuery = req.query.search || ""; 
    
  
      const presentResult = await allProductsCollection.updateMany(
        { "price.present_price": { $type: "string" } },
        [
          {
            $set: {
              "price.present_price": {
                $toInt: "$price.present_price",
              },
            },
          },
        ]
      );
      const previousResult = await allProductsCollection.updateMany(
        { "price.previous_price": { $type: "string" } },
        [
          {
            $set: {
              "price.previous_price": {
                $toInt: "$price.previous_price",
              },
            },
          },
        ]
      );
    
 
      const query = {};
      if (filter !== "All") {
        query.category = filter;
      }
      if (searchQuery) {
        query.name = { $regex: searchQuery, $options: "i" }; 
      }
    

      const results = await allProductsCollection.find().toArray();
      const uniqueProductCategories = [
        ...new Set(results.map((item) => item.category)),
      ];
    
      let products;
      if (sorting !== 0) {
        products = await allProductsCollection
          .find(query)
          .sort({ "price.present_price": sorting })
          .toArray();
      } else {
        products = await allProductsCollection.find(query).toArray();
      }
    
      res.send({
        results: products,
        uniqueProductCategories,
        presentResult,
        previousResult,
      });
    });
    
    
    

    // Cart section

    app.get("/cart", async (req, res) => {
      const email = req.query.email;
      const query = { "cartData.user": email };
      const result = await cartsCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/addToCart", async (req, res) => {
      const cartItem = req.body;
      const zeroQuery = { "cartData.user": cartItem.cartData.user };
      const zeroResult = await cartsCollection.findOne(zeroQuery);
      if (zeroResult) {
        const query = {
          stall_id: cartItem.stall_id,
          "cartData.user": cartItem.cartData.user,
        };
        const queryResult = await cartsCollection.findOne(query);

        if (queryResult) {
          const result = await cartsCollection.insertOne(cartItem);
          return res.send(result);
        } else {
          return res.send({ result: false });
        }
      } else {
        const result = await cartsCollection.insertOne(cartItem);
        return res.send(result);
      }
    });

    app.delete("/removeCart/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    });



    // Featured collection
    app.get("/featured", async (req, res) => {
      const result = await allProductsCollection
        .find({ isFeatured: true })
        .toArray();
      res.send(result);
    });

    //Admin panel

    app.get("/isadmin", async (req, res) => {
      const email = req.query.email;
      const query = { email: email, role: "admin" };
      const result = await usersCollection.findOne(query);
      if (result) {
        res.send({ isAdmin: true });
      } else {
        res.send({ isAdmin: false });
      }
    });

    app.get("/manageUsers", async (req, res) => {
      const results = await usersCollection.find().toArray();
      res.send(results);
    });

    app.put("/manageUsers", async (req, res) => {
      const email = req.query.email;
      const query = { email: email, role: "admin" };
      const result = await usersCollection.findOne(query);
      if (result) {
        return res.send({ status: false });
      }
      const makeAdmin = await usersCollection.updateOne(
        { email: email },
        { $set: { role: "admin" } }
      );
      res.send({ status: true, result: makeAdmin });
    });

    app.delete("/manageUsers", async (req, res) => {
      const email = req.query.email;
      const deleteuser = await usersCollection.deleteOne({ email: email });
      const deletecarts = await cartsCollection.deleteMany({ user: email });
      res.send({ deletecarts, deleteuser, status: true });
    });

    //Seller Dashboard

    app.get("/isseller", async (req, res) => {
      const email = req.query.email;
      const query = { email: email, role: "seller" };
      const result = await usersCollection.findOne(query);
      if (result) {
        res.send({ isSeller: true });
      } else {
        res.send({ isSeller: false });
      }
    });

    app.post("/addItems", async (req, res) => {
      const data = req.body;
      const result = await allProductsCollection.insertOne(data);
      res.send(result);
    });

    app.get("/manageItems/:id", async (req, res) => {
      const id = parseInt(req.params.id);
      const query = { "stall.id": id };
      const result = await allProductsCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/deleteItem/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allProductsCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/updateitem/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const query = { _id: new ObjectId(id) };
      const updateData = { $set: data };
      const result = await allProductsCollection.updateOne(query, updateData);
      res.send(result);
    });

    app.get("/connect", async (req, res) => {
      setTimeout(() => {
        res.send({ connect: true });
      }, 4000);
    });

    // // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Beauty Shop Server Turned On");
});

app.listen(port, () => {
  console.log(`Beauty shop is Online on Port: ${port}`);
});
