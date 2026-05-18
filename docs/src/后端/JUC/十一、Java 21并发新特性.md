Java 21（LTS）是 2023 年 9 月发布的长期支持版本，带来了并发编程领域最具影响力的变革——**虚拟线程（Virtual Threads）**，标志着 Java 在高并发编程模型上迈入新阶段。

## 11.1 虚拟线程

### 11.1.1 为什么需要虚拟线程

传统线程（平台线程 Platform Thread）由操作系统内核直接管理，创建和切换开销大。在高并发场景（如 Web 服务、微服务网关）中，大量线程阻塞等待 I/O 会导致：
- 线程创建过多，内存耗尽
- 上下文切换开销巨大，CPU 利用率下降
- 线程池参数调优复杂且效果有限

**虚拟线程**（Project Loom，JEP 444）由 JVM 在用户空间管理，与操作系统线程解耦：**数百万虚拟线程可映射到少量平台线程**，I/O 阻塞时自动挂起，不占用 OS 线程资源。

| 特性 | 平台线程（Platform Thread） | 虚拟线程（Virtual Thread） |
|:---|:---|:---|
| **实现层级** | OS 内核线程 | JVM 用户空间线程 |
| **内存占用** | 约 1~2 MB 栈空间 | 仅几百字节初始栈 |
| **创建速度** | 慢（需 OS 参与） | 极快（纯 JVM 操作） |
| **调度** | OS 调度器 | JVM 调度器（挂载到平台线程运行） |
| **阻塞代价** | 阻塞 OS 线程，资源浪费 | 挂起虚拟线程，释放 OS 线程 |
| **适用场景** | CPU 密集型任务 | I/O 密集型、高并发连接 |

### 11.1.2 创建虚拟线程

```java
// Java 21 创建虚拟线程的三种方式

public class VirtualThreadDemo {

    // 方式一：直接启动虚拟线程
    public void way1() {
        Thread.startVirtualThread(() -> {
            System.out.println("虚拟线程运行中: " + Thread.currentThread());
        });
    }

    // 方式二：通过 Thread.ofVirtual() 构建器
    public void way2() {
        Thread vt = Thread.ofVirtual()
            .name("vt-worker-", 0)  // 命名前缀 + 序号
            .unstarted(() -> {
                System.out.println("虚拟线程: " + Thread.currentThread().getName());
            });
        vt.start();
    }

    // 方式三：通过 ExecutorService（推荐，可自动关闭）
    public void way3() {
        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            // 每个任务自动分配一个虚拟线程
            executor.submit(() -> System.out.println("任务1"));
            executor.submit(() -> System.out.println("任务2"));
            executor.submit(() -> System.out.println("任务3"));
        } // 自动关闭
    }

    // 方式四：线程工厂创建
    public void way4() {
        ThreadFactory factory = Thread.ofVirtual().factory();
        Thread t = factory.newThread(() -> System.out.println("工厂创建的虚拟线程"));
        t.start();
    }
}
```

### 11.1.3 虚拟线程与线程池

Java 21 推荐用 `Executors.newVirtualThreadPerTaskExecutor()` 替代传统线程池处理 I/O 密集型任务：

```java
public class VirtualThreadServer {

    // ❌ 传统方式：需要精心调优线程池参数
    private final ExecutorService platformPool = new ThreadPoolExecutor(
        100, 500, 60L, TimeUnit.SECONDS,
        new LinkedBlockingQueue<>(10000)
    );

    // ✅ Java 21 方式：一个虚拟线程处理一个请求，无需调优
    public void startServer(int port) throws IOException {
        try (ServerSocket server = new ServerSocket(port);
             ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {

            while (true) {
                Socket client = server.accept();
                // 每个连接一个虚拟线程，轻松支撑百万并发
                executor.submit(() -> handleRequest(client));
            }
        }
    }

    private void handleRequest(Socket client) {
        try (client) {
            // 虚拟线程中 I/O 阻塞不会占用 OS 线程
            BufferedReader in = new BufferedReader(
                new InputStreamReader(client.getInputStream()));
            String request = in.readLine(); // 阻塞时虚拟线程自动挂起
            // 处理请求...
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

### 11.1.4 使用注意事项

| 注意点 | 说明 |
|:---|:---|
| **避免在虚拟线程中使用 `synchronized`** | `synchronized` 会导致**线程固定（Pinning）**，阻塞底层平台线程，失去虚拟线程意义。建议优先使用 `ReentrantLock`（JEP 491 在 JDK 24 中彻底解决此问题） |
| **避免在虚拟线程中执行本地方法/外部函数** | native method 或 foreign function 会固定虚拟线程，无法卸载 |
| **ThreadLocal 开销大** | 每个虚拟线程都有 ThreadLocalMap，百万虚拟线程会消耗大量内存。建议用 **Scoped Values**（JEP 446）替代 |
| **避免 CPU 密集型任务** | 虚拟线程不会提升计算密集型任务性能，反而因调度开销降低效率 |
| **监控调试** | `jstack` 显示虚拟线程状态，可用 `jcmd Thread.dump_to_file` 导出 |

```java
// 虚拟线程中优先使用 ReentrantLock 替代 synchronized
public class VirtualThreadSafe {
    private final ReentrantLock lock = new ReentrantLock();
    private int count = 0;

