import avro from 'avsc';
import request from 'request-promise-native';
import esquemata from '../src';

const schemaregistryURL = process.env.SCHEMA_REGISTRY_URL || 'http://localhost:8081';

const testSchema = {
  type: 'record',
  name: 'topicOne',
  namespace: 'test.schema',
  fields: [
    {
      name: 'name',
      type: 'string'
    },
    {
      name: 'age',
      type: 'int'
    },
    {
      name: 'time',
      type: 'long',
      logicalType: 'timestamp-millis'
    }
  ]
};

beforeAll(async () => {
  const body = JSON.stringify({ schema: JSON.stringify(testSchema) });
  const postOpts = {
    method: 'POST',
    url: `${schemaregistryURL}/subjects/topicOne-value/versions`,
    body,
    headers: {
      'Content-Type': 'application/vnd.schemaregistry.v1+json',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  await request(postOpts);
});

afterAll(async () => {
  const deleteOpts = {
    method: 'DELETE',
    url: `${schemaregistryURL}/subjects/topicOne-value/versions/latest`
  };

  await request(deleteOpts);
});

test('Should load schemas that it was initiated with and serialiaze/deserialize JS object', async () => {
  const message = {
    name: 'Test Name',
    age: 25,
    time: Date.now()
  };

  const registry = esquemata({
    registryURL: schemaregistryURL,
    schemas: [
      {
        topic: 'topicOne'
      }
    ]
  });

  await registry.load();

  const schema = avro.Type.forSchema(testSchema);

  const encodedMessage = avro.parse(schema).toBuffer(message);
  const encodedMessageLength = encodedMessage.length;

  const finishedMessage = Buffer.alloc(encodedMessageLength + 5);
  finishedMessage.writeUInt8(0);
  finishedMessage.writeUInt32BE(1, 1);
  encodedMessage.copy(finishedMessage, 5);

  const serializedMessage = registry.serialize('topicOne', message);
  expect(serializedMessage).toEqual(finishedMessage);

  const deserializedMessage = registry.deserialize('topicOne', serializedMessage);
  expect(deserializedMessage).toEqual(message);
});
