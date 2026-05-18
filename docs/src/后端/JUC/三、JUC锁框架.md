## 3.1 LockSupport

### 3.1.1 核心原理

`LockSupport` 是 JUC 中用于**线程阻塞与唤醒**的基础工具类，位于 `java.util.concurrent.locks` 包。它是 AQS、ReentrantLock 等同步组件的底层基石。

`LockSupport` 的核心优势在于：**无需获取对象的 monitor 锁**，可以直接精确地阻塞/唤醒指定线程，比 `Object.wait()/notify()` 更灵活可靠。

| 方法 | 说明 |
|:---|:---|
| `park()` | 阻塞当前线程，直到被 `unpark` 或中断 |
| `parkNanos(long nanos)` | 阻塞当前线程，最多等待指定纳秒 |
| `parkUntil(long deadline)` | 阻塞当前线程，直到指定时间戳 |
| `unpark(Thread thread)` | 唤醒指定线程（可先调用，后 `park` 不会阻塞） |

### 3.1.2 许可证机制

`LockSupport` 基于**二元许可证**机制：每个线程最多持有 1 个许可证。

- `unpark(thread)`：为线程颁发一个许可证（上限 1，多次调用不累积）
- `park()`：消耗许可证后阻塞；若已有许可证则直接通过不阻塞

```java
public class LockSupportDemo {

    public static void main(String[] args) throws InterruptedException {
        Thread worker = new Thread(() -> {
            System.out.println("工作线程准备阻塞...");
            LockSupport.park(); // 阻塞，等待被唤醒
            System.out.println("工作线程被唤醒！");
        }, "Worker");

        worker.start();
        Thread.sleep(1000);

        System.out.println("主线程唤醒工作线程");
        LockSupport.unpark(worker); // 唤醒指定线程

        worker.join();
    }
}
```

### 3.1.3 与wait/notify对比

| 特性 | LockSupport | Object.wait/notify |
|:---|:---|:---|
| **锁要求** | ❌ 不需要持有锁 | ✅ 必须在 `synchronized` 内调用 |
| **唤醒精确性** | 精确唤醒指定线程 | `notify()` 随机唤醒一个，`notifyAll()` 唤醒全部 |
| **先唤醒后阻塞** | ✅ `unpark` 可在 `park` 之前调用 | ❌ `notify` 必须在 `wait` 之后 |
| **中断响应** | 返回但不抛异常，需手动检查中断标志 | 抛出 `InterruptedException` |
| **底层实现** | `Unsafe.park/unpark`（调用 OS 条件变量） | 对象 monitor 的 wait set |

```java
// 利用"先唤醒后阻塞"特性实现简单同步
public class PreUnparkDemo {
    public static void main(String[] args) {
        Thread worker = new Thread(() -> {
            try {
                Thread.sleep(2000); // 模拟耗时操作
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            System.out.println("工作线程准备 park");
            LockSupport.park(); // 由于主线程已 unpark，此处不会阻塞
            System.out.println("工作线程直接通过！");
        });

        worker.start();
        LockSupport.unpark(worker); // 先颁发许可证
    }
}
```

---

## 3.2 AQS核心原理

### 3.2.1 AQS概述

**AQS（AbstractQueuedSynchronizer）** 是 JUC 中构建锁和同步器的核心框架，位于 `java.util.concurrent.locks` 包。

基于 AQS 实现的常见组件：

| 组件 | 类型 | 锁机制 |
|:---|:---|:---|
| `ReentrantLock` | 独占锁 | state = 重入次数 |
| `ReentrantReadWriteLock` | 读写锁 | 高16位=读锁，低16位=写锁 |
| `Semaphore` | 共享锁 | state = 许可证数量 |
| `CountDownLatch` | 共享锁 | state = 计数 |
| `ThreadPoolExecutor` | 共享锁 | worker 数量控制 |

### 3.2.2 核心设计

AQS 包含三个核心要素：

- **state 变量**：`volatile int` 修饰的同步状态，通过 `getState()` / `setState()` / `compareAndSetState()` 操作
- **FIFO 等待队列**：CLH 变体队列，管理获取资源失败的线程
- **模板方法模式**：定义资源获取/释放的通用流程，子类重写 `tryAcquire()` / `tryRelease()` 等方法

```java
// AQS 核心方法（子类可重写）
protected boolean tryAcquire(int arg)     // 独占模式获取
protected boolean tryRelease(int arg)     // 独占模式释放
protected int tryAcquireShared(int arg)   // 共享模式获取，返回负数=失败，0=成功无剩余，正数=成功有剩余
protected boolean tryReleaseShared(int arg) // 共享模式释放
protected boolean isHeldExclusively()    // 是否被当前线程独占
```

### 3.2.3 CLH变体队列

