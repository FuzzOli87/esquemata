import request from 'request-promise-native';
import avro from 'avsc';

// TODO Store schemas by schemaID
const magicByte = 0;
function jsonReviver(key, value) {
  if (key !== 'schema') {
    return value;
  }

  return JSON.parse(value);
}

class Esquemata {
  constructor({ registryURL, schemas }) {
    this.schemas = schemas;
    this.schemaURL = registryURL;
  }

  async load() {
    const { schemas, schemaURL } = this;

    const schemaResults = await Promise.all(
      schemas.map(async (schema) => {
        const { topic, version = 'latest' } = schema;

        const requestOpts = {
          uri: `${schemaURL}/subjects/${topic}-value/versions/${version}`,
          json: true,
          jsonReviver
        };

        const registrySchema = await request(requestOpts);

        return { topic, registrySchema };
      })
    );

    this.loadedSchemas = schemaResults.reduce((map, schemaResult) => {
      const { topic, registrySchema } = schemaResult;
      const { schema, ...schemaProps } = registrySchema;

      const schemaType = avro.Type.forSchema(schema);

      map.set(topic, { schemaType, ...schemaProps });

      return map;
    }, new Map());
  }

  serialize(topic, message) {
    const schemaProperties = this.loadedSchemas.get(topic);
    const { id, schemaType } = schemaProperties;

    const avroMessage = schemaType.toBuffer(message);
    const kafkaMsg = Buffer.alloc(avroMessage.length + 5);

    kafkaMsg.writeUInt8(magicByte);
    kafkaMsg.writeUInt32BE(id, 1);

    avroMessage.copy(kafkaMsg, 5);

    return kafkaMsg;
  }

  // TODO Look for schemas by schemaID
  deserialize(topic, messageBuffer) {
    // TODO Check magic byte, otherwise it's not a kafka message format
    const { schemaType } = this.loadedSchemas.get(topic);

    return schemaType.fromBuffer(messageBuffer.slice(5));
  }
}

// TODO Check params!
export default function esquemata(opts = {}) {
  return new Esquemata(opts);
}
