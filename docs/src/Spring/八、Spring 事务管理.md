

## 8.1 事务基础知识

事务是数据库操作的最小工作单元，多条 DML 语句（INSERT/UPDATE/DELETE）要么全部成功提交，要么全部失败回滚，不允许部分成功的中间状态。

事务的四个特性（ACID）：

+ **A 原子性**：事务是不可分割的最小单元
+ **C 一致性**：事务前后数据总量保持一致，业务约束不被破坏
+ **I 隔离性**：并发的事务互不干扰
+ **D 持久性**：事务提交后的数据变更是永久性的

事务的四个操作步骤：开启事务 → 执行业务 → 提交事务（无异常） / 回滚事务（有异常）

## 8.2 Spring 事务管理的两种方式

### 编程式事务

通过代码显式控制事务的开启、提交、回滚，灵活但侵入性强：

```java
@Autowired
private PlatformTransactionManager txManager;

public void transfer() {
    DefaultTransactionDefinition def = new DefaultTransactionDefinition();
    TransactionStatus status = txManager.getTransaction(def);
    try {
        // 业务操作
        txManager.commit(status);
    } catch (Exception e) {
        txManager.rollback(status);
    }
}
```

### 声明式事务（推荐）

通过 `@Transactional` 注解声明事务，Spring 底层基于 AOP 自动代理来完成事务的开启/提交/回滚，不侵入业务代码。**实际开发中绝大多数场景使用声明式事务。**

```java
@Service
@Transactional  // 类级别：该类所有方法都开启事务
public class AccountServiceImpl implements AccountService {

    @Autowired
    private AccountMapper accountMapper;

    @Override
    public void transfer(String from, String to, double amount) {
        Account fromAct = accountMapper.selectByActno(from);
        if (fromAct.getBalance() < amount) {
            throw new RuntimeException("余额不足");
        }
        Account toAct = accountMapper.selectByActno(to);
        fromAct.setBalance(fromAct.getBalance() - amount);
        toAct.setBalance(toAct.getBalance() + amount);
        accountMapper.update(fromAct);
        accountMapper.update(toAct);
    }
}
```

## 8.3 事务管理器（PlatformTransactionManager）

Spring 事务的底层基于 AOP 实现，核心接口是 `PlatformTransactionManager`：

+ `DataSourceTransactionManager`：适用于 JDBC / MyBatis / Hibernate（JDBC 事务）
+ `JpaTransactionManager`：适用于 JPA 框架
+ `JtaTransactionManager`：适用于分布式事务（多数据源）

使用 MyBatis 时，需要配置 `DataSourceTransactionManager` 并注入同一个数据源：（这两种方式都是使用Transactional ）

```xml
<!-- XML方式 -->
<bean id="txManager"
      class="org.springframework.jdbc.datasource.DataSourceTransactionManager">
    <property name="dataSource" ref="dataSource"/>
</bean>
<tx:annotation-driven transaction-manager="txManager"/>
```

```java
// 全注解方式
@Bean
public DataSourceTransactionManager transactionManager(DataSource dataSource) {
    return new DataSourceTransactionManager(dataSource);
}
// 配置类上加 @EnableTransactionManagement 相当于<tx:annotation-driven/>
```

## 8.4 @Transactional 注解详解

### 基本使用

+ 加在类上：类中所有方法都开启事务
+ 加在方法上：只有该方法开启事务（方法级注解会覆盖类级注解）

```java
@Transactional
public class MyService {
    public void methodA() {}  // 有事务（类级）
    
    @Transactional(readOnly = true)
    public void methodB() {}  // 有事务（方法级，覆盖类级，只读）
}
```

### 传播行为（propagation）

传播行为描述当一个事务方法调用另一个事务方法时，事务如何传播。

| 传播行为 | 说明 | 记忆口诀 |
| --- | --- | --- |
| REQUIRED（默认） | 有事务则加入，没有则新建 | 没有就新建，有就加入 |
| SUPPORTS | 有事务则加入，没有则以非事务方式运行 | 有就加入，没有就算了 |
| MANDATORY | 有事务则加入，没有则抛异常 | 有就加入，没有就报错 |
| REQUIRES_NEW | 无论如何都新建一个独立事务，原事务挂起 | 不管有没有，直接新开 |
| NOT_SUPPORTED | 以非事务方式运行，原事务挂起 | 不支持事务，有就挂起 |
| NEVER | 以非事务方式运行，有事务则抛异常 | 不支持事务，有就报错 |
| NESTED | 有事务则嵌套执行（子事务可独立提交/回滚）；没有则新建 | 嵌套事务，外层回滚会导致内层回滚 |


```java
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void logOperation() {
    // 无论主业务是否回滚，日志记录都要提交
}
```

> 坑点：Spring 事务基于 AOP 代理，**同一个类中** 方法 A 调用方法 B，B 上的事务传播行为不会生效，因为 A 调用的是 `this.B()`，没有经过代理对象。解决方案：将 B 提取到另一个 Service 类，或通过 ApplicationContext 获取代理对象后再调用。
>

### 隔离级别（isolation）

隔离级别控制并发事务之间的可见性，解决三类并发问题：

并发问题说明：

