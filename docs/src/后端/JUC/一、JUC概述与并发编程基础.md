## 1.1 JUC简介

**JUC（java.util.concurrent）** 是 Java 5 引入的并发编程工具包，提供线程池、锁机制、原子类、并发集合、同步工具等核心组件，是 Java 高并发编程的基石。

**JUC 核心设计理念：**
- **分离锁与同步机制**：将 Lock、Condition、Atomic、并发容器等组件解耦，按需使用
- **CAS 无锁优化**：基于 CPU 原语的 CAS 实现无锁并发，减少线程阻塞开销
- **线程池化**：通过线程池管理线程生命周期，避免频繁创建/销毁线程
- **并发容器**：针对多线程场景优化的集合类，替代线程不安全的 HashMap、ArrayList

## 1.2 版本演进关键节点

| JDK 版本 | 关键变化 |
|:---|:---|
| **Java 5** | 首次引入 JUC 核心组件（Lock、线程池、原子类、并发容器） |
| **Java 6** | ConcurrentHashMap 性能优化，synchronized 锁升级（偏向锁/轻量级锁/重量级锁） |
| **Java 7** | Fork/Join 框架完善，ConcurrentHashMap 分段锁优化，Phaser、TransferQueue |
| **Java 8** | **LongAdder、CompletableFuture、StampedLock** 新增，ConcurrentHashMap CAS 替代分段锁，Stream.parallel |
| **Java 9** | Flow API 响应式编程，CompletableFuture 增强（delayedExecutor、newIncompleteFuture） |
| **Java 17** | 强化版伪共享（@Contended），RandomGenerator 接口 |
| **Java 21** | **虚拟线程（Virtual Threads）、结构化并发（预览）、作用域值（预览）** |

> **本笔记前十一章聚焦于生产实际的直接落地用法与示例，第十二章集中讲解 Java 21 新特性。**

---


## 1.3 JMM 内存模型

### 1.3.1 JMM核心概念

**JMM（Java Memory Model）** 是 Java 定义的并发编程相关的一组**抽象规范**，屏蔽了底层不同硬件和操作系统访问内存的差异，让 Java 程序在各平台上都能有一致的内存访问效果。

JMM 将内存划分为主内存（Main Memory）和本地内存（Local Memory）：

- **主内存**：所有线程共享，存储实例对象、静态变量等
- **本地内存**：每个线程私有，存储共享变量的副本（涵盖缓存、写缓冲区、寄存器等）

线程间通信必须经过主内存：线程 A 修改 → 刷新到主内存 → 线程 B 从主内存读取。

### 1.3.2 并发编程三大特性

| 特性 | 定义 | 保障手段 |
|:---|:---|:---|
| **原子性** | 操作要么全部执行成功，要么完全不执行，不可中断 | `synchronized`、各种 `Lock`、原子类（基于 CAS） |
| **可见性** | 一个线程修改共享变量后，其他线程立即可见最新值 | `volatile`、`synchronized`、各种 `Lock` |
| **有序性** | 程序执行顺序符合代码编写顺序，不因重排序导致异常 | `volatile`（禁止指令重排序）、`synchronized` |

> `synchronized` / `Lock` **同时保证** 原子性 + 可见性 + 有序性；`volatile` **保证** 可见性 + 有序性，**不保证** 原子性。

### 1.3.3 happens-before规则

happens-before 表达的不是时间上的先后，而是**前一个操作的结果对后一个操作可见**。

| 规则 | 说明 |
|:---|:---|
| **程序顺序规则** | 一个线程内，书写在前的操作 happens-before 书写在后的操作 |
| **解锁规则** | 解锁（unlock）happens-before 于后续的加锁（lock） |
| **volatile 变量规则** | 对 volatile 变量的写 happens-before 于后续对该变量的读 |
| **传递规则** | 若 A happens-before B，且 B happens-before C，则 A happens-before C |
| **线程启动规则** | Thread.start() happens-before 于该线程的每个动作 |
| **线程终止规则** | 线程中所有操作 happens-before 于该线程的终止检测 |
| **线程中断规则** | 对线程 interrupt() 的调用 happens-before 于被中断线程检测到中断事件 |
| **对象终结规则** | 构造函数执行 happens-before 于 finalize() |

### 1.3.4 指令重排序

指令重排序是 JVM / JIT 编译器在不改变**单线程执行结果**的前提下，对代码执行顺序进行调整的优化手段。

| 重排序类型 | 发生阶段 | 说明 |
|:---|:---|:---|
| **编译器优化重排** | 编译期 | JVM 编译器在不影响单线程语义时重排语句 |
| **指令并行重排** | 处理器执行期 | 利用 ILP 重叠执行无数据依赖的指令 |
| **内存系统重排** | 内存访问层 | 主存与本地内存内容不一致导致的"表现上的重排序" |

