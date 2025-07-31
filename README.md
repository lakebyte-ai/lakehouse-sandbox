# Lakehouse Sandbox (Iceberg + Polaris + MinIO + Trino + Spark Sanbox)

## Setup

```bash
docker compose up
```

- **Trino**  
  - Web UI for monitoring: http://localhost:8080 (login: `admin`)  
  - SQL client: `docker compose exec trino trino --server localhost:8080 --catalog iceberg`

- **Jupyter notebook w/Spark**  
  - http://localhost:8888/notebooks

- **MinIO**  
  - Web UI: http://localhost:9000 (login: `admin` / `password`)  
  - CLI: `docker compose exec minio-client mc`  
  - e.g.: `docker compose exec minio-client mc ls -r minio/warehouse/db`

- **Polaris**  
  - No UI, but you can use Nimtable for WebUI, or use the API directly.  
  - The `polaris-config` container configures Polaris using the `setup.sh` script to set up security and create an initial namespace.

- **Nimtable**  
  - Web UI: http://localhost:13000 (login: `admin` / `admin`)

## Kafka Setup (Optional)

Run Kafka 3.7.0 cluster with 3 brokers in KRaft mode (no Zookeeper required):

```bash
docker-compose -f docker-compose.kafka.yml up -d
```

### Kafka Services

- **Kafka Brokers**: 3-node cluster for high availability
  - kafka1: http://localhost:9092
  - kafka2: http://localhost:9093  
  - kafka3: http://localhost:9094
- **Kafka UI**: http://localhost:8090 (manage topics, view messages)

### Kafka Consumer Examples

**Python Consumer:**
```python
from kafka import KafkaConsumer
import json

# Connect to Kafka cluster
consumer = KafkaConsumer(
    'your-topic',
    bootstrap_servers=['localhost:9092', 'localhost:9093', 'localhost:9094'],
    value_deserializer=lambda x: json.loads(x.decode('utf-8')),
    group_id='my-consumer-group'
)

# Consume messages
for message in consumer:
    print(f"Topic: {message.topic}")
    print(f"Partition: {message.partition}")
    print(f"Offset: {message.offset}")
    print(f"Value: {message.value}")
```

**Java Consumer:**
```java
Properties props = new Properties();
props.put("bootstrap.servers", "localhost:9092,localhost:9093,localhost:9094");
props.put("group.id", "my-consumer-group");
props.put("key.deserializer", "org.apache.kafka.common.serialization.StringDeserializer");
props.put("value.deserializer", "org.apache.kafka.common.serialization.StringDeserializer");

KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props);
consumer.subscribe(Arrays.asList("your-topic"));

while (true) {
    ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(100));
    for (ConsumerRecord<String, String> record : records) {
        System.out.printf("Topic: %s, Partition: %d, Offset: %d, Value: %s%n",
            record.topic(), record.partition(), record.offset(), record.value());
    }
}
```

**Command Line Consumer:**
```bash
# Create a topic
docker exec kafka1 kafka-topics --create --topic test-topic --bootstrap-server localhost:29092 --partitions 3 --replication-factor 3

# Start consumer
docker exec kafka1 kafka-console-consumer --topic test-topic --bootstrap-server localhost:29092 --from-beginning

# Produce messages (in another terminal)
docker exec kafka1 kafka-console-producer --topic test-topic --bootstrap-server localhost:29092
```

### Integration with Lakehouse

Connect Kafka to your data lakehouse for real-time streaming:

```python
# Stream from Kafka to Iceberg using Spark
spark.readStream \
    .format("kafka") \
    .option("kafka.bootstrap.servers", "kafka1:29092,kafka2:29092,kafka3:29092") \
    .option("subscribe", "events") \
    .load() \
    .writeStream \
    .format("iceberg") \
    .outputMode("append") \
    .option("path", "s3a://warehouse/db/events") \
    .start()
```

## Questions

#proj-datalakehouse-pilot