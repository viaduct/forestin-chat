import Mongo from "mongodb";

type Id = Mongo.ObjectId;
interface MongoObj
{
    id?: Id;
}
export interface Room extends MongoObj
{
    members?: Id[];
    lastPostedAt?: Date;
    issuedDate?: Date;
}
export interface Msg extends MongoObj
{
    text?: string;
    belongsTo?: Id;
    lastModifiedAt?: Date;
    issuedDate?: Date;
    author?: string;
}
export const roomCollecName = "Rooms";
export const msgCollecName = "Msgs";

export async function createRoom({db}: any): Promise<Room>
{
    const now = new Date(Date.now());

    const room: Room = {
        members: [],
        lastPostedAt: now,
        issuedDate: now,
    };
    const insertingResult = await db.collection(roomCollecName).insertOne(room);

    room.id = insertingResult.insertedId;

    return room;
}

export async function destroyRoom({db, roomId}: any): Promise<void>
{
    await db.collection(roomCollecName).deleteOne({_id: roomId});
}

export async function addMembers({db, roomId, memberIds}: any): Promise<void>
{
    await db.collection(roomCollecName).updateOne(
        {
            _id: roomId,
        },
        {
            $addToSet: {members: memberIds},
        },
    );
}

export async function roomMemberIds({db, roomId}: any): Promise<Id[]>
{
    const queryResult: {members: Id[]}[] =
        await db.
        collection(roomCollecName).
        find({ // Find by id
            _id: roomId,
        }).
        project({ // Only need members.
            _id: 0,
            members: 1,
        }).
        toArray(); // to js array.

    console.assert(queryResult.length < 2); // 0 or 1

    // Return array of ids.
    if ( queryResult.length == 0 )
    {
        // No matching room, no members.
        return [];
    }
    else if ( queryResult.length == 1)
    {
        // Return members.
        return queryResult[0].members;
    }
    else
    {
        console.assert(false);
    }
    return []; // To remove warning. Meaningless.
}

export async function removeMembers({db, roomId, memberIds}: any): Promise<void>
{
    await db.collection(roomCollecName).updateOne(
        {
            id: roomId,
        },
        {
            $pull: {members: {$in: memberIds}},
        },
    );
}

export async function postMsg({db, roomId, userId, msgBody}: any): Promise<Msg>
{
    const now: Date = new Date(Date.now());

    const msg: Msg = {
        text: msgBody,
        belongsTo: roomId,
        lastModifiedAt: now,
        issuedDate: now,
        author: userId,
    };

    // Add new msg.
    const insertionResult = await db.collection(msgCollecName).insertOne(msg);

    // Update chatroom lastModified state.
    await db.collection(roomCollecName).updateOne(
        {
            _id: roomId,
        },
        {
            $set: {
                lastPostedAt: now,
            },
        },
    );

    msg.id = insertionResult.insertedId;

    return msg;
}

export async function roomLastPostedAt({db, roomId}: any): Promise<Date>
{
    const queryResult: {lastPostedAt: Date}[] = await db.collection(roomCollecName)
        .find({
            _id: roomId
        })
        .project({
            _id: 0,
            lastPostedAt: 1,
        })
        .toArray();

    if ( queryResult.length == 1 )
    {
        return queryResult[0].lastPostedAt;
    }
    else
    {
        return new Date(0);
    }
}

export async function roomIssuedDate({db, roomId}: any): Promise<Date>
{
    const queryResult: {issuedDate: Date}[] = await db.collection(roomCollecName)
        .find({
            _id: roomId
        })
        .project({
            _id: 0,
            issuedDate: 1,
        })
        .toArray();

    if ( queryResult.length == 1 )
    {
        return queryResult[0].issuedDate;
    }
    else
    {
        return new Date(0);
    }
}

export async function destroyMsg({db, msgId}: any): Promise<void>
{
    await db.collection(msgCollecName).deleteOne({_id: msgId});
}

export async function msgBodyText({db, id}: any): Promise<string>
{
    const queryResult: {text: string}[] = await db.collection(msgCollecName)
        .find({
            _id: id
        })
        .project({
            _id: 0,
            text: 1,
        })
        .toArray();

    if ( queryResult.length == 1 )
    {
        return queryResult[0].text;
    }
    else
    {
        return "";
    }
}

export async function msgLastModifiedAt({db, id}: any): Promise<Date>
{
    const queryResult: {lastModifiedAt: Date}[] = await db.collection(msgCollecName)
        .find({
            _id: id
        })
        .project({
            _id: 0,
            lastModifiedAt: 1,
        })
        .toArray();

    if ( queryResult.length == 1 )
    {
        return queryResult[0].lastModifiedAt;
    }
    else
    {
        return new Date(0);
    }
}

export async function msgIssuedDate({db, id}: any): Promise<Date>
{
    const queryResult: {issuedDate: Date}[] = await db.collection(msgCollecName)
        .find({
            _id: id
        })
        .project({
            _id: 0,
            issuedDate: 1,
        })
        .toArray();

    if ( queryResult.length == 1 )
    {
        return queryResult[0].issuedDate;
    }
    else
    {
        return new Date(0);
    }
}

export async function msgAuthor({db, id}: any): Promise<string>
{
    const queryResult: {author: string}[] = await db.collection(msgCollecName)
        .find({
            _id: id
        })
        .project({
            _id: 0,
            author: 1,
        })
        .toArray();

    if ( queryResult.length == 1 )
    {
        return queryResult[0].author;
    }
    else
    {
        return "";
    }
}