    public void increment() {
        lock.lock(); // ✅ 虚拟线程友好
        try {
            count++;
        } finally {
            lock.unlock();
        }
    }

    public void badIncrement() {
        synchronized (this) { // ⚠️ 可能导致 pinning（JDK 21 仍存在此问题，JDK 24 JEP 491 彻底解决）
            count++;
        }
    }
}
```

### 11.1.5 判断当前线程是否为虚拟线程

```java
public void checkThread() {
    Thread t = Thread.currentThread();
    System.out.println("是否虚拟线程: " + t.isVirtual());
    System.out.println("线程名: " + t.getName());

    // 获取当前平台线程载体（虚拟线程挂载到的 OS 线程）
    if (t.isVirtual()) {
        // 虚拟线程的运行载体
    }
}
```

---

## 11.2 结构化并发

结构化并发（JEP 453，Java 21 为**首个预览版**，前两轮 JDK 19/20 为孵化器阶段）让多任务并发代码像单线程代码一样清晰易读，所有子任务必须在父作用域内完成。

```java
// Java 21 预览特性，需添加 --enable-preview
import java.util.concurrent.StructuredTaskScope;

public class StructuredConcurrencyDemo {

    // 场景：并发查询用户信息、订单信息，同时超时控制
    public Response fetchUserData(int userId) throws Exception {
        try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
            // 启动多个子任务
            StructuredTaskScope.Subtask<User> userTask =
                scope.fork(() -> fetchUser(userId));
            StructuredTaskScope.Subtask<List<Order>> orderTask =
                scope.fork(() -> fetchOrders(userId));

            scope.join();           // 等待所有子任务完成
            scope.throwIfFailed();  // 任一失败则取消其他任务并抛异常

            return new Response(userTask.get(), orderTask.get());
        }
    }

    private User fetchUser(int userId) { /* ... */ return new User(); }
    private List<Order> fetchOrders(int userId) { /* ... */ return List.of(); }
}
```

**StructuredTaskScope 的两种策略**：

| 策略 | 说明 | 适用场景 |
|:---|:---|:---|
| `ShutdownOnFailure()` | 任一子任务失败，立即取消其他子任务 | 所有子任务都必须成功 |
| `ShutdownOnSuccess<T>()` | 任一子任务成功，立即取消其他子任务 | 只需要最快成功的结果 |

> **注意**：结构化并发目前仍是**预览特性**，生产环境使用前需关注其转正状态。

---

## 11.3 作用域值

**Scoped Values**（JEP 446，Java 21 为**首个预览版**，JDK 20 JEP 429 为孵化器阶段）是 `ThreadLocal` 的现代化替代方案，专为虚拟线程设计，具有**不可变性**和**低内存占用**优势。

| 特性 | ThreadLocal | Scoped Value |
|:---|:---|:---|
| **可变性** | 可变（可重复 set） | 不可变（绑定后不可修改） |
| **内存占用** | 每个线程一份，虚拟线程下爆炸增长 | 共享只读，虚拟线程下开销极低 |
| **子线程继承** | 需 `InheritableThreadLocal` | 自动绑定到子作用域 |
| **清理** | 需手动 `remove()` | 作用域结束自动清理 |
| **使用场景** | 传统线程模型 | 虚拟线程 + 结构化并发 |

```java
// Java 21 预览特性，需添加 --enable-preview
public class ScopedValueDemo {

