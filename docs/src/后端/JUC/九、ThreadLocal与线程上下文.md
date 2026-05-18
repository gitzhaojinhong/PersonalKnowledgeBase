## 9.1 ThreadLocal使用

### 9.1.1 核心原理

`ThreadLocal` 为每个线程提供独立的变量副本，实现**线程隔离**。每个线程内部都有一个 `ThreadLocalMap`，以 `ThreadLocal` 实例为 key 存储值。

```java
public class ThreadLocalDemo {

    // 存储线程本地变量（用户上下文）
    private static final ThreadLocal<UserContext> userContext =
        new ThreadLocal<>();

    // 存储线程序列号
    private static final ThreadLocal<Integer> sequence =
        new ThreadLocal<Integer>() {
            @Override
            protected Integer initialValue() {
                return 0; // 初始值
            }
        };

    public void demo() {
        // 设置值
        userContext.set(new UserContext("Alice", 25));
        sequence.set(sequence.get() + 1);

        // 获取值（仅当前线程可见）
        UserContext ctx = userContext.get();
        Integer seq = sequence.get();

        // 用完必须移除，防止内存泄漏
        userContext.remove();
        sequence.remove();
    }
}
```

### 9.1.2 典型使用场景

| 场景 | 说明 |
|:---|:---|
| **用户上下文传递** | Web 请求中用户信息通过 ThreadLocal 传递，避免层层传递参数 |
| **线程序列号** | 每个线程维护独立的计数器 |
| **数据库连接** | 保证同一线程使用同一连接（事务一致性） |
| **Session 管理** | 框架内部存储当前会话信息 |

```java
// 场景：用户上下文传递（Spring 中常用）
public class UserContextHolder {
    private static final ThreadLocal<UserContext> contextHolder =
        new ThreadLocal<>();

    public static void setContext(UserContext context) {
        contextHolder.set(context);
    }

    public static UserContext getContext() {
        return contextHolder.get();
    }

    public static void clear() {
        contextHolder.remove();
    }
}

// 在 Filter/Interceptor 中设置
public class UserContextFilter implements Filter {
    @Override
    public void doFilter(...) {
        try {
            UserContext ctx = extractFromToken();
            UserContextHolder.setContext(ctx);
            chain.doFilter(request, response);
        } finally {
            UserContextHolder.clear(); // 必须在 finally 中清理
        }
    }
}
```

---

## 9.2 内存泄漏与解决方案

### 9.2.1 内存泄漏原因

`ThreadLocalMap` 的 Entry 继承自 `WeakReference<ThreadLocal<?>>`，即 key（ThreadLocal）是**弱引用**，当外部 ThreadLocal 实例没有强引用时会被 GC 回收，key 变为 null。

**但 value 仍然是强引用**，如果线程长期存活（如线程池中的线程），value 就无法被回收，导致**内存泄漏**。

```
线程对象
  └─ ThreadLocalMap（强引用）
       └─ Entry（key=弱引用ThreadLocal，value=强引用对象）
            └─ key 被 GC 回收后，value 仍被 Entry 持有
```

### 9.2.2 最佳实践

> **核心原则**：`ThreadLocal` 用完后**必须调用 `remove()`**，尤其是在线程池场景下。

```java
public class ThreadLocalSafeUsage {

    private static final ThreadLocal<String> tl = new ThreadLocal<>();

    // ✅ 正确用法：finally 中 remove
    public void correctUsage() {
        try {
            tl.set("value");
            // 业务逻辑
        } finally {
            tl.remove(); // 无论是否异常都必须清理
        }
    }

    // ✅ 使用 initialValue（初始化时设置）
    private static final ThreadLocal<List<String>> listTl =
        ThreadLocal.withInitial(ArrayList::new);

    // ✅ 静态 ThreadLocal + remove
    private static final ThreadLocal<UserContext> ctxTl =
        new ThreadLocal<>();

    // 在 finally 中清理（框架层面统一处理更佳）
    public static void main(String[] args) {
        try {
            ctxTl.set(new UserContext("test"));
            // ...
        } finally {
            ctxTl.remove();
        }
    }
}
```

---

## 9.3 InheritableThreadLocal

`InheritableThreadLocal` 继承 ThreadLocal，**子线程可以继承父线程的值**。

```java
public class InheritableThreadLocalDemo {

    private static final InheritableThreadLocal<Integer> inheritable =
        new InheritableThreadLocal<>();

    public static void main(String[] args) {
        inheritable.set(100);

        Thread child = new Thread(() -> {
            // 子线程可以读取父线程设置的值
            System.out.println("子线程读取: " + inheritable.get()); // 100
        });

        child.start();
        child.join();

        // 反过来不行：父线程无法读取子线程的值
        new Thread(() -> {
            inheritable.set(200);
            System.out.println("子线程设置: 200");
        }).start().join();

        System.out.println("父线程读取: " + inheritable.get()); // 100
    }
}
```

> **注意**：`InheritableThreadLocal` 在线程池场景下有坑——由于线程被复用，父线程的值会污染后续任务。生产环境中慎用，或在每次任务开始时手动清理并重新设置。

---
