"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
require("dotenv-safe").config();
const express_1 = __importDefault(require("express"));
const typeorm_1 = require("typeorm");
const constants_1 = require("./constants");
const path_1 = require("path");
const User_1 = require("./entities/User");
const passport_github_1 = require("passport-github");
const passport_1 = __importDefault(require("passport"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const cors_1 = __importDefault(require("cors"));
const Todo_1 = require("./entities/Todo");
const isAuth_1 = require("./isAuth");
const axios_1 = __importDefault(require("axios"));
const main = () => __awaiter(void 0, void 0, void 0, function* () {
    yield typeorm_1.createConnection({
        type: "postgres",
        database: "vstodo",
        entities: [path_1.join(__dirname, "./entities/*.*")],
        logging: !constants_1.__prod__,
        synchronize: !constants_1.__prod__,
        "url": "postgres://qwzcykvt:0GvXRCPtLhym-hyquhL0ruPXwbqsdzeE@fanny.db.elephantsql.com/qwzcykvt",
    });
    const app = express_1.default();
    passport_1.default.serializeUser((user, done) => {
        done(null, user.accessToken);
    });
    app.use(cors_1.default({ origin: "*" }));
    app.use(passport_1.default.initialize());
    app.use(express_1.default.json());
    passport_1.default.use(new passport_github_1.Strategy({
        clientID: "6e6bf7633ec36dcb3897",
        clientSecret: "6dfbd1641d3afa04d61a57440b2e15436518ca13",
        callbackURL: "http://localhost:3002/auth/github/callback",
    }, (_, __, profile, cb) => __awaiter(void 0, void 0, void 0, function* () {
        let user = yield User_1.User.findOne({ where: { githubId: profile.id } });
        console.log("--------------------------->", profile);
        if (user) {
            user.name = profile.displayName;
            yield user.save();
        }
        else {
            user = yield User_1.User.create({
                name: profile.displayName,
                githubId: profile.id,
            }).save();
        }
        cb(null, {
            accessToken: jsonwebtoken_1.default.sign({ userId: user.id }, "aayushsinha", {
                expiresIn: "1y",
            }),
        });
    })));
    app.get("/auth/github", passport_1.default.authenticate("github", { session: false }));
    app.get("/auth/github/callback", passport_1.default.authenticate("github", { session: false }), (req, res) => {
        res.redirect(`http://localhost:54321/auth/${req.user.accessToken}`);
    });
    app.get("/todo", isAuth_1.isAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const todos = yield Todo_1.Todo.find({
            where: { creatorId: req.userId },
            order: { id: "DESC" },
        });
        res.send({ todos });
    }));
    app.post("/todo", isAuth_1.isAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            if (req.body.text.includes("#")) {
                const ticketId = req.body.text.replace('#', '');
                let result = yield axios_1.default.get(`https://api.clickup.com/api/v2/task/${ticketId}`, { headers: { "Authorization": "pk_3344635_OKQECX1X18DADHGYTS13GY1UI8C8SCH7" } });
                let ticket = result.data;
                console.log(ticket);
                const todo = yield Todo_1.Todo.create({
                    text: ticket.name,
                    taskId: ticketId,
                    creatorId: req.userId,
                    status: ticket.status.status.toLowerCase()
                }).save();
                res.send({ todo });
            }
            else {
                const todo = yield Todo_1.Todo.create({
                    text: req.body.text,
                    taskId: "",
                    creatorId: req.userId,
                    status: ""
                }).save();
                res.send({ todo });
            }
        }
        catch (e) {
            console.log(e);
        }
    }));
    app.put("/clickup", isAuth_1.isAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        let user = yield User_1.User.findOne(req.body.id);
        if (!user) {
            res.send({ todo: null });
            return;
        }
        user.clickUpId = req.body.clickUpId;
        yield user.save();
        res.send({ user });
    }));
    app.delete("/todo", isAuth_1.isAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield Todo_1.Todo.delete(req.body.todoId);
            const todos = yield Todo_1.Todo.find({
                where: { creatorId: req.userId },
                order: { id: "DESC" },
            });
            res.send({ todos });
        }
        catch (e) {
            console.log(e);
        }
    }));
    app.delete("/resetTodo", isAuth_1.isAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const todosArr = yield Todo_1.Todo.find({
                where: { creatorId: req.userId },
                order: { id: "DESC" },
            });
            yield Todo_1.Todo.remove(todosArr);
            const todos = yield Todo_1.Todo.find({
                where: { creatorId: req.userId },
                order: { id: "DESC" },
            });
            res.send({ todos });
        }
        catch (e) {
            console.log(e);
        }
    }));
    app.get("/me", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
            const payload = jsonwebtoken_1.default.verify(token, process.env.ACCESS_TOKEN_SECRET);
            userId = payload.userId;
        }
        catch (err) {
            res.send({ user: null });
            return;
        }
        if (!userId) {
            res.send({ user: null });
            return;
        }
        const user = yield User_1.User.findOne(userId);
        res.send({ user });
    }));
    app.get("/", (_req, res) => {
        res.send("hello");
    });
    app.listen(3002, () => {
        console.log("listening on localhost:3002");
    });
});
main();
//# sourceMappingURL=index.js.map