## 第九章 Spring 中的设计模式

Spring 框架自身大量运用了经典 GoF 设计模式，学习这些模式在 Spring 中的应用有助于深入理解框架原理。

## 9.1 GoF 23 种设计模式分类

| 分类 | 模式（共 23 种） |
| --- | --- |
| 创建型（5种） | 单例、工厂方法、抽象工厂、建造者、原型 |
| 结构型（7种） | 代理、装饰器、适配器、外观、桥接、组合、享元 |
| 行为型（11种） | 策略、模板方法、观察者、责任链、命令、迭代器、中介者、备忘录、解释器、状态、访问者 |


## 9.2 Spring 中的八大设计模式

### 简单工厂模式

BeanFactory 就是一个大型的"简单工厂"，客户端通过 `getBean("beanName")` 获取对象，不需要知道对象是如何创建的：

```java
ApplicationContext ctx = new ClassPathXmlApplicationContext("spring.xml");
UserService userService = ctx.getBean("userService", UserService.class);
```

### 工厂方法模式

FactoryBean 接口是工厂方法模式的典型体现。不同的 FactoryBean 实现负责创建不同类型的对象：

```java
// SqlSessionFactoryBean 负责创建 SqlSessionFactory
// LocalSessionFactoryBean 负责创建 Hibernate SessionFactory
// 每个 FactoryBean 实现就是一个具体工厂
```

XML 中通过 `factory-method` 属性指定静态或实例工厂方法，也是工厂方法模式的体现。

### 单例模式

Spring 默认以单例作用域管理 Bean。内部实现采用**双重检查锁**（DCL，Double-Checked Locking）的单例模式，保证线程安全：

```java
// Spring 内部 DefaultSingletonBeanRegistry 的核心逻辑（简化）
public Object getSingleton(String beanName) {
    Object singletonObject = singletonObjects.get(beanName);
    if (singletonObject == null) {
        synchronized (singletonObjects) {
            singletonObject = singletonObjects.get(beanName);
            if (singletonObject == null) {
                singletonObject = createBean(beanName);
                singletonObjects.put(beanName, singletonObject);
            }
        }
    }
    return singletonObject;
}
```

### 代理模式

Spring AOP 的底层完全基于动态代理。`@Transactional`、`@Async`、`@Cacheable` 等注解都通过代理模式将横切逻辑织入目标方法。详见第五、六章。

### 装饰器模式

装饰器模式在不改变原有对象接口的前提下，动态地给对象增加功能，避免了继承方式导致的类爆炸。

Spring 中的应用：

+ `BeanWrapper`：包装 Bean 实例，为其添加属性访问、类型转换等能力
+ Spring 数据源中的 `TransactionAwareDataSourceProxy`：对普通数据源进行包装，增加事务感知能力
+ Java IO 流本身就是装饰器模式（`BufferedInputStream` 包装 `FileInputStream`）

识别标志：**Spring 中类名包含 Decorator 或 Wrapper 的类，通常都是装饰器模式的实现。**

```java
BeanWrapper beanWrapper = new BeanWrapperImpl(targetObject);
beanWrapper.setPropertyValue("name", "张三");
```

### 观察者模式（事件机制）

Spring 的事件发布/监听机制就是观察者模式：

+ 事件源（Publisher）发布事件
+ 监听器（Listener）订阅并处理事件

Spring 内置事件：`ContextRefreshedEvent`（容器刷新完成）、`ContextClosedEvent`（容器关闭）等。容器在关键生命周期节点发布这些事件，通知所有监听器。

自定义事件监听：

```java
// 自定义事件
public class UserRegisteredEvent extends ApplicationEvent {
    private String username;
    public UserRegisteredEvent(Object source, String username) {
        super(source);
        this.username = username;
    }
}

// 发布事件
@Service
public class UserService implements ApplicationEventPublisherAware {
    private ApplicationEventPublisher publisher;
    
    @Override
    public void setApplicationEventPublisher(ApplicationEventPublisher publisher) {
        this.publisher = publisher;
    }
    
    public void register(String username) {
        // 业务逻辑...
        publisher.publishEvent(new UserRegisteredEvent(this, username));
    }
}

// 监听事件
@Component
public class EmailNotifyListener implements ApplicationListener<UserRegisteredEvent> {
    @Override
    public void onApplicationEvent(UserRegisteredEvent event) {
        System.out.println("发送欢迎邮件给：" + event.getUsername());
    }
}
```

或使用注解方式：

```java
@Component
public class EmailNotifyListener {
    @EventListener
    public void handleUserRegistered(UserRegisteredEvent event) {
        System.out.println("发送欢迎邮件给：" + event.getUsername());
    }
}
```

### 策略模式

策略模式定义一族算法，封装成独立的类，使它们可以互换。Spring 中大量使用：

**资源加载策略**：`ResourceLoader` 接口及其多种实现（`ClassPathResourceLoader`、`FileSystemResourceLoader`、`UrlResource`），根据资源路径前缀（`classpath:`、`file:`、`http:`）自动选择对应的加载策略。

**事务管理策略**：`PlatformTransactionManager` 接口及其多种实现（`DataSourceTransactionManager`、`JpaTransactionManager`、`JtaTransactionManager`），根据底层数据访问技术选择对应的事务管理实现。

```java
// 根据底层技术选择不同的策略实现
PlatformTransactionManager txManager = new DataSourceTransactionManager(dataSource);
// 或者
PlatformTransactionManager txManager = new JpaTransactionManager(entityManagerFactory);
```

### 模板方法模式

模板方法模式在父类中定义算法的骨架（不变部分），将可变的步骤延迟到子类实现，体现"好莱坞原则"：别调用我，我会调用你。

Spring 中的应用：

+ `JdbcTemplate`：封装了 JDBC 操作的固定流程（获取连接、创建语句、执行、处理结果集、关闭连接），将 SQL 编写和结果映射交给调用者实现
+ `RestTemplate`：封装了 HTTP 请求的处理流程
+ `AbstractApplicationContext#refresh()`：定义了容器刷新的整体流程，各步骤由子类实现

```java
jdbcTemplate.query(
    "SELECT * FROM user WHERE id = ?",
    new Object[]{userId},
    (rs, rowNum) -> {
        User user = new User();
        user.setId(rs.getLong("id"));
        user.setName(rs.getString("name"));
        return user;
    }
);
```

### 适配器模式

适配器模式将一个类的接口转换为客户期望的另一个接口，解决接口不兼容的问题。

Spring 中的应用：

+ `HandlerAdapter`（SpringMVC）：将各种类型的 Handler（`@RequestMapping` 方法、HttpRequestHandler、Servlet 等）统一适配为 `DispatcherServlet` 可以统一调用的接口
+ `SpringMVC` 中的各种 Adapter 实现：`RequestMappingHandlerAdapter`、`HttpRequestHandlerAdapter`

### 责任链模式

责任链模式将请求的发送者和处理者解耦，多个处理器组成一条链，请求沿链传递直到被处理。

Spring 中的应用：

+ `AOP` 的通知执行链：多个切面的通知按优先级形成一条执行链，`MethodInvocationInterceptor` 链式执行
+ `SpringMVC` 的 `HandlerInterceptor` 拦截器链：preHandle → handler → postHandle → afterCompletion
+ Spring Security 的过滤器链

---