**内存屏障（Memory Barrier）** 的作用：
- 禁止指令重排序
- 强制刷新写缓冲区到主内存（保障可见性）
- 使本地缓存失效，强制从主内存读取最新值

```java
public class ReorderingDemo {
    private static int a = 0, b = 0, x = 0, y = 0;

    public static void main(String[] args) throws InterruptedException {
        // 线程1执行: a=1; x=b;
        // 线程2执行: b=1; y=a;
        // 在单线程视角下，a=1,b=1,x=0,y=0 或 a=1,b=1,x=1,y=1 都不可能
        // 但多线程下由于指令重排序，可能出现 x=0,y=1 或 x=1,y=0
        // 加上 volatile 或 synchronized 可以禁止重排序，保证有序性
    }
}
```

---

## 1.4 线程基础

### 1.4.1 进程与线程

| 维度 | 进程 | 线程 |
|:---|:---|:---|
| **定义** | 程序的一次执行过程，是系统分配资源的基本单位 | CPU 调度的最小单位，是进程中的一个执行流 |
| **资源拥有** | 拥有独立的地址空间、文件句柄等 | 共享进程的堆和方法区，拥有独立的栈、PC 寄存器、本地栈 |
| **通信方式** | IPC（管道、Socket、共享内存等） | 共享堆中的变量，通过 synchronized/Lock 等机制协调 |
| **开销** | 创建和销毁开销大 | 创建和销毁开销小 |

**并发 vs 并行**：
- **并发（Concurrent）**：同一时间段内多个任务交替执行（单核 CPU），通过 CPU 时间片轮转实现
- **并行（Parallel）**：同一时刻多个任务真正同时执行（多核 CPU）

### 1.4.2 线程状态与生命周期

```java
public enum Thread.State {
    NEW,        // 新建：创建了 Thread 对象但尚未调用 start()
    RUNNABLE,  // 可运行：调用了 start()，可能在等 CPU 时间片
    BLOCKED,    // 阻塞：等待获取 monitor 锁
    WAITING,    // 等待：调用了 Object.wait()、Thread.join()、LockSupport.park()
    TIMED_WAITING, // 计时等待：sleep()、wait(timeout)、join(timeout)、parkNanos() 等
    TERMINATED  // 终止：run() 执行完毕
}
```

**状态流转图**：

```
                 ┌──────────────────────────────────┐
                 │                                  │
                 ▼                                  │
    NEW ──> RUNNABLE ───────────────────────────────┤
                 │                   ▲              │
                 │    ┌───────────────┤              │
                 │    ▼               │              │
                 │  BLOCKED <─────────┤              │
                 │    ▲               │              │
                 │    │    ┌──────────┘              │
                 │    │    ▼                         │
                 │    └──WAITING <───┐               │
                 │                   │               │
                 │         TIMED_WAITING             │
                 │                   │               │
                 └───────────────────┘               │
                                                    │
                                              TERMINATED
```

### 1.4.3 线程创建方式

**方式一：继承 Thread 类**

```java
public class MyThread extends Thread {
    @Override
    public void run() {
        System.out.println("线程执行中: " + Thread.currentThread().getName());
    }

    public static void main(String[] args) {
        MyThread t = new MyThread();
        t.start(); // 必须调用 start()，调用 run() 只是普通方法调用
    }
}
```

**方式二：实现 Runnable 接口（推荐）**

```java
public class MyRunnable implements Runnable {
    @Override
    public void run() {
        System.out.println("线程执行中: " + Thread.currentThread().getName());
    }

    public static void main(String[] args) {
        Thread t = new Thread(new MyRunnable());
        t.start();
    }
}
```

**方式三：实现 Callable 接口 + FutureTask**

```java
public class MyCallable implements Callable<Integer> {
    @Override
    public Integer call() throws Exception {
        return 42;
    }

    public static void main(String[] args) throws Exception {
        FutureTask<Integer> task = new FutureTask<>(new MyCallable());
        Thread t = new Thread(task);
        t.start();
        Integer result = task.get(); // 阻塞等待返回值
        System.out.println("返回值: " + result);
    }
}
```

**方式四：Lambda + Thread（现代简洁写法）**

```java
public class LambdaThread {
    public static void main(String[] args) {
        Thread t = new Thread(() -> {
            System.out.println("Lambda 线程执行中");
        });
        t.start();
    }
}
```

> **注意**：`start()` 方法只能调用一次，多次调用会抛出 `IllegalThreadStateException`。`run()` 可以重复调用，但不会创建新线程。

### 1.4.4 线程常用方法

