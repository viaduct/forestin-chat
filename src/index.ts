import Express from "express";
import {RedisPubSub} from "graphql-redis-subscriptions";
import Redis from "ioredis";
import {MongoClient, ObjectId as MongoObjectId} from "mongodb";
import {ApolloServer} from "apollo-server-express";
import {createServer} from "http";
import depthLimit from "graphql-depth-limit";
import {createComplexityLimitRule} from "graphql-validation-complexity";
import * as Op from "./lib";
import {GraphQLUpload as GraphqlUpload} from "graphql-upload";
import Aws from "aws-sdk";

async function main()
{
    const credentialPath = "forestin-credentials.json";
    Aws.config.loadFromPath(credentialPath);
    const s3 = new Aws.S3({apiVersion: "latest"});
    const expressApp = Express();
    const mongoUrl = "mongodb://localhost:31234";
    const redisOptions: Redis.RedisOptions = {
        host: "localhost",
        port: 6379,
        retryStrategy: (times: number)=>{
            return Math.min(times * 50, 2000);
        }
    };
    const graphqlPubSub = new RedisPubSub({
        publisher: new Redis(redisOptions),
        subscriber: new Redis(redisOptions),
    });
    const mongoClient = await MongoClient.connect(mongoUrl, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    const mongoDbName = "mango";
    const mongoDb = mongoClient.db(mongoDbName);
    const apolloTypeDefs = `
        enum Void {VOID}
       
        type Image {
            id: ID!
            mime: String!
            issuedDate: String!
            isReady: Boolean!
            refCount: Int!
        }
        type Room {
            id: ID!
            members: [ID!]!
            lastPostedAt: String!
            issuedDate: String!
        }
        enum MsgBodyKind{
            TEXT
            BLOB
        }
        interface MsgBody {
            msgBodyKind: MsgBodyKind!
        }
        type MsgBodyText {
            text: String!
        }
        type MsgBodyBlob {
            url: String!
            mime: String!
        }
        type Msg {
            id: ID!
            body: MsgBody!
            bodyText: String!
            lastModifiedAt: String!
            issuedDate: String!
            author: String!
        }
        type Query {
            fuck(dumb: String!): String!
        }
        type Mutation {
            createRoom(members: [ID!]!): Room!
            destroyRoom(id: ID!): Void
            destroyRooms(ids: [ID!]!): Void
            postMsg(roomId: ID!, userId: ID!, bodyText: String!): Msg
            postBlobMsg(roomId: ID!, userId: ID!, blob: Upload!): Msg
        }
    `;
    const apolloResolvers = {
        Query: {
            fuck: async (parent: any, params: any)=>{

            }
        },
        Mutation: {
            createRoom: async (parent: any, params: any, context: any)=>{
                const room = await Op.createRoom({db: context.mongoDb});
                await Op.addMembers({
                    db: context.mongoDb,
                    roomId: new MongoObjectId(room.id),
                    memberIds: params.members,
                });

                return {
                    id: room.id,
                };
            },
            destroyRoom: async (parent: any, params: any, context: any)=>{
                await Op.destroyRoom({
                    db: context.mongoDb,
                    roomId: new MongoObjectId(params.id),
                });
            },
            destroyRooms: async (parent: any, params: any, context: any)=>{
                for ( const roomIdToBeDestroyedInString of params.ids )
                {
                    const roomId = new MongoObjectId(roomIdToBeDestroyedInString);

                    await Op.destroyRoom({
                        db: context.mongoDb,
                        roomId: roomId,
                    });
                }
            },
            postMsg: async (parent: any, params: any, context: any)=>{
                const msg = await Op.postMsg({
                    db: context.mongoDb,
                    roomId: params.roomId,
                    userId: params.userId,
                    msgBody: params.bodyText,
                });

                return msg;
            },
            postBlobMsg: async (parent: any, params: any, context: any)=>{
                const {roomId, userId, blob} = params;
                const {mimetype, createReadStream} = await blob;
                const msg: Op.Msg = await Op.uploadAndPostBlobMsg({
                    db: context.mongoDb,
                    s3: context.s3,
                    roomId: roomId,
                    userId: userId,
                    mime: mimetype,
                    stream: createReadStream(),
                });

                return msg;
            },
        },
        Room: {
            members: async (parent: any, params: any, context: any)=>{
                return (await Op.roomMemberIds({db: context.mongoDb, roomId: parent.id}))
                    .map((objectId: MongoObjectId)=>objectId.toString());
            },
            lastPostedAt: async (parent: any, params: any, context: any)=>{
                const date = await Op.roomLastPostedAt({
                    db: context.mongoDb,
                    roomId: parent._id,
                });
                return date.getTime().toString();
            },
            issuedDate: async (parent: any, params: any, context: any)=>{
                const date = await Op.roomIssuedDate({
                    db: context.mongoDb,
                    roomId: parent._id,
                });
                return date.getTime().toString();
            }
        },
        Msg: {
            bodyText: async (parent: any, params: any, context: any)=>{
                const text: string = await Op.msgBodyText({
                    db: context.mongoDb,
                    id: parent._id,
                });
                return text;
            },
            body: async (parent: any, params: any, context: any)=>{
                return await Op.msgBody({db: context.mongoDb, id: parent._id});
            },
            issuedDate: async (parent: any, params: any, context: any)=>{
                const date: Date = await Op.msgIssuedDate({
                    db: context.mongoDb,
                    id: parent._id,
                });
                return date.getTime().toString();
            },
            lastModifiedAt: async (parent: any, params: any, context: any)=>{
                const date: Date = await Op.msgLastModifiedAt({
                    db: context.mongoDb,
                    id: parent._id,
                });
                return date.getTime().toString();
            },
            author: async (parent: any, params: any, context: any)=>{
                const authorId: string = await Op.msgAuthor({
                    db: context.mongoDb,
                    id: parent._id,
                });
                return authorId;
            }
        },
        MsgBodyBlob: {
            url: async (parent: any, params: any, context: any)=>{
                return Op.downloadableBlobUrl(parent._id);
            },
        },
        Upload: GraphqlUpload,
    };
    const apolloServer = new ApolloServer({
        typeDefs: apolloTypeDefs,
        resolvers: apolloResolvers,
        validationRules: [
            depthLimit(5),
            createComplexityLimitRule(1000, {
                onCost: (cost: any) => console.log('query cost: ', cost)
            })
        ],
        context: async ()=>{
            return { mongoClient, graphqlPubSub, mongoDb, s3};
        },
    });

    apolloServer.applyMiddleware({app: expressApp});

    const httpServer = createServer(expressApp);
    apolloServer.installSubscriptionHandlers(httpServer);
    httpServer.timeout = 5000;
    httpServer.listen(
        {
            port: 4123
        },
        ()=>{
            console.log(`Running at http://localhost:4000${apolloServer.graphqlPath}`);
        }
    );
}

main();