    // 声明一个 Scoped Value（类似 final static ThreadLocal）
    public static final ScopedValue<String> REQUEST_ID = ScopedValue.newInstance();

    public void handleRequest(String requestId) {
        // 在当前作用域内绑定值
        ScopedValue.runWhere(REQUEST_ID, requestId, () -> {
            // 作用域内任何位置均可获取
            System.out.println("当前请求ID: " + REQUEST_ID.get());

            // 子作用域会自动继承父作用域的值
            ScopedValue.runWhere(REQUEST_ID, requestId + "-sub", () -> {
                System.out.println("子作用域请求ID: " + REQUEST_ID.get());
            });

            // 父作用域值不变
            System.out.println("父作用域请求ID: " + REQUEST_ID.get());
        });

        // 作用域外调用 get() 会抛异常
    }
}
```

---

## 11.4 Java 21其他并发相关改进

### 11.4.1 Thread与ExecutorService新API

```java
// Thread.sleep 支持 Duration（JDK 19 引入，JDK 21 可用）
Thread.sleep(Duration.ofMillis(500));

// ReentrantLock.tryLock 支持 Duration（JDK 19 引入，JDK 21 可用）
ReentrantLock lock = new ReentrantLock();
lock.tryLock(Duration.ofSeconds(5)); // 更方便的超时指定

// ExecutorService 自动关闭（Java 19+ try-with-resources）
// 注意：close() 默认无限期等待所有任务完成，生产环境建议自定义超时
try (ExecutorService executor = Executors.newFixedThreadPool(4)) {
    executor.submit(() -> System.out.println("自动关闭"));
} // shutdown + awaitTermination 自动完成
```

### 11.4.2 ForkJoinPool默认值变化

Java 21 中 `ForkJoinPool.commonPool()` 的**并行度（parallelism）**计算公式未改变，仍为 `Runtime.getRuntime().availableProcessors() - 1`（可通过系统属性 `java.util.concurrent.ForkJoinPool.common.parallelism` 覆盖）。但 Java 21 引入了独立的**虚拟线程调度器**（基于 `ForkJoinPool` 的 work-stealing 机制），该调度器的并行度默认等于可用处理器数，专门负责虚拟线程的挂载与卸载，与 `commonPool()` 解耦。

| 版本 | `ForkJoinPool.commonPool()` 并行度 |
|:---|:---|
| Java 8~21 | `Runtime.getRuntime().availableProcessors() - 1` |
| 虚拟线程调度器（Java 21+） | 默认等于 `availableProcessors()`，独立于 commonPool |

---

## 11.5 Java 21并发编程实践建议

| 场景 | Java 8~17 方案 | Java 21 推荐方案 |
|:---|:---|:---|
| **Web 服务请求处理** | Tomcat/Jetty 线程池（200~500 线程） | 虚拟线程，一个请求一个虚拟线程 |
| **数据库连接池 + ORM** | HikariCP + 有限平台线程 | 虚拟线程 + HikariCP（连接数不再受线程数限制） |
| **异步 HTTP 客户端** | `CompletableFuture` + 回调地狱 | 虚拟线程 + 同步代码（代码更清晰） |
| **微服务网关** | WebFlux / Netty（响应式编程） | 虚拟线程 + Tomcat/Netty（同步代码获异步性能） |
| **线程上下文传递** | `ThreadLocal` + `InheritableThreadLocal` | `ScopedValue`（预览特性，关注转正） |
| **多任务并发+超时** | `CompletableFuture.allOf()` + 手动超时 | `StructuredTaskScope`（预览特性） |

> **Spring Boot 3.2+** 已原生支持虚拟线程，只需在 `application.properties` 中配置 `spring.threads.virtual.enabled=true` 即可让 Tomcat/Netty 使用虚拟线程处理请求。

---

> **笔记维护记录**  
> 整理时间：2026-05-18  
> 核查修正时间：2026-05-18  
> 涵盖版本：Java 8 ~ Java 21（核心特性覆盖全版本，已按 JDK 21 最新标准校准）