AQS 的等待队列是原始 CLH 锁的变体，采用**双向链表 + 自旋/阻塞混合**机制：

- **同步队列**：管理获取资源失败的线程（双向链表）
- **条件队列**：管理调用 `Condition.await()` 等待的线程（单向链表）

**Node 节点状态（waitStatus）**：

| 值 | 常量 | 含义 |
|:---:|:---|:---|
| 1 | CANCELLED | 线程已取消（异常状态） |
| -1 | SIGNAL | 后继节点需要被当前节点唤醒 |
| -2 | CONDITION | 节点在条件队列中等待 |
| -3 | PROPAGATE | 共享模式下传播唤醒 |

```java
// AQS 独占模式获取核心流程
public final void acquire(int arg) {
    if (!tryAcquire(arg) &&                    // 1. 尝试获取
        acquireQueued(addWaiter(Node.EXCLUSIVE), arg)) // 2. 入队 + 3. 队列中自旋/阻塞
        selfInterrupt();                        // 4. 恢复中断状态
}
```

### 3.2.4 独占与共享模式

| 维度 | 独占模式 | 共享模式 |
|:---|:---|:---|
| **并发度** | 同一时刻仅 1 个线程获取 | 同一时刻多个线程可同时获取 |
| **获取入口** | `acquire(int)` | `acquireShared(int)` |
| **释放入口** | `release(int)` | `releaseShared(int)` |
| **tryXxx 返回值** | boolean（true=成功） | int（负数=失败，正数=成功有剩余） |
| **唤醒策略** | 释放时唤醒一个后继节点 | 传播唤醒所有可获取的节点 |
| **典型实现** | ReentrantLock、写锁 | Semaphore、CountDownLatch、读锁 |

### 3.2.5 公平锁与非公平锁

| 维度 | 非公平锁（默认） | 公平锁 |
|:---|:---|:---|
| **吞吐量** | 更高（新线程可能直接获取锁） | 较低 |
| **线程饥饿** | 可能发生 | 不会发生 |
| **适用场景** | 大多数高并发场景 | 严格公平性要求 |

```java
// 公平锁唯一区别：CAS 前先检查是否有排队更久的线程
if (!hasQueuedPredecessors() && compareAndSetState(0, acquires))
```

---

## 3.3 ReentrantLock

### 3.3.1 基本使用

`ReentrantLock` 是 JUC 中最常用的显式锁，实现了**可重入独占锁**——同一线程可多次获取同一把锁。

```java
public class ReentrantLockDemo {
    private final ReentrantLock lock = new ReentrantLock();
    private int counter = 0;

    public void increment() {
        lock.lock();       // 加锁
        try {
            counter++;    // 临界区操作
        } finally {
            lock.unlock(); // 必须在 finally 中释放
        }
    }

    // 可重入示例：同一线程可多次获取
    public void outer() {
        lock.lock();
        try {
            inner(); // 可重入：同一线程再次获取锁
        } finally {
            lock.unlock();
        }
    }

    public void inner() {
        lock.lock();
        try {
            // 嵌套的临界区
        } finally {
            lock.unlock();
        }
    }
}
```

### 3.3.2 公平锁与非公平锁

```java
// 非公平锁（默认）：性能更高
ReentrantLock unfairLock = new ReentrantLock();

// 公平锁：严格按申请顺序
ReentrantLock fairLock = new ReentrantLock(true);
```

### 3.3.3 尝试获取锁

```java
public class TryLockDemo {
    private final ReentrantLock lock = new ReentrantLock();

    public void doWork() {
        // 尝试获取锁，立即返回
        if (lock.tryLock()) {
            try {
                // 获取到了锁
            } finally {
                lock.unlock();
            }
        } else {
            // 未获取到锁，做其他处理
        }
    }

    public void doWorkWithTimeout() throws InterruptedException {
        // 尝试在指定时间内获取锁
        if (lock.tryLock(5, TimeUnit.SECONDS)) {
            try {
                // 获取到了锁
            } finally {
                lock.unlock();
            }
        } else {
            // 超时未获取到
        }
    }
}
```

### 3.3.4 Condition条件等待

`ReentrantLock.newCondition()` 创建 Condition，实现**多条件等待队列**（比 Object.wait/notify 更灵活）。

