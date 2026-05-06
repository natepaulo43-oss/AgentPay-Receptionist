import {
  BatchWriteItemCommand,
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  type WriteRequest,
} from '@aws-sdk/client-dynamodb';
import {
  BUSINESS_ID,
  NETWORK,
  PAYMENT_PROTOCOL,
  TABLE_NAME,
  makeId,
  nowIso,
} from './config';
import type { Lead, PaidAction, PaymentEvent, PersistKind, TimelineStatus } from './types';

export const memory = {
  leads: [] as Lead[],
  payments: [] as PaidAction[],
  events: [] as PaymentEvent[],
};

const dynamo = TABLE_NAME ? new DynamoDBClient({}) : null;

export function eventFor(
  actionId: string,
  status: TimelineStatus,
  detail: string,
  amount?: string,
): PaymentEvent {
  return {
    eventId: makeId('evt'),
    actionId,
    businessId: BUSINESS_ID,
    status,
    detail,
    timestamp: nowIso(),
    protocol: PAYMENT_PROTOCOL,
    network: NETWORK,
    amount,
  };
}

export async function safePersist(kind: PersistKind, id: string, item: unknown): Promise<void> {
  try {
    await persistEntity(kind, id, item);
  } catch (error) {
    console.warn('DynamoDB persistence failed, continuing with in-memory store', {
      kind,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getStoredLeads(): Promise<Lead[]> {
  try {
    const leads = await queryEntities<Lead>('LEAD');
    return leads.length ? leads : memory.leads;
  } catch {
    return memory.leads;
  }
}

export async function getStoredPayments(): Promise<{ payments: PaidAction[]; events: PaymentEvent[] }> {
  try {
    const [payments, events] = await Promise.all([
      queryEntities<PaidAction>('PAYMENT'),
      queryEntities<PaymentEvent>('PAYMENT_EVENT'),
    ]);
    return {
      payments: payments.length ? payments : memory.payments,
      events: events.length ? events : memory.events,
    };
  } catch {
    return { payments: memory.payments, events: memory.events };
  }
}

export async function resetStoredData(): Promise<{
  memoryCleared: boolean;
  dynamoDeleted: number;
  dynamoError?: string;
}> {
  memory.leads = [];
  memory.payments = [];
  memory.events = [];

  try {
    return {
      memoryCleared: true,
      dynamoDeleted: await deleteBusinessItems(),
    };
  } catch (error) {
    return {
      memoryCleared: true,
      dynamoDeleted: 0,
      dynamoError: error instanceof Error ? error.message : String(error),
    };
  }
}

async function persistEntity(kind: PersistKind, id: string, item: unknown): Promise<void> {
  if (!dynamo || !TABLE_NAME) return;
  const createdAt = typeof item === 'object' && item && 'createdAt' in item
    ? String((item as { createdAt: unknown }).createdAt)
    : nowIso();
  await dynamo.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: { S: `BUSINESS#${BUSINESS_ID}` },
        sk: { S: `${kind}#${createdAt}#${id}` },
        entityType: { S: kind },
        businessId: { S: BUSINESS_ID },
        createdAt: { S: createdAt },
        data: { S: JSON.stringify(item) },
      },
    }),
  );
}

async function queryEntities<T>(kind: PersistKind): Promise<T[]> {
  if (!dynamo || !TABLE_NAME) return [];
  const response = await dynamo.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': { S: `BUSINESS#${BUSINESS_ID}` },
        ':prefix': { S: `${kind}#` },
      },
      ScanIndexForward: false,
      Limit: 50,
    }),
  );
  return (response.Items ?? [])
    .map((item) => item.data?.S)
    .filter((value): value is string => Boolean(value))
    .map((value) => JSON.parse(value) as T);
}

async function deleteBusinessItems(): Promise<number> {
  if (!dynamo || !TABLE_NAME) return 0;

  let deleted = 0;
  let exclusiveStartKey: Record<string, { S: string }> | undefined;

  do {
    const response = await dynamo.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': { S: `BUSINESS#${BUSINESS_ID}` },
        },
        ProjectionExpression: 'pk, sk',
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    const deletes: WriteRequest[] = (response.Items ?? [])
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
      await dynamo.send(
        new BatchWriteItemCommand({
          RequestItems: {
            [TABLE_NAME]: batch,
          },
        }),
      );
      deleted += batch.length;
    }

    exclusiveStartKey = response.LastEvaluatedKey as Record<string, { S: string }> | undefined;
  } while (exclusiveStartKey);

  return deleted;
}
