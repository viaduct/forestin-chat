import Mongo from "mongodb";
import Aws from "aws-sdk";

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
export interface Blob extends MongoObj
{
    mime: string;
    issuedDate: Date;
    refCount: number;
    isReady: boolean;
}

export const blobsS3BucketName = "hellmen";
export const roomCollecName = "Rooms";
export const msgCollecName = "Msgs";
export const blobsCollecName = "Blobs";

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

export async function registerBlob({db, mime}: any): Promise<Blob>
{
    /*
        mime: string;
    issuedDate: Date;
    refCount: number;
    isReady: boolean;

     */
    const now = new Date(Date.now());

    const blob = {
        mime: mime,
        issuedDate: now,
        refCount: 0,
        isReady: false,
    } as Blob;

    const insertionResult =
        await db
            .collection(blobsCollecName)
            .insertOne(blob);

    blob.id = insertionResult.insertedId;

    return blob;
}

export async function deregisterBlob({db, id}: any): Promise<void>
{
    await db
        .collection(blobsCollecName)
        .deleteOne({
            _id: id,
        });
}

function mimeToExtension(mime: string): string
{
    switch ( mime )
    {
        case "image/jpeg":
            return "jpeg";
        case "image/png":
            return "png";
        default:
            throw `Unexpected mime type, which is "${mime}".`;
    }
}

export async function uploadBlob({db, s3, id, stream}: any): Promise<void>
{
    // Get mime.
    const queryResult = await db
        .collection(blobsCollecName)
        .find({_id: id})
        .project({_id: 0, mime: 1})
        .toArray();
    console.assert(queryResult.length == 1);
    const mime = queryResult[0].mime;

    const s3Params = {
        Bucket: blobsS3BucketName,
        Key: `${id.toString()}.${mimeToExtension(mime)}`,
        Body: stream.PassThrough(),
        ContentType: mime,
    }
    await s3.putObject(s3Params).promise();

    await db
        .collection(blobsCollecName)
        .updateOne(
            {
                _id: id,
            },
            {
                $set: {isReady: true},
            },
        );
}

export async function checkDeleteBlob({db, id}: any): Promise<void>
{
    const findResult = await db
        .collection(blobsCollecName)
        .find({_id: id})
        .project({_id: 0, refCount: 1})
        .toArray();
    console.assert(findResult.length == 1);

    if ( findResult[0].refCount == 0 )
    {
        await db
            .collection(blobsCollecName)
            .deleteOne({_id: id});
    }
    // ... else nothing to do.
}

export async function incBlobRefCount({db, id, amount = 1}: any): Promise<void>
{
    await db
        .collection(blobsCollecName)
        .updateOne(
            {_id: id},
            {$inc: {refCount: amount}},
        );
    await checkDeleteBlob({db, id});
}
