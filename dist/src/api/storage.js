"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memory = void 0;
exports.eventFor = eventFor;
exports.safePersist = safePersist;
exports.getStoredLeads = getStoredLeads;
exports.getStoredPayments = getStoredPayments;
exports.resetStoredData = resetStoredData;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const config_1 = require("./config");
exports.memory = {
    leads: [],
    payments: [],
    events: [],
};
const dynamo = config_1.TABLE_NAME ? new client_dynamodb_1.DynamoDBClient({}) : null;
function eventFor(actionId, status, detail, amount) {
    return {
        eventId: (0, config_1.makeId)('evt'),
        actionId,
        businessId: config_1.BUSINESS_ID,
        status,
        detail,
        timestamp: (0, config_1.nowIso)(),
        protocol: config_1.PAYMENT_PROTOCOL,
        network: config_1.NETWORK,
        amount,
    };
}
async function safePersist(kind, id, item) {
    try {
        await persistEntity(kind, id, item);
    }
    catch (error) {
        console.warn('DynamoDB persistence failed, continuing with in-memory store', {
            kind,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
async function getStoredLeads() {
    try {
        const leads = await queryEntities('LEAD');
        return leads.length ? leads : exports.memory.leads;
    }
    catch {
        return exports.memory.leads;
    }
}
async function getStoredPayments() {
    try {
        const [payments, events] = await Promise.all([
            queryEntities('PAYMENT'),
            queryEntities('PAYMENT_EVENT'),
        ]);
        return {
            payments: payments.length ? payments : exports.memory.payments,
            events: events.length ? events : exports.memory.events,
        };
    }
    catch {
        return { payments: exports.memory.payments, events: exports.memory.events };
    }
}
async function resetStoredData() {
    exports.memory.leads = [];
    exports.memory.payments = [];
    exports.memory.events = [];
    try {
        return {
            memoryCleared: true,
            dynamoDeleted: await deleteBusinessItems(),
        };
    }
    catch (error) {
        return {
            memoryCleared: true,
            dynamoDeleted: 0,
            dynamoError: error instanceof Error ? error.message : String(error),
        };
    }
}
async function persistEntity(kind, id, item) {
    if (!dynamo || !config_1.TABLE_NAME)
        return;
    const createdAt = typeof item === 'object' && item && 'createdAt' in item
        ? String(item.createdAt)
        : (0, config_1.nowIso)();
    await dynamo.send(new client_dynamodb_1.PutItemCommand({
        TableName: config_1.TABLE_NAME,
        Item: {
            pk: { S: `BUSINESS#${config_1.BUSINESS_ID}` },
            sk: { S: `${kind}#${createdAt}#${id}` },
            entityType: { S: kind },
            businessId: { S: config_1.BUSINESS_ID },
            createdAt: { S: createdAt },
            data: { S: JSON.stringify(item) },
        },
    }));
}
async function queryEntities(kind) {
    if (!dynamo || !config_1.TABLE_NAME)
        return [];
    const response = await dynamo.send(new client_dynamodb_1.QueryCommand({
        TableName: config_1.TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: {
            ':pk': { S: `BUSINESS#${config_1.BUSINESS_ID}` },
            ':prefix': { S: `${kind}#` },
        },
        ScanIndexForward: false,
        Limit: 50,
    }));
    return (response.Items ?? [])
        .map((item) => item.data?.S)
        .filter((value) => Boolean(value))
        .map((value) => JSON.parse(value));
}
async function deleteBusinessItems() {
    if (!dynamo || !config_1.TABLE_NAME)
        return 0;
    let deleted = 0;
    let exclusiveStartKey;
    do {
        const response = await dynamo.send(new client_dynamodb_1.QueryCommand({
            TableName: config_1.TABLE_NAME,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: {
                ':pk': { S: `BUSINESS#${config_1.BUSINESS_ID}` },
            },
            ProjectionExpression: 'pk, sk',
            ExclusiveStartKey: exclusiveStartKey,
        }));
        const deletes = (response.Items ?? [])
            .filter((item) => item.pk && item.sk)
            .map((item) => ({
            DeleteRequest: {
                Key: {
                    pk: item.pk,
                    sk: item.sk,
                },
            },
        }));
        for (let index = 0; index < deletes.length; index += 25) {
            const batch = deletes.slice(index, index + 25);
            await dynamo.send(new client_dynamodb_1.BatchWriteItemCommand({
                RequestItems: {
                    [config_1.TABLE_NAME]: batch,
                },
            }));
            deleted += batch.length;
        }
        exclusiveStartKey = response.LastEvaluatedKey;
    } while (exclusiveStartKey);
    return deleted;
}
//# sourceMappingURL=storage.js.map