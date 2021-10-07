import "reflect-metadata";
require("dotenv-safe").config();
import express from "express";
import { createConnection } from "typeorm";
import { __prod__ } from "./constants";
import { join } from "path";
import { User } from "./entities/User";
import { Strategy as GitHubStrategy } from "passport-github";
import passport from "passport";
import jwt from "jsonwebtoken";
import cors from "cors";
import { Todo } from "./entities/Todo";
import { isAuth } from "./isAuth";
import axios, { AxiosResponse } from 'axios';

const main = async () => {
  await createConnection({
    type: "postgres",
    database: "vstodo",
    entities: [join(__dirname, "./entities/*.*")],
    logging: !__prod__,
    synchronize: !__prod__,
    "url": "postgres://qwzcykvt:0GvXRCPtLhym-hyquhL0ruPXwbqsdzeE@fanny.db.elephantsql.com/qwzcykvt", 
  });

  // const user = await User.create({ name: "bob" }).save();

  const app = express();
  passport.serializeUser((user: any, done) => {
    done(null, user.accessToken);
  });
  app.use(cors({ origin: "*" }));
  app.use(passport.initialize());
  app.use(express.json());

  passport.use(
    new GitHubStrategy(
      {
        clientID: "6e6bf7633ec36dcb3897",
        clientSecret: "6dfbd1641d3afa04d61a57440b2e15436518ca13",
        callbackURL: "http://localhost:3002/auth/github/callback",
      },
      async (_, __, profile, cb) => {
        let user = await User.findOne({ where: { githubId: profile.id } });
        console.log("--------------------------->",profile)
        if (user) {
          user.name = profile.displayName;
          await user.save();
        } else {
          user = await User.create({
            name: profile.displayName,
            githubId: profile.id,
          }).save();
        }
        cb(null, {
          accessToken: jwt.sign(
            { userId: user.id },
            "aayushsinha",
            {
              expiresIn: "1y",
            }
          ),
        });
      }
    )
  );

  app.get("/auth/github", passport.authenticate("github", { session: false }));

  app.get(
    "/auth/github/callback",
    passport.authenticate("github", { session: false }),
    (req: any, res) => {
      res.redirect(`http://localhost:54321/auth/${req.user.accessToken}`);
    }
  );

  app.get("/todo", isAuth, async (req, res) => {
    const todos = await Todo.find({
      where: { creatorId: req.userId },
      order: { id: "DESC" },
    });

    res.send({ todos });
  });

  app.post("/todo", isAuth, async (req, res) => {
    try{
      if(req.body.text.includes("#")){
      const ticketId = req.body.text.replace('#','');
      let result: AxiosResponse = await axios.get(`https://api.clickup.com/api/v2/task/${ticketId}`, { headers: {"Authorization" :  "pk_3344635_OKQECX1X18DADHGYTS13GY1UI8C8SCH7"}});
      let ticket = result.data;
      console.log(ticket)
      
  
    const todo = await Todo.create({ 
      text: ticket.name,
      taskId: ticketId,
      creatorId: req.userId,
      status: ticket.status.status.toLowerCase()
    }).save();
    
    res.send({ todo });
  } else {
    const todo = await Todo.create({ 
      text: req.body.text,
      taskId: "",
      creatorId: req.userId,
      status: ""
    }).save();
    res.send({ todo });
  }
    }
    catch(e) {
      console.log(e)
    }
  });

  app.put("/clickup", isAuth, async (req, res) => {
    let user = await User.findOne(req.body.id);
    if (!user) {
      res.send({ todo: null });
      return;
    }
    user.clickUpId = req.body.clickUpId;
    await user.save();
    res.send({ user });
  });

  app.delete("/todo", isAuth, async (req, res) => {
    try{
      // let todoToRemove = await Todo.findOne(req.body.todoId);
      await Todo.delete(req.body.todoId);
      const todos = await Todo.find({
        where: { creatorId: req.userId },
        order: { id: "DESC" },
      });
  
      res.send({ todos });
    } catch(e){
      
      console.log(e)
    }
  })
  app.delete("/resetTodo", isAuth, async (req, res) => {
    try{
      // let todoToRemove = await Todo.findOne(req.body.todoId);
      const todosArr = await Todo.find({
        where: { creatorId: req.userId },
        order: { id: "DESC" },
      });
      await Todo.remove(todosArr);
      const todos = await Todo.find({
        where: { creatorId: req.userId },
        order: { id: "DESC" },
      });
      res.send({ todos });
    } catch(e){
      console.log(e)
    }
  })

  // app.put("/todo", isAuth, async (req, res) => {
  //   try{
  //     console.log("----id-----",req.body)
  //     let status = req.body.status;
  //     status = status.toLowerCase();
  //     console.log('---120-----',status)

  //   // const ticketId = req.body.text.replace('#','');
  //   let todo = await Todo.findOne(req.body.id);
      
  //     console.log("----------todo",todo?.taskId)
  //      let result: AxiosResponse = await axios.put(`https://api.clickup.com/api/v2/task/${todo?.taskId}`,{status}, { headers: {"Authorization" : req.body.clickupId}});
  //      let ticket = result.data;
  //      console.log('----------ticket-',ticket)
  //     res.send({ticket});
  //   }catch(e){
  //     console.log('---er------',e)
  //   }
  //   // const todo = await Todo.create({
  //   //   text: ticket.name,
  //   //   creatorId: req.userId,
  //   //   status: ticket.status.status.toLowerCase()
  //   // }).save();
  //   // res.send({ todo });
  //   // const todo = await Todo.findOne(req.body.id);
  //   // if (!todo) {
  //   //   res.send({ todo: null });
  //   //   return;
  //   // }
  //   // if (todo.creatorId !== req.userId) {
  //   //   throw new Error("not authorized");
  //   // }
  //   // todo.completed = !todo.completed;
  //   // await todo.save();
  //   // res.send({ todo });
  // });

  app.get("/me", async (req, res) => {
    // Bearer 120jdklowqjed021901
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.send({ user: null });
      return;
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      res.send({ user: null });
      return;
    }

    let userId = "";

    try {
      const payload: any = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      userId = payload.userId;
    } catch (err) {
      res.send({ user: null });
      return;
    }

    if (!userId) {
      res.send({ user: null });
      return;
    }

    const user = await User.findOne(userId);

    res.send({ user });
  });

  app.get("/", (_req, res) => {
    res.send("hello");
  });
  app.listen(3002, () => {
    console.log("listening on localhost:3002");
  });
};

main();