```java
public class ConditionDemo {
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition notFull  = lock.newCondition();
    private final Condition notEmpty = lock.newCondition();
    private final int[] buffer = new int[10];
    private int count = 0, head = 0, tail = 0;

    public void put(int value) throws InterruptedException {
        lock.lock();
        try {
            while (count == buffer.length) {
                notFull.await(); // 队列满，等待
            }
            buffer[tail] = value;
            tail = (tail + 1) % buffer.length;
            count++;
            notEmpty.signal(); // 唤醒等待消费的线程
        } finally {
            lock.unlock();
        }
    }

    public int take() throws InterruptedException {
        lock.lock();
        try {
            while (count == 0) {
                notEmpty.await(); // 队列空，等待
            }
            int value = buffer[head];
            head = (head + 1) % buffer.length;
            count--;
            notFull.signal(); // 唤醒等待生产的线程
            return value;
        } finally {
            lock.unlock();
        }
    }
}
```

### 3.3.5 与synchronized对比

| 维度 | ReentrantLock | synchronized |
|:---|:---|:---|
| **锁获取** | 手动获取 / 释放 | 自动获取 / 释放 |
| **尝试获取** | `tryLock()` 支持超时和中断 | 不支持 |
| **公平锁** | 支持 | 不支持 |
| **多条件队列** | 支持（多个 Condition） | 不支持（只有一个等待集） |
| **可重入** | 支持 | 支持 |
| **性能（JDK6+）** | 相当 | 相当 |

---

## 3.4 ReentrantReadWriteLock

### 3.4.1 读写锁核心思想

`ReentrantReadWriteLock` 实现**读写分离锁**：
- **读锁（共享锁）**：多个线程可以同时获取读锁，并发读取
- **写锁（独占锁）**：同一时刻只能有一个线程持有写锁

```java
public class ReadWriteLockDemo {
    private final ReentrantReadWriteLock rwLock = new ReentrantReadWriteLock();
    private final ReentrantReadWriteLock.ReadLock  readLock  = rwLock.readLock();
    private final ReentrantReadWriteLock.WriteLock writeLock = rwLock.writeLock();
    private final Map<String, String> cache = new HashMap<>();

    // 读操作：多个线程可同时读取
    public String read(String key) {
        readLock.lock();
        try {
            return cache.get(key);
        } finally {
            readLock.unlock();
        }
    }

    // 写操作：独占，其他读写全部阻塞
    public void write(String key, String value) {
        writeLock.lock();
        try {
            cache.put(key, value);
        } finally {
            writeLock.unlock();
        }
    }
}
```

### 3.4.2 锁降级

锁降级是指**持有写锁时，在释放写锁之前获取读锁**，保证在数据更新期间不会被其他写线程干扰，同时让后续读操作不被阻塞。

```java
public class LockDowngrade {
    private final ReentrantReadWriteLock rwLock = new ReentrantReadWriteLock();

    public void lockDowngradeDemo() {
        rwLock.writeLock().lock();
        try {
            // 写数据...
            // 锁降级：持有写锁时获取读锁
            rwLock.readLock().lock();
        } finally {
            rwLock.writeLock().unlock(); // 释放写锁，仍持有读锁
        }
        try {
            // 持有读锁读取数据（此时无写锁，数据一致）
        } finally {
            rwLock.readLock().unlock();
        }
    }
}
```

> **注意**：读写锁在**读多写少**场景能大幅提升并发度；但在**写多读少**或**读写竞争激烈**场景，性能可能不如普通独占锁。

---

## 3.5 StampedLock

### 3.5.1 概述

`StampedLock` 是 JDK 8 引入的**乐观读锁**实现，性能优于 ReadWriteLock，适用于**读多写少且读操作无需阻塞**的场景。

```java
public class StampedLockDemo {
    private final StampedLock stampedLock = new StampedLock();
    private double x, y;

    // 乐观读：无需加锁，直接读取
    public double[] readOptimistic() {
        long stamp = stampedLock.tryOptimisticRead(); // 获取乐观读戳
        double currentX = x, currentY = y;
        if (!stampedLock.validate(stamp)) { // 验证戳是否有效（是否有写操作插队）
            // 戳无效，说明有写操作，需要升级为悲观读
            stamp = stampedLock.readLock();
            try {
                currentX = x;
                currentY = y;
            } finally {
                stampedLock.unlockRead(stamp);
            }
        }
        return new double[]{currentX, currentY};
    }

    // 写锁
    public void write(double newX, double newY) {
        long stamp = stampedLock.writeLock();
        try {
            x = newX;
            y = newY;
        } finally {
            stampedLock.unlockWrite(stamp);
        }
    }
}
```

### 3.5.2 三种锁模式对比

| 模式 | 方法 | 并发度 | 适用场景 |
|:---|:---|:---|:---|
| **悲观读锁** | `readLock()` | 多个读线程并发 | 读操作可能被写操作打断的场景 |
| **乐观读** | `tryOptimisticRead()` | 无锁，性能最高 | 读多写少，且写操作不频繁的场景 |
| **写锁** | `writeLock()` | 独占 | 数据修改场景 |

> **注意**：`StampedLock` 不支持重入。

---