+ **脏读**：读到了另一个事务尚未提交的数据（该事务后来回滚了）
+ **不可重复读**：同一事务中两次读取同一行，结果不同（另一事务在两次读之间提交了修改）
+ **幻读**：同一事务中两次执行相同查询，结果集行数不同（另一事务在两次读之间插入/删除了记录）

| 隔离级别 | 脏读 | 不可重复读 | 幻读 | 说明 |
| --- | --- | --- | --- | --- |
| READ_UNCOMMITTED | 可能 | 可能 | 可能 | 最低，性能最好 |
| READ_COMMITTED | 不会 | 可能 | 可能 | Oracle/SQL Server 默认 |
| REPEATABLE_READ | 不会 | 不会 | 可能 | MySQL InnoDB 默认 |
| SERIALIZABLE | 不会 | 不会 | 不会 | 最高，性能最差 |


```java
@Transactional(isolation = Isolation.READ_COMMITTED)
public void queryData() {}
```

MySQL InnoDB 默认隔离级别是 REPEATABLE_READ，实际上通过 MVCC 机制也解决了大部分幻读问题。

### 超时（timeout）

设置事务超时时间，单位秒。超时后未完成的事务自动回滚：

```java
@Transactional(timeout = 30)  // 30 秒内必须完成，否则回滚
public void longRunningTask() {}
```

默认值 `-1` 表示不限时。

> 坑点：超时计时仅在执行 SQL 操作时触发检查，纯 Java 代码的耗时（如 Thread.sleep）不会触发超时检测。如果 sleep 之后还有 SQL 操作，超时检测才会在那条 SQL 执行时生效。
>

### 只读事务（readOnly）

```java
@Transactional(readOnly = true)
public List<User> getAllUsers() {}
```

`readOnly = true` 的作用：

+ 通知数据库驱动和 ORM 框架这是只读操作，可以跳过脏检查，减少不必要的锁和开销
+ 在读写分离架构中，可作为路由信号将查询请求引导到从库
+ 代码可读性提升，明确标注方法意图

注意：`readOnly = true` 通常是**提示**而非强制约束，误操作写数据在多数情况下不会直接报错（Hibernate 可能会在提交时报错）。不能依赖它来防止写操作。

### 异常回滚规则（rollbackFor / noRollbackFor）

Spring 事务的默认回滚规则：

+ 遇到 `RuntimeException` 及其子类：**回滚**
+ 遇到 `Error` 及其子类：**回滚**
+ 遇到受检异常（Checked Exception，继承 Exception 但不继承 RuntimeException）：**不回滚**

修改回滚规则：

```java
// 让受检异常也触发回滚（实际开发中推荐这样设置）
@Transactional(rollbackFor = Exception.class)

// 让某个 RuntimeException 不触发回滚
@Transactional(noRollbackFor = NullPointerException.class)
```

> 最佳实践：统一使用 `@Transactional(rollbackFor = Exception.class)`，避免受检异常不回滚导致的数据不一致问题。
>

## 8.5 事务失效场景

理解 Spring 事务失效的原因，有助于避免踩坑：

### 未被 Spring 代理的方法调用

同类内部调用不经过代理对象，事务不生效：

```java
@Service
public class OrderService {
    public void createOrder() {
        this.save();  // 直接调用 this，不经过代理，save() 的事务不生效
    }
    
    @Transactional
    public void save() {}
}
```

解决：将 save() 提取到另一个 Service，或通过 Spring 容器获取代理对象后调用。

### 方法不是 public

Spring AOP 只代理 `public` 方法，非 public 方法上的 `@Transactional` 不生效：

```java
@Transactional
protected void doSomething() {}  // 不生效
```

### 异常被吞掉

异常在方法内部被 catch 住且没有重新抛出，Spring 感知不到异常，不会触发回滚：

```java
@Transactional
public void transfer() {
    try {
        dao.update();
    } catch (Exception e) {
        // 日志打一下，不再抛出 —— 事务不会回滚！
        log.error("error", e);
    }
}
```

解决：catch 后重新抛出异常，或手动标记回滚 `TransactionAspectSupport.currentTransactionStatus().setRollbackOnly()`。

### 异常类型不匹配

默认只回滚 RuntimeException，如果抛出的是受检异常，而没有配置 `rollbackFor = Exception.class`，事务不会回滚。

### 数据库表不支持事务

如 MySQL 的 MyISAM 引擎不支持事务，Spring 的事务管理在这种表上无效。确保使用 InnoDB 引擎。

### @Transactional 注解在接口上

`@Transactional` 加在接口方法上，当 Spring 使用 CGLIB 代理（默认）时，接口上的注解不会被识别。应将注解加在实现类或实现类的方法上。

## 8.6 编程式事务（了解）

编程式事务适用于需要在代码中精确控制事务边界的场景，比声明式事务更灵活但侵入性更强：

```java
@Autowired
private TransactionTemplate transactionTemplate;

public void businessMethod() {
    transactionTemplate.execute(status -> {
        try {
            dao.insert(obj);
            dao.update(obj);
            return null;
        } catch (Exception e) {
            status.setRollbackOnly();  // 标记回滚
            throw e;
        }
    });
}
```

> SpringBoot 适配：SpringBoot 引入 `spring-boot-starter-jdbc` 或 `spring-boot-starter-data-jpa` 后，事务管理器会自动配置。只需在方法上加 `@Transactional`，SpringBoot 会自动完成其余配置（包括 `@EnableTransactionManagement`）。
>

---