| 方法 | 说明 |
|:---|:---|
| `start()` | 启动线程，JVM 调用 run() |
| `run()` | 线程执行体，需重写 |
| `sleep(long ms)` | 线程休眠指定毫秒，**不释放已持有的 monitor 锁**，进入 TIMED_WAITING |
| `join()` / `join(long ms)` | 等待线程执行完毕，**不释放当前线程已持有的 monitor 锁**，进入 WAITING / TIMED_WAITING |
| `yield()` | 提示调度器让出 CPU 时间片，线程回到 RUNNABLE 状态，**不释放已持有的 monitor 锁** |
| `interrupt()` | 中断线程（设置中断标志为 true），在阻塞状态时会抛出 InterruptedException |
| `isInterrupted()` | 判断线程是否被中断（不清除标志） |
| `Thread.interrupted()` | 判断并**清除**中断标志 |
| `setDaemon(boolean)` | 设置为守护线程（随 JVM 退出而终止） |
| `setPriority(int)` | 设置优先级（1~10，默认 5） |

```java
public class ThreadMethodsDemo {
    public static void main(String[] args) throws InterruptedException {
        Thread t1 = new Thread(() -> {
            for (int i = 0; i < 3; i++) {
                System.out.println("子线程: " + i);
                Thread.yield(); // 让出 CPU
            }
        }, "T1");

        t1.start();
        t1.join(); // 等待 T1 执行完毕

        System.out.println("主线程继续执行");
    }
}
```

### 1.4.5 线程中断机制

线程中断是一种**协作机制**，通过设置线程的中断标志来请求目标线程停止当前工作。

```java
public class InterruptDemo {
    public static void main(String[] args) throws InterruptedException {
        Thread t = new Thread(() -> {
            // 方式一：检查中断标志自行处理
            while (!Thread.currentThread().isInterrupted()) {
                System.out.println("线程运行中...");
            }
            System.out.println("线程检测到中断标志，退出");
        }, "工作线程");

        t.start();
        Thread.sleep(100);
        t.interrupt(); // 请求中断

        t.join();
        System.out.println("主线程结束");
    }
}
```

### 1.4.6 守护线程

守护线程是一种**在后台运行、为其他线程提供服务**的特殊线程。当 JVM 中所有非守护线程都结束后，守护线程会自动终止，JVM 随之退出。

```java
public class DaemonDemo {
    public static void main(String[] args) throws InterruptedException {
        Thread daemon = new Thread(() -> {
            while (true) {
                System.out.println("守护线程运行中...");
                try {
                    Thread.sleep(500);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        });

        daemon.setDaemon(true); // 必须在 start() 之前设置
        daemon.start();

        Thread.sleep(1000);
        System.out.println("主线程结束，守护线程将随 JVM 退出");
        // 主线程（非守护线程）结束后，JVM 会终止守护线程
    }
}
```

| 特性 | 用户线程 | 守护线程 |
|:---|:---|:---|
| **默认类型** | 默认 | 需手动设置 `setDaemon(true)` |
| **JVM 退出条件** | 必须全部执行完毕 | 无需执行完毕 |
| **典型用途** | 业务逻辑 | 垃圾回收、日志监控、心跳检测 |

> **注意**：`setDaemon(true)` 必须在 `start()` 之前调用，否则会抛出 `IllegalThreadStateException`。守护线程中不适合执行 I/O 操作或持有需要关闭的资源。

### 1.4.7 线程异常处理

线程中的未捕获异常不会传播到调用线程，若不做处理会导致线程静默终止。通过 `UncaughtExceptionHandler` 可以统一捕获并处理线程中的未捕获异常。

```java
public class UncaughtExceptionDemo {

    public static void main(String[] args) {
        // 方式一：为单个线程设置
        Thread t1 = new Thread(() -> {
            throw new RuntimeException("线程内异常");
        }, "T1");
        t1.setUncaughtExceptionHandler((thread, ex) -> {
            System.out.println("线程 [" + thread.getName() + "] 发生异常: " + ex.getMessage());
        });
        t1.start();

        // 方式二：设置全局默认处理器
        Thread.setDefaultUncaughtExceptionHandler((thread, ex) -> {
            System.out.println("全局捕获 - 线程 [" + thread.getName() + "] 异常: " + ex.getMessage());
        });

        // 方式三：线程池中设置（通过 ThreadFactory）
        ExecutorService executor = Executors.newFixedThreadPool(2, r -> {
            Thread t = new Thread(r);
            t.setUncaughtExceptionHandler((thread, ex) -> {
                System.err.println("线程池线程异常: " + ex.getMessage());
            });
            return t;
        });
    }
}
```

> **重要**：`submit()` 提交的任务异常会被 Future 封装，`UncaughtExceptionHandler` 不会触发；只有 `execute()` 提交的 Runnable 任务异常才会被 `UncaughtExceptionHandler` 捕获。

---
