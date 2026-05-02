
> **说明**：Redis 官方推荐 Java 客户端主要有三个：Jedis、Lettuce 和 Spring Data Redis。Spring Boot 3.x 默认集成的是 Lettuce，但在 Spring Boot 2.x 时代用得最多的是 Jedis。本章重点讲解 Spring Data Redis。

## 3.1 快速入门

### 3.1.1 环境准备

创建一个 Spring Boot 项目，引入以下依赖：

```xml
<!-- Spring Data Redis 依赖（包含了 Jedis/Lettuce 客户端） -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>

<!-- 连接池依赖（若使用 Lettuce 连接池） -->
<dependency>
    <groupId>org.apache.commons</groupId>
    <artifactId>commons-pool2</artifactId>
</dependency>
```

### 3.1.2 配置文件

在 `application.yml` 中配置连接信息：

```yaml
spring:
  data:
    redis:
      host: 192.168.150.101   # Redis 主机地址
      port: 6379               # 端口
      password: 123321         # 密码（如果没有密码则省略）
      lettuce:
        pool:
          max-active: 8        # 最大连接数
          max-idle: 8         # 最大空闲连接
          min-idle: 0         # 最小空闲连接
          max-wait: 100ms     # 最大等待时间
```

### 3.1.3 快速使用

```java
@SpringBootTest
class RedisApplicationTests {

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @Test
    void testString() {
        // 写入 String 类型
        redisTemplate.opsForValue().set("name", "Jack");
        String name = (String) redisTemplate.opsForValue().get("name");
        System.out.println("name = " + name);

        // 写入带有过期时间的 key
        redisTemplate.opsForValue().set("code", "1234", Duration.ofMinutes(5));

        // 自增
        redisTemplate.opsForValue().increment("count");
    }

    @Test
    void testHash() {
        // 写入 Hash
        redisTemplate.opsForHash().put("user:1", "name", "Rose");
        redisTemplate.opsForHash().put("user:1", "age", "21");

        // 读取 Hash 字段
        Object name = redisTemplate.opsForHash().get("user:1", "name");
        System.out.println("name = " + name);
    }
}
```

## 3.2 StringRedisTemplate

Spring Boot 自动配置了 `RedisTemplate` 和 `StringRedisTemplate`。`StringRedisTemplate` 是专门处理 String 类型的模板，key 和 value 都是 String，更加方便。

### 3.2.1 与 RedisTemplate 的区别

| 对比项 | RedisTemplate | StringRedisTemplate |
|---|---|---|
| key 序列化器 | JdkSerializationRedisSerializer（默认二进制） | StringRedisSerializer |
| value 序列化器 | JdkSerializationRedisSerializer（默认二进制） | StringRedisSerializer |
| key 可读性 | 二进制序列化，不直观 | 字符串序列化，可读性好 |
| 跨语言兼容性 | 只能 Java 使用 | 可读性好，跨语言通用 |

> **推荐**：通常使用 `StringRedisTemplate`，key 和 value 都以字符串形式存储，便于调试和跨语言使用。

### 3.2.2 StringRedisTemplate 实战

```java
@Autowired
private StringRedisTemplate stringRedisTemplate;

// 操作 String
@Test
void testStrOps() {
    stringRedisTemplate.opsForValue().set("heima:user:1", "Rose");
    String val = stringRedisTemplate.opsForValue().get("heima:user:1");
    System.out.println(val);  // Rose

    // 统计访问次数
    stringRedisTemplate.opsForValue().increment("count:2024:01:01");
}

// 操作 Hash
@Test
void testHashOps() {
    Map<String, String> user = new HashMap<>();
    user.put("name", "Jack");
    user.put("age", "25");

    stringRedisTemplate.opsForHash().putAll("heima:user:2", user);

    String name = (String) stringRedisTemplate.opsForHash().get("heima:user:2", "name");
    Long age = stringRedisTemplate.opsForHash().increment("heima:user:2", "age", 1);
    System.out.println("name=" + name + ", age=" + age);
}

// 操作 List
@Test
void testListOps() {
    stringRedisTemplate.opsForList().leftPushAll("queue:tasks", "task1", "task2", "task3");
    String task = stringRedisTemplate.opsForList().rightPop("queue:tasks");
    System.out.println("处理任务: " + task);
}

// 操作 Set
@Test
void testSetOps() {
    stringRedisTemplate.opsForSet().add("tag:java", "Spring", "MyBatis", "Redis");
    Long size = stringRedisTemplate.opsForSet().size("tag:java");
    System.out.println("标签数量: " + size);
}

// 操作 SortedSet
@Test
void testZSetOps() {
    stringRedisTemplate.opsForZSet().add("ranking", "Alice", 100);
    stringRedisTemplate.opsForZSet().add("ranking", "Bob", 95);
    stringRedisTemplate.opsForZSet().add("ranking", "Carol", 98);

    // 获取排名前3
    Set<String> top3 = stringRedisTemplate.opsForZSet().reverseRange("ranking", 0, 2);
    top3.forEach(System.out::println);  // Alice, Carol, Bob
}
```

## 3.3 Redis 序列化问题

`RedisTemplate` 默认使用 JDK 序列化，存入 Redis 后 key 会带有乱码前缀（`\xac\xed\x00\x05t\x00...`），不直观且跨语言不兼容。

### 3.3.1 自定义 RedisTemplate 统一使用 String 序列化

```java
@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);

        // 使用 String 序列化 key
        template.setKeySerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());

        // 使用 JSON 序列化 value
        template.setValueSerializer(new GenericJackson2JsonRedisSerializer());
        template.setHashValueSerializer(new GenericJackson2JsonRedisSerializer());

        template.afterPropertiesSet();
        return template;
    }
}
```

### 3.3.2 最佳实践：直接使用 StringRedisTemplate + JSON 工具

在实际项目中，通常**直接使用** `StringRedisTemplate`，由应用层自己负责对象与 JSON 字符串之间的转换（推荐使用 Jackson 或 FastJSON）：

```java
@Autowired
private StringRedisTemplate stringRedisTemplate;

private static final ObjectMapper mapper = new ObjectMapper();

// 存储对象
public void saveUser(User user) throws JsonProcessingException {
    String json = mapper.writeValueAsString(user);
    stringRedisTemplate.opsForValue().set("user:" + user.getId(), json);
}

// 读取对象
public User getUser(Long id) throws JsonProcessingException {
    String json = stringRedisTemplate.opsForValue().get("user:" + id);
    return json == null ? null : mapper.readValue(json, User.class);
}
```

## 3.4 Jedis 客户端

Jedis 是早期使用最广泛的 Redis Java 客户端。Spring Boot 2.x 之后默认不再直接集成 Jedis，而是集成了 Lettuce。如果需要使用 Jedis，需要额外引入依赖。

### 3.4.1 Jedis 连接池

```xml
<dependency>
    <groupId>redis.clients</groupId>
    <artifactId>jedis</artifactId>
    <version>4.3.1</version>
</dependency>
```

```java
public class JedisTest {
    public static void main(String[] args) {
        // 创建 Jedis 连接池配置
        JedisPoolConfig config = new JedisPoolConfig();
        config.setMaxTotal(8);
        config.setMaxIdle(8);
        config.setMinIdle(0);

        // 创建 Jedis 连接池
        JedisPool pool = new JedisPool(config, "192.168.150.101", 6379, 1000, "123321");

        // 获取连接
        try (Jedis jedis = pool.getResource()) {
            // 操作 String
            jedis.set("name", "Jack");
            String name = jedis.get("name");
            System.out.println(name);

            // 自增
            jedis.incr("count");

            // 操作 Hash
            jedis.hset("user:1", "name", "Rose");
            jedis.hset("user:1", "age", "21");
            Map<String, String> user = jedis.hgetAll("user:1");
            System.out.println(user);
        }

        pool.close();
    }
}
```

---

