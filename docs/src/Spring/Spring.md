# Spring 框架笔记（重构版）

---

# 第一章 Spring 概述

## 1.1 Spring 简介

Spring 是一个轻量级的 Java 开源框架，核心理念是通过 IoC（控制反转）和 AOP（面向切面编程）来简化企业级应用开发。它并不替代原有的框架，而是以一种优雅的方式将各种框架整合在一起，降低系统各层之间的耦合度。

Spring 官网：https://spring.io/

Spring Framework 的核心价值体现在两点：一是让对象的创建和管理交给容器，业务代码只关注业务本身；二是将日志、事务、安全等横切关注点从业务逻辑中剥离，统一处理。

## 1.2 Spring 七大模块

Spring Framework 拆分为多个 JAR，按功能可分为七大模块：

- spring-core / spring-beans：IoC 容器的核心，负责 Bean 的创建与依赖装配
- spring-context：在核心容器之上提供事件机制、国际化、ApplicationContext 等企业级功能
- spring-aop：面向切面编程支持，将横切逻辑从业务代码分离
- spring-jdbc：简化 JDBC 操作，提供 JdbcTemplate
- spring-tx：声明式与编程式事务管理
- spring-orm：整合 Hibernate、JPA、MyBatis 等 ORM 框架
- spring-web / spring-webmvc / spring-webflux：Web 层支持，MVC 框架与响应式 Web 框架

## 1.3 引入 Spring 的 Maven 依赖

只需引入 spring-context，关联依赖（core、beans、aop、expression 等）会自动拉入：

```xml
<dependency>
    <groupId>org.springframework</groupId>
    <artifactId>spring-context</artifactId>
    <version>6.2.13</version>
</dependency>
```

> SpringBoot 适配：SpringBoot 的 spring-boot-starter 已经传递引入了 spring-context，无需单独声明。

## 1.4 软件开发原则

在学习 Spring 之前，理解这几个原则有助于理解 Spring 的设计动机。

### OCP 开闭原则

对扩展开放，对修改关闭。当需求变化时，应通过增加新代码来实现，而不是修改已有代码。Spring 的 IoC 容器通过配置文件或注解驱动对象创建，让业务代码对具体实现的依赖降到最低，符合 OCP。

### DIP 依赖倒置原则

上层模块不应依赖下层模块的具体实现，二者都应依赖抽象（接口）。Spring 的依赖注入正是这一原则的落地：调用方只声明需要一个接口类型，具体的实现由容器注入。

### 其他 SOLID 原则

- SRP 单一职责：一个类只负责一件事
- LSP 里氏替换：子类可以完全替换父类出现的位置
- ISP 接口隔离：不强迫类依赖它用不到的接口

---

# 第二章 Spring IoC 与 DI

## 2.1 IoC 控制反转

IoC（Inversion of Control，控制反转）是 Spring 的核心设计理念。传统编程中，对象的创建和依赖关系由调用方自己 `new` 出来并维护；IoC 将这种控制权反转给了 Spring 容器——对象的创建、初始化、依赖装配全部由容器负责，调用方只需要从容器中取用即可。

IoC 的实现机制是反射：Spring 通过读取配置（XML 或注解），利用反射调用类的无参构造方法来创建对象。因此，**被 Spring 管理的类必须提供无参构造方法**（Java 中若没有显式定义构造方法，编译器会自动生成无参构造方法；但若手动定义了有参构造方法，则无参构造方法需要显式声明）。

IoC 容器在 Spring 中有两个核心接口层级：

- BeanFactory：最基础的容器接口，懒加载（getBean 时才实例化）
- ApplicationContext：BeanFactory 的扩展，支持国际化、事件发布、AOP 等，容器启动时即完成所有单例 Bean 的实例化。**实际开发中始终使用 ApplicationContext**

常用的 ApplicationContext 实现类：

- ClassPathXmlApplicationContext：从类路径加载 XML 配置文件
- FileSystemXmlApplicationContext：从文件系统路径加载 XML 配置文件
- AnnotationConfigApplicationContext：基于 Java 配置类（全注解开发）

```java
// XML 方式
ApplicationContext ctx = new ClassPathXmlApplicationContext("spring.xml");
// 全注解方式
ApplicationContext ctx = new AnnotationConfigApplicationContext(SpringConfig.class);
```

> SpringBoot 适配：SpringBoot 内部使用的是 AnnotationConfigServletWebServerApplicationContext（Web 环境）或 AnnotationConfigApplicationContext（非 Web），由 SpringApplication.run() 自动创建，开发者无需手动实例化容器。

## 2.2 DI 依赖注入

DI（Dependency Injection，依赖注入）是 IoC 的具体实现方式。IoC 描述的是思想（控制权的反转），DI 描述的是实现手段（通过注入来给对象装配依赖）。两者是同一件事的不同表述角度。

### set 注入

set 注入要求 Bean 类为每个需要注入的属性提供 setter 方法，Spring 通过调用 setter 来完成赋值。这是最常见的 XML 注入方式。

XML 配置方式：

```xml
<bean id="userService" class="com.example.service.UserServiceImpl">
    <!-- 简单类型（String/基本类型）-->
    <property name="name" value="张三"/>
    <property name="age" value="18"/>
    <!-- 引用类型：ref 指向另一个 bean 的 id -->
    <property name="userDao" ref="userDao"/>
</bean>

<bean id="userDao" class="com.example.dao.UserDaoImpl"/>
```

注解方式（配合组件扫描）：

```java
@Service
public class UserServiceImpl {
    @Autowired
    private UserDao userDao;
    // 无需 setter，Spring 直接注入字段
}
```

> SpringBoot 适配：SpringBoot 中注解注入方式与 Spring 完全一致，无需额外配置。XML 方式通常不再使用，除非需要集成遗留配置。

**外部 Bean 与内部 Bean**：上面示例中 `userDao` 是独立定义的外部 Bean，通过 `ref` 引用。也可以把 Bean 定义嵌套在 `<property>` 内部（内部 Bean），该 Bean 无 id，无法被其他地方引用：

```xml
<bean id="userService" class="com.example.service.UserServiceImpl">
    <property name="userDao">
        <bean class="com.example.dao.UserDaoImpl"/>
    </property>
</bean>
```

**级联属性赋值**：通过 `属性.子属性` 直接给嵌套对象的属性赋值，前提是子对象已注入且有对应 setter：

```xml
<bean id="userService" class="com.example.service.UserServiceImpl">
    <property name="userDao" ref="userDao"/>
    <property name="userDao.dataSource" ref="dataSource"/>
</bean>
```

> 了解即可，实际项目中更推荐在各自 Bean 定义中完成依赖注入。

### 构造器注入

构造器注入通过带参构造方法来完成依赖传入。优点是注入的依赖不可变（final 字段），对象创建即完成装配；缺点是当依赖过多时构造方法参数列表会很长，可读性下降。

XML 配置方式（按参数名）：

```xml
<bean id="orderService" class="com.example.service.OrderServiceImpl">
    <constructor-arg name="orderDao" ref="orderDao"/>
    <constructor-arg name="name" value="订单服务"/>
</bean>
```

XML 配置方式（按参数索引）：

```xml
<constructor-arg index="0" ref="orderDao"/>
<constructor-arg index="1" value="订单服务"/>
```

注解方式：

```java
@Service
public class OrderServiceImpl {
    private final OrderDao orderDao;
    
    @Autowired
    public OrderServiceImpl(OrderDao orderDao) {
        this.orderDao = orderDao;
    }
}
// 当有且仅有一个有参构造方法时，@Autowired 可以省略
```

> 坑点：构造器注入会导致循环依赖无法解决（两个 Bean 互相依赖且都用构造器注入时，Spring 无法完成初始化），此时需改用 set 注入。

### 集合类型的 set 注入

XML 中支持对 List、Set、Map、Properties 类型的属性进行注入：

```xml
<bean id="someBean" class="com.example.SomeBean">
    <!-- List -->
    <property name="nameList">
        <list>
            <value>张三</value>
            <value>李四</value>
        </list>
    </property>
    <!-- Set -->
    <property name="nameSet">
        <set>
            <value>aa</value>
            <value>bb</value>
        </set>
    </property>
    <!-- Map -->
    <property name="map">
        <map>
            <entry key="k1" value="v1"/>
            <entry key="k2" value="v2"/>
        </map>
    </property>
    <!-- Properties -->
    <property name="props">
        <props>
            <prop key="username">root</prop>
            <prop key="password">123456</prop>
        </props>
    </property>
    <!-- 数组 -->
    <property name="scores">
        <array>
            <value>90</value>
            <value>85</value>
        </array>
    </property>
    <!-- null 值 -->
    <property name="address"><null/></property>
    <!-- 空字符串 -->
    <property name="email" value=""/>
    <!-- 也可以写成 <property name="email"><value/></property> -->
    <!-- 包含特殊字符（如 <、>），用 CDATA 包裹 -->
    <property name="expression"><value><![CDATA[2 < 3]]></value></property>
</bean>
```

> SpringBoot 适配：Spring Boot 环境中集合注入通常通过 @ConfigurationProperties 注解绑定 application.properties/yml 中的列表配置，或通过 @Value 注入单个值。

### 自动装配（autowire）

XML 中可以为 bean 指定 `autowire` 属性，让 Spring 自动按类型或名称寻找依赖，无需手动 `<property>` 配置：

```xml
<!-- byType：按照属性类型自动查找匹配的 bean（该类型的 bean 只能有一个）-->
<bean id="userService" class="com.example.UserServiceImpl" autowire="byType"/>

<!-- byName：按照属性名称查找同名的 bean id -->
<bean id="userService" class="com.example.UserServiceImpl" autowire="byName"/>
```

注意：`byType` 模式下如果同一类型存在多个 bean，会抛出异常。`byName` 模式下要求 bean 的 id 与属性名完全一致。

> SpringBoot 适配：注解开发中 `@Autowired` 默认 byType，`@Qualifier` 配合指定 byName，等价于 XML 的 autowire 机制。实际开发中 XML 的 autowire 几乎不再使用。

## 2.3 外部属性文件注入

实际项目中数据库连接信息等配置不应硬编码在 spring.xml 里，而是抽取到 `.properties` 文件，由 Spring 动态读取。

properties 文件示例（jdbc.properties）：

```properties
jdbc.driver=com.mysql.cj.jdbc.Driver
jdbc.url=jdbc:mysql://localhost:3306/mydb
jdbc.username=root
jdbc.password=123456
```

XML 方式引入：

```xml
<!-- 引入外部属性文件 -->
<context:property-placeholder location="classpath:jdbc.properties"/>

<bean id="dataSource" class="com.zaxxer.hikari.HikariDataSource">
    <property name="driverClassName" value="${jdbc.driver}"/>
    <property name="jdbcUrl" value="${jdbc.url}"/>
    <property name="username" value="${jdbc.username}"/>
    <property name="password" value="${jdbc.password}"/>
</bean>
```

注解方式（需要在配置类上声明）：

```java
@Configuration
@PropertySource("classpath:jdbc.properties")
public class DataSourceConfig {

    @Value("${jdbc.driver}")
    private String driver;
    @Value("${jdbc.url}")
    private String url;

    @Bean
    public DataSource dataSource() {
        HikariDataSource ds = new HikariDataSource();
        ds.setDriverClassName(driver);
        ds.setJdbcUrl(url);
        return ds;
    }
}
```

> SpringBoot 适配：SpringBoot 默认加载 `application.properties` / `application.yml`，通过 `@ConfigurationProperties` 注解可以将配置自动绑定到 Java 对象，比 `@Value` 更推荐用于批量属性。`@PropertySource` 在 SpringBoot 中用于加载额外的配置文件。

## 2.4 p 命名空间、c 命名空间与 util 命名空间

这三个是 XML 配置的语法糖，让配置更简洁，了解即可。

p 命名空间（简化 set 注入）：

```xml
<!-- 引入命名空间：xmlns:p="http://www.springframework.org/schema/p" -->
<bean id="user" class="com.example.User" p:name="张三" p:age="18" p:userDao-ref="userDao"/>
```

c 命名空间（简化构造器注入）：

```xml
<!-- 引入命名空间：xmlns:c="http://www.springframework.org/schema/c" -->
<bean id="user" class="com.example.User" c:name="张三" c:age="18"/>
```

util 命名空间（定义可复用的集合 bean）：

```xml
<!-- 引入命名空间：xmlns:util="http://www.springframework.org/schema/util" -->
<util:list id="nameList">
    <value>张三</value>
    <value>李四</value>
</util:list>

<bean id="user" class="com.example.User">
    <property name="names" ref="nameList"/>
</bean>
```

> SpringBoot 适配：SpringBoot 几乎不使用 XML 配置，以上内容在 SpringBoot 中无需掌握。

## 2.5 Bean 的 XML 配置详解

### id 与 class 属性

- `id`：Bean 的唯一标识符，相当于 Bean 的名字，同一配置文件中不允许重复
- `class`：Bean 的全限定类名，Spring 通过反射调用该类的无参构造方法来创建对象

```xml
<bean id="userBean" class="com.example.bean.User"/>
```

### DTD 与 Schema 约束

Spring 的 XML 配置文件有两种约束格式：

- DTD 格式（旧）：`<!DOCTYPE beans PUBLIC ...>`，功能简单，已过时
- Schema 格式（新，推荐）：通过 `xsi:schemaLocation` 引入，支持命名空间扩展（context、aop、tx 等），是当前标准用法

### 多配置文件 import

大型项目通常将配置拆分为多个文件，在主配置文件中汇总引入：

```xml
<import resource="classpath:spring-dao.xml"/>
<import resource="classpath:spring-service.xml"/>
```

> SpringBoot 适配：SpringBoot 通过 @Import 注解引入其他配置类，不使用 XML import 语法。

---

# 第三章 Bean 配置进阶

## 3.1 Bean 的作用域（Scope）

Bean 的作用域决定了容器创建 Bean 实例的策略和生命周期范围。通过 `scope` 属性配置：

### singleton（单例：默认）

单例作用域：整个 IoC 容器中只存在一个实例，所有 getBean() 调用返回的都是同一个对象。容器启动时即创建，容器销毁时销毁。

```xml
<bean id="userService" class="com.example.UserServiceImpl" scope="singleton"/>
```

```java
@Component // 默认就是 singleton，无需额外声明
@Scope("singleton")  // 也可显式声明
public class UserService {}
```

### prototype（多例）

多例作用域：每次 getBean() 都创建一个新实例，Spring 负责创建但不负责销毁（由 GC 回收）。

```xml
<bean id="shoppingCart" class="com.example.ShoppingCart" scope="prototype"/>
```

```java
@Component
@Scope("prototype")
public class ShoppingCart {}
```

使用场景：有状态的 Bean（如购物车、用户会话对象）应使用 prototype，防止多线程共用同一实例导致数据污染。

### Web 相关作用域

仅在 Web 环境（ApplicationContext 为 WebApplicationContext）下可用：

- `request`：每次 HTTP 请求创建一个新实例，请求结束销毁
- `session`：每个 HTTP Session 对应一个实例，Session 失效销毁
- `application`：整个 ServletContext 生命周期内只有一个实例
- `websocket`：每个 WebSocket 会话一个实例

```java
@Component
@Scope(value = WebApplicationContext.SCOPE_REQUEST, proxyMode = ScopedProxyMode.TARGET_CLASS)
public class LoginUser {}
```

> SpringBoot 适配：scope 在 SpringBoot 中使用方式完全相同。不过在 SpringBoot 的 Web 项目中，controller 本身是 singleton，如果需要 request/session 作用域的 Bean，必须配合 proxyMode 使用作用域代理，否则单例 Bean 中注入的 request-scoped Bean 引用会不正确。**但在springboot中也不建议这样写**，一般建议直接在controller方法上直接写参数：HttpServletRequest / HttpSession

> 坑点：prototype scope 的 Bean 注入到 singleton Bean 中，每次调用 singleton Bean 方法时拿到的仍是同一个 prototype 实例，因为 singleton Bean 只被创建一次，注入只发生一次。解决方案：让 singleton Bean 实现 ApplicationContextAware，每次用时自己从容器 getBean；或使用 @Lookup 注解。

## 3.2 Bean 的生命周期

Spring 管理 Bean 从创建到销毁的完整过程，掌握生命周期有助于在正确的时机做初始化和清理工作。

### 5 步生命周期（基础版）

1. 实例化（调用无参构造）
2. 属性赋值（依赖注入）
3. 初始化（执行 init 方法）
4. 使用中
5. 销毁（执行 destroy 方法）

配置初始化/销毁方法：

```xml
<bean id="userDao" class="com.example.UserDaoImpl"
      init-method="init" destroy-method="destroy"/>
```

```java
public class UserDaoImpl {
    public void init() {
        System.out.println("初始化，建立数据库连接池");
    }
    public void destroy() {
        System.out.println("销毁，释放数据库连接池");
    }
}
```

注解方式（推荐）：

```java
@Component
public class UserDaoImpl {
    @PostConstruct  // 相当于 init-method
    public void init() {}
    
    @PreDestroy     // 相当于 destroy-method
    public void destroy() {}
}
```

> 坑点：`destroy-method` 只在 singleton Bean 的容器关闭（`ctx.close()`）时触发。prototype 作用域的 Bean，Spring 不会调用其销毁方法。如果测试时没有手动调用 `ctx.close()`，销毁方法不会执行。

### 7 步生命周期（加入 BeanPostProcessor）

在 5 步基础上，如果容器中注册了 BeanPostProcessor，则在初始化方法前后各插入一步：

1. 实例化
2. 属性赋值
3. **BeanPostProcessor#postProcessBeforeInitialization**
4. 初始化（init 方法）
5. **BeanPostProcessor#postProcessAfterInitialization**
6. 使用中
7. 销毁

BeanPostProcessor 作用于容器中**所有** Bean，常见用途：AOP 代理对象的生成就是在 `postProcessAfterInitialization` 中完成的。

```java
@Component
public class MyBeanPostProcessor implements BeanPostProcessor {
    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) {
        // 初始化之前的处理
        return bean;
    }
    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) {
        // 初始化之后的处理，AOP 代理在这里生成
        return bean;
    }
}
```

### 10 步生命周期（加入 Aware 接口回调）

Spring 在 BeanPostProcessor 之前还会回调若干 Aware 接口：

1. 实例化
2. 属性赋值
3. BeanNameAware#setBeanName（注入 Bean 在容器中的名称）
4. BeanClassLoaderAware#setBeanClassLoader（注入类加载器）
5. BeanFactoryAware#setBeanFactory（注入 BeanFactory）
6. EnvironmentAware、ResourceLoaderAware 等其他 Aware 回调
7. BeanPostProcessor#postProcessBeforeInitialization
8. InitializingBean#afterPropertiesSet（可替代 init-method）
9. init-method
10. BeanPostProcessor#postProcessAfterInitialization
11. 使用中
12. DisposableBean#destroy（可替代 destroy-method）
13. destroy-method

实现 Aware 接口示例：

```java
@Component
public class MyService implements ApplicationContextAware {
    private ApplicationContext ctx;
    
    @Override
    public void setApplicationContext(ApplicationContext applicationContext) {
        this.ctx = applicationContext;
    }
}
```

> SpringBoot 适配：@PostConstruct / @PreDestroy 在 SpringBoot 中同样有效，是推荐写法。XML 的 init-method/destroy-method 在 SpringBoot 中也可通过 @Bean(initMethod="xxx", destroyMethod="xxx") 等价配置。

## 3.3 Bean 的实例化方式

Spring 提供了多种 Bean 实例化策略，适应不同场景。

### 无参构造方法（默认）

最常见的方式，Spring 反射调用无参构造方法：

```xml
<bean id="user" class="com.example.User"/>
```

### 静态工厂方法

让工厂类的静态方法来创建 Bean，适用于需要控制创建逻辑的场景：

```java
public class UserFactory {
    public static User createUser() {
        return new User("default");
    }
}
```

```xml
<!-- factory-method 指定静态方法名，class 是工厂类 -->
<bean id="user" class="com.example.UserFactory" factory-method="createUser"/>
```

### 实例工厂方法

先创建工厂 Bean 实例，再通过实例方法创建目标 Bean：

```java
public class UserFactory {
    public User createUser() {
        return new User("from factory");
    }
}
```

```xml
<bean id="userFactory" class="com.example.UserFactory"/>
<bean id="user" factory-bean="userFactory" factory-method="createUser"/>
```

### FactoryBean 接口

实现 `org.springframework.beans.factory.FactoryBean<T>` 接口，Spring 会自动识别并调用 `getObject()` 的返回值作为最终 Bean：

```java
@Component
public class MyFactoryBean implements FactoryBean<User> {
    @Override
    public User getObject() {
        return new User("from FactoryBean");
    }
    @Override
    public Class<?> getObjectType() {
        return User.class;
    }
    @Override
    public boolean isSingleton() {
        return true;
    }
}
```

注意区别：
- `getBean("myFactoryBean")` → 返回 `User` 对象（getObject() 的返回值）
- `getBean("&myFactoryBean")` → 返回 `MyFactoryBean` 本身（加 `&` 前缀）

FactoryBean 是 Spring 集成第三方框架的常用手段，如 MyBatis 的 `SqlSessionFactoryBean`、Hibernate 的 `LocalSessionFactoryBean` 都是这个模式。

> 坑点：注意区分 `BeanFactory` 和 `FactoryBean`——`BeanFactory` 是 IoC 容器的顶层接口（工厂），`FactoryBean` 是一个特殊的 Bean（产品），它能让开发者自定义 Bean 的创建逻辑。调用 `getBean("xxx")` 拿到的是 FactoryBean 产出的对象；加 `&` 前缀 `getBean("&xxx")` 才能拿到 FactoryBean 本身。

> SpringBoot 适配：FactoryBean 在 SpringBoot 中同样有效，实际开发中用于集成 MyBatis、Quartz 等场景。

> 坑点（Date 注入格式问题）：`java.util.Date` 在 Spring XML 中作为简单类型注入时，对日期字符串格式要求极为严格，必须写成 `Mon Oct 10 14:30:26 CST 2025` 这种形式，`2002-10-10` 这样的常规格式无法识别。实际项目中通常通过 FactoryBean 封装日期转换逻辑，或在注解开发中配合 `@DateTimeFormat` 解决。

## 3.4 Bean 循环依赖与三级缓存

### 什么是循环依赖

A 依赖 B，B 又依赖 A，这就形成了循环依赖。如果 A 和 B 都使用构造器注入，Spring 无论先创建哪个都会因为另一个未创建完成而报错。

```
A -> B -> A  （无限循环，无法完成初始化）
```

### Spring 的解决方案：三级缓存

Spring 针对 **singleton + set 注入**的循环依赖，通过三个 Map 来解决：

- **一级缓存 singletonObjects**：存放已完全初始化的单例 Bean（可以对外使用的成品）
- **二级缓存 earlySingletonObjects**：存放提前暴露的 Bean 实例（已实例化但尚未完成依赖注入，可能是代理对象）
- **三级缓存 singletonFactories**：存放 Bean 的 ObjectFactory（用于生成早期引用，可在此生成 AOP 代理）

解决过程示意：
1. 创建 A，实例化后把 A 的工厂放入三级缓存
2. 对 A 进行属性注入，发现需要 B
3. 创建 B，实例化后把 B 的工厂放入三级缓存
4. 对 B 进行属性注入，发现需要 A
5. 从三级缓存取出 A 的 ObjectFactory，生成 A 的早期引用，放入二级缓存，清除三级缓存中的 A
6. B 完成初始化，放入一级缓存
7. A 的属性注入 B 完成，A 完成初始化，放入一级缓存，清除二级缓存中的 A

为什么需要三级缓存而不是两级？核心原因是 AOP 代理。如果只用两级缓存（成品 + 半成品），当 A 需要被 AOP 代理时：
- A 实例化后直接放入二级缓存（原始对象）
- B 依赖 A，从二级缓存拿到的是原始对象
- A 初始化完成后放入一级缓存的是代理对象 `$ProxyA`
- B 中持有的仍是原始对象，调用 A 的方法时 AOP 增强逻辑失效

三级缓存的 `ObjectFactory` 在获取早期引用时会判断：需要代理就生成代理对象，不需要就直接返回原始对象。这样 B 注入的就是正确的代理对象，与一级缓存中的最终 Bean 保持一致。

### 无法解决的循环依赖场景

- **构造器注入 + 循环依赖**：创建 A 时需要 B，创建 B 时需要 A，但此时 A 连实例都没有（构造方法都没跑完），三级缓存机制无从介入。Spring 6 之后，遇到构造器循环依赖会直接抛出 BeanCurrentlyInCreationException，不会尝试解决
- **prototype 作用域 + 循环依赖**：prototype Bean 不存入缓存，Spring 无法提前暴露引用，因此 prototype 之间的循环依赖也无法解决

> 坑点：Spring Boot 2.6+ 默认**禁止**循环依赖，如果项目中存在循环依赖会在启动时报错。如需临时允许（不推荐），在 application.properties 中设置 `spring.main.allow-circular-references=true`。根本解决方案是重构代码：将公共依赖抽取到第三个类，或将其中一个依赖改为懒注入（`@Lazy`）。

## 3.5 GoF 工厂模式

这一节梳理三种工厂模式的区别，有助于理解 Spring 自身的设计。

### 简单工厂模式（静态工厂）

用一个静态方法根据参数决定创建哪种对象。客户端不直接 new，但工厂和产品高度耦合——每增加一种产品就要修改工厂方法，违反 OCP。

```java
public class ShapeFactory {
    public static Shape create(String type) {
        if ("circle".equals(type)) return new Circle();
        if ("square".equals(type)) return new Square();
        throw new IllegalArgumentException("未知类型");
    }
}
```

Spring 应用：`BeanFactory.getBean("beanName")` 就是简单工厂的体现。

### 工厂方法模式

将工厂本身抽象为接口，每种产品对应一个具体工厂。增加产品时只需新增工厂类，符合 OCP，但工厂类数量随产品增多。

```java
public interface ShapeFactory {
    Shape create();
}
public class CircleFactory implements ShapeFactory {
    public Shape create() { return new Circle(); }
}
public class SquareFactory implements ShapeFactory {
    public Shape create() { return new Square(); }
}
```

Spring 应用：XML 中的 `factory-method`（实例工厂）体现的就是工厂方法模式；`FactoryBean` 也是这个模式的体现。

### 抽象工厂模式

在工厂方法基础上，定义一个能生产**一族相关产品**的工厂接口。适用于需要保证产品族内兼容性的场景（如 UI 换肤：一套皮肤包含 Button、TextBox、ScrollBar 等组件）。

```java
public interface GUIFactory {
    Button createButton();
    TextBox createTextBox();
}
public class DarkThemeFactory implements GUIFactory {
    public Button createButton() { return new DarkButton(); }
    public TextBox createTextBox() { return new DarkTextBox(); }
}
```

Spring 应用：`ApplicationContext` 可以看作抽象工厂，它可以生产各种不同类型的 Bean。

---

# 第四章 Spring 注解式开发

## 4.1 声明 Bean 的注解

Spring 提供四个注解用于将类声明为 Bean，让容器扫描并纳入管理：

- `@Component`：通用，适用于不好归类的普通组件
- `@Controller`：语义标记 MVC 控制层
- `@Service`：语义标记业务逻辑层
- `@Repository`：语义标记数据访问层

从源码来看，`@Controller`、`@Service`、`@Repository` 都是 `@Component` 的别名（元注解中包含 `@Component`），功能完全等价。加语义注解的目的是提升代码可读性，约定俗成。

Bean 的命名规则：
- `@Component("userBean")`：显式指定 bean id
- `@Component`：不指定时，默认 bean id 为类名首字母小写（`UserService` → `userService`）

> SpringBoot 适配：SpringBoot 通过 `@SpringBootApplication`（包含 `@ComponentScan`）自动扫描启动类所在包及其子包。开发者只需在类上加对应注解即可，无需额外 XML 配置。

## 4.2 开启组件扫描

XML 方式（引入 context 命名空间后配置）：

```xml
<!-- 扫描单个包 -->
<context:component-scan base-package="com.example.service"/>
<!-- 扫描多个包，用逗号分隔 -->
<context:component-scan base-package="com.example.service,com.example.dao"/>
<!-- 扫描共同父包（最常用）-->
<context:component-scan base-package="com.example"/>
```

全注解方式（配置类）：

```java
@Configuration
@ComponentScan("com.example")
public class SpringConfig {}
```

### 选择性实例化

有时只想让特定注解的 Bean 参与扫描，可以使用 include-filter / exclude-filter：

```xml
<!-- 只扫描 @Controller 标注的类 -->
<context:component-scan base-package="com.example" use-default-filters="false">
    <context:include-filter type="annotation" 
                            expression="org.springframework.stereotype.Controller"/>
</context:component-scan>

<!-- 扫描所有，但排除 @Repository -->
<context:component-scan base-package="com.example">
    <context:exclude-filter type="annotation"
                            expression="org.springframework.stereotype.Repository"/>
</context:component-scan>
```

`use-default-filters="false"` 关闭默认的四个注解扫描规则，然后通过 include-filter 精确指定。

## 4.3 依赖注入注解

### @Value：注入简单类型

`@Value` 用于注入基本类型和 String。可以写在字段上、setter 方法上，或构造方法参数上：

```java
@Component
public class User {
    @Value("张三")          // 直接赋值字符串
    private String name;
    
    @Value("18")            // 数字会自动转换类型
    private int age;
    
    @Value("${app.version}") // 从配置文件读取
    private String version;
}
```

字段上直接使用 `@Value` 时，Spring 通过反射绕过访问修饰符直接赋值，不需要 setter 方法。

> SpringBoot 适配：`@Value` 在 SpringBoot 中同样可用，并且直接从 `application.properties` / `application.yml` 读取对应 key 的值。

### @Autowired：注入非简单类型（byType）

`@Autowired` 是 Spring 自带的注解，默认按类型（byType）注入：

```java
@Service
public class UserService {
    @Autowired  // 注入在字段上，无需 setter
    private UserDao userDao;
}
```

`@Autowired` 可标注的位置：字段、setter 方法、构造方法、构造方法参数。

当有且仅有一个有参构造方法时，`@Autowired` 注解可以省略：

```java
@Service
public class UserService {
    private final UserDao userDao;
    
    // 只有一个有参构造，@Autowired 可省略
    public UserService(UserDao userDao) {
        this.userDao = userDao;
    }
}
```

`required` 属性：默认 `true`，表示 Bean 必须存在，找不到则抛异常。设为 `false` 则找不到时注入 null 而不报错：

```java
@Autowired(required = false)
private SomeOptionalService optionalService;
```

### @Qualifier：配合 @Autowired 按名称注入

当一个接口有多个实现类时，纯 byType 无法确定注入哪个，需要 `@Qualifier` 指定 Bean 名称：

```java
// 两个实现类
@Repository("mysqlDao")
public class UserDaoForMySQL implements UserDao {}

@Repository("oracleDao")
public class UserDaoForOracle implements UserDao {}

// 注入时指定名称
@Service
public class UserService {
    @Autowired
    @Qualifier("mysqlDao")
    private UserDao userDao;
}
```

`@Qualifier` 不能单独使用，必须配合 `@Autowired` 一起。

### @Resource：标准注解（byName 优先）

`@Resource` 是 JDK 扩展包（Jakarta/JSR-250）中的注解，不依赖 Spring，通用性更强。

装配规则：
- 有 `name` 属性：直接按 name 查找
- 无 `name` 属性：先把字段名（或 setter 对应的属性名）作为 name 查找，找不到再 byType

```java
@Service
public class UserService {
    // 先找 name="userDao" 的 Bean，找不到再 byType
    @Resource
    private UserDao userDao;
    
    // 直接指定 name
    @Resource(name = "mysqlDao")
    private UserDao mysqlUserDao;
}
```

`@Resource` 只能用在字段和 setter 方法上，**不能**用在构造方法上。

`@Autowired` vs `@Resource` 核心区别：

| 对比项 | @Autowired | @Resource |
|--------|-----------|-----------|
| 来源 | Spring 框架 | JDK 扩展包（JSR-250） |
| 默认策略 | byType | byName |
| 指定名称 | 配合 @Qualifier | name 属性 |
| 可用位置 | 字段/setter/构造/参数 | 字段/setter |

> 注意：Spring 6 / SpringBoot 3 基于 JakartaEE 9，`@Resource` 需要引入 `jakarta.annotation-api` 依赖（JDK 11+ 不再内置）。JDK 8 不需要额外引入。

## 4.4 全注解式开发

用 Java 配置类完全替代 spring.xml，是 SpringBoot 的基础。

### @Configuration

标注在类上，表示该类是 Spring 配置类，等价于一个 spring.xml 文件。

```java
@Configuration
@ComponentScan("com.example")
public class SpringConfig {
    // 配置 Bean 的方法写在这里
}
```

### @Bean

标注在配置类的方法上，将方法的返回值作为 Bean 注入容器。适合注入无法使用 @Component 的第三方类：

```java
@Configuration
public class DataSourceConfig {
    @Bean("dataSource")  // bean id 为 "dataSource"，不指定则用方法名
    public DataSource dataSource() {
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl("jdbc:mysql://localhost:3306/mydb");
        return ds;
    }
}
```

`@Bean` 方法中可以直接调用同一配置类中的其他 `@Bean` 方法，Spring 会保证返回的是同一个单例（`@Configuration` 类会被 CGLIB 代理）：

```java
@Configuration
public class AppConfig {
    @Bean
    public ServiceA serviceA() {
        return new ServiceA(repository()); // 调用 repository()，仍是同一个实例
    }
    
    @Bean
    public Repository repository() {
        return new RepositoryImpl();
    }
}
```

### @ComponentScan

指定组件扫描的包，与 XML 的 `<context:component-scan>` 等价：

```java
@Configuration
@ComponentScan({"com.example.service", "com.example.dao"})
public class AppConfig {}
```

### @PropertySource

加载外部 properties 文件：

```java
@Configuration
@PropertySource("classpath:jdbc.properties")
public class DataSourceConfig {
    @Value("${jdbc.url}")
    private String url;
}
```

### 启动全注解容器

```java
ApplicationContext ctx = new AnnotationConfigApplicationContext(SpringConfig.class);
```

> SpringBoot 适配：SpringBoot 的 `@SpringBootApplication` 注解等价于 `@Configuration + @ComponentScan + @EnableAutoConfiguration`，是全注解开发的终极形式。开发者定义 Bean 只需要 `@Component` 系列注解或在配置类中用 `@Bean`，SpringBoot 会自动处理其余一切。

---

# 第五章 GoF 代理模式

## 5.1 代理模式概念

代理模式属于 GoF 23 种设计模式中的结构型模式。核心思想是：为目标对象提供一个代理，客户端通过代理间接访问目标对象。

代理模式的典型用途：
- **功能增强**：在目标方法前后插入日志、性能统计等额外逻辑，不修改原始代码
- **访问控制**：在代理层做权限校验、登录检查，保护目标对象
- **代码复用**：将横切逻辑集中在代理中，避免在每个业务类中重复编写

代理模式的三个角色：
- 抽象主题（接口）：代理类和目标类共同实现的接口，保证客户端感知不到差异
- 目标类（真实主题）：被代理的原始类，包含核心业务逻辑
- 代理类：持有目标类的引用，在调用目标方法的前后加入增强逻辑

## 5.2 静态代理

静态代理由开发者手动编写代理类，每个代理类对应一个被代理的接口。

```java
// 公共接口
public interface OrderService {
    void generate();
    void modify();
}

// 目标类
public class OrderServiceImpl implements OrderService {
    public void generate() { System.out.println("订单已生成"); }
    public void modify()   { System.out.println("订单已修改"); }
}

// 代理类：统计耗时，不修改原始类
public class OrderServiceProxy implements OrderService {
    private OrderService target;  // 持有目标对象引用

    public OrderServiceProxy(OrderService target) {
        this.target = target;
    }

    public void generate() {
        long begin = System.currentTimeMillis();
        target.generate();  // 调用目标方法
        System.out.println("耗时：" + (System.currentTimeMillis() - begin) + "ms");
    }

    public void modify() {
        long begin = System.currentTimeMillis();
        target.modify();
        System.out.println("耗时：" + (System.currentTimeMillis() - begin) + "ms");
    }
}
```

使用方式：

```java
OrderService proxy = new OrderServiceProxy(new OrderServiceImpl());
proxy.generate();
```

静态代理符合 OCP（不修改目标类），并且采用关联关系而非继承，耦合度低。但缺点是：每个接口都需要编写一个代理类，接口多了会引发类爆炸。动态代理解决了这个问题。

## 5.3 动态代理

动态代理在程序运行时在内存中动态生成代理类字节码，无需手动编写代理类。一套代理逻辑可以复用于所有接口/类。

### JDK 动态代理

JDK 动态代理只能代理实现了接口的类（因为生成的代理类本身继承了 Proxy，Java 不支持多重继承，所以只能通过接口来约束）。

核心 API：`java.lang.reflect.Proxy.newProxyInstance()`

```java
// InvocationHandler：代理逻辑的实现
public class TimerInvocationHandler implements InvocationHandler {
    private Object target;  // 目标对象

    public TimerInvocationHandler(Object target) {
        this.target = target;
    }

    // 当调用代理对象的任意方法时，此 invoke 会被触发
    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        long begin = System.currentTimeMillis();
        Object retValue = method.invoke(target, args);  // 反射调用目标方法
        System.out.println("耗时：" + (System.currentTimeMillis() - begin) + "ms");
        return retValue;
    }
}
```

创建代理对象：

```java
OrderService target = new OrderServiceImpl();
OrderService proxy = (OrderService) Proxy.newProxyInstance(
    target.getClass().getClassLoader(),    // 类加载器
    target.getClass().getInterfaces(),     // 代理类要实现的接口
    new TimerInvocationHandler(target)     // 调用处理器
);
proxy.generate(); // 实际调用 TimerInvocationHandler.invoke()
```

`newProxyInstance` 三个参数：
- 类加载器：用于将内存中生成的代理类字节码加载到 JVM
- 接口数组：代理类需要实现的接口列表
- InvocationHandler：每次调用代理方法时触发的回调

### CGLIB 动态代理

CGLIB（Code Generation Library）通过继承目标类并重写方法的方式生成代理，可以代理没有接口的类。底层使用字节码操作框架 ASM，性能比 JDK 动态代理略好。

限制：目标类不能是 `final` 修饰的（无法被继承），目标方法也不能是 `final`/`private`（无法被重写）。

```java
// 目标类（无接口）
public class UserService {
    public void login() { System.out.println("用户登录"); }
}

// 方法拦截器（类似 InvocationHandler）
public class TimerMethodInterceptor implements MethodInterceptor {
    @Override
    public Object intercept(Object proxy, Method method, Object[] args, MethodProxy methodProxy)
            throws Throwable {
        long begin = System.currentTimeMillis();
        Object retValue = methodProxy.invokeSuper(proxy, args);  // 调用父类方法（目标方法）
        System.out.println("耗时：" + (System.currentTimeMillis() - begin) + "ms");
        return retValue;
    }
}
```

创建 CGLIB 代理：

```java
Enhancer enhancer = new Enhancer();
enhancer.setSuperclass(UserService.class);           // 继承目标类
enhancer.setCallback(new TimerMethodInterceptor());  // 设置拦截器
UserService proxy = (UserService) enhancer.create();
proxy.login();
```

> 注意：JDK 17+ 使用 CGLIB 时需要添加 JVM 启动参数开放模块访问权限：
> `--add-opens java.base/java.lang=ALL-UNNAMED`

### JDK 代理 vs CGLIB 代理

| 对比项 | JDK 动态代理 | CGLIB 动态代理 |
|--------|------------|----------------|
| 代理目标 | 必须有接口 | 接口和无接口类均可 |
| 实现机制 | 实现接口 | 继承目标类 |
| 限制 | 目标类需实现接口 | 目标类/方法不能是 final |
| 性能 | 略低（反射调用） | 略高（字节码调用） |

**Spring 的选择策略**：Spring 5+ 默认统一使用 CGLIB 代理。也可通过配置强制使用 JDK：`proxy-target-class="false"`（只在目标类有接口时生效）。Spring AOP 只能代理 `public` 方法，非 public 的方法不会被代理。

> SpringBoot 适配：SpringBoot 默认 `spring.aop.proxy-target-class=true`，即所有 AOP 代理均使用 CGLIB，无论目标类是否有接口。如果希望强制 JDK 代理，设置为 `false`（不推荐，会导致需要通过接口类型获取 Bean）。

---

# 第六章 AOP 面向切面编程

## 6.1 AOP 的本质与优势

AOP（Aspect-Oriented Programming，面向切面编程）是对 OOP 的补充延伸，底层基于动态代理实现。

在一个系统中，日志、事务、权限校验等逻辑天然地存在于所有业务方法中——这些代码叫做**交叉业务**。如果把它们散落在每个业务方法里，会带来两个问题：代码重复且修改成本高；程序员无法专注核心业务。

AOP 的解决思路：**将交叉业务代码独立抽取为一个组件（切面），以横向交叉的方式织入目标对象的方法调用链中**，而不侵入业务代码本身。

AOP 的三大优势：
- 代码复用：横切逻辑只写一次
- 易维护：修改横切逻辑只需改一处
- 关注分离：业务代码只关注业务

## 6.2 AOP 七大术语

| 术语 | 说明 |
|------|------|
| 连接点 Joinpoint | 程序执行中可以插入切面的位置，如方法执行前、返回后、抛出异常时等 |
| 切点 Pointcut | 用表达式描述"在哪些连接点织入"，本质是一个位置匹配规则 |
| 通知 Advice | 在切点处执行的增强逻辑代码（要切入的具体代码） |
| 切面 Aspect | 切点 + 通知的组合，即"在哪里执行什么逻辑"的完整描述 |
| 织入 Weaving | 将切面应用到目标对象、生成代理对象的过程 |
| 代理对象 Proxy | 被 AOP 增强后产生的代理对象，客户端实际使用的是它 |
| 目标对象 Target | 原始的被增强对象，包含核心业务逻辑 |

切点和连接点的关系：连接点是所有可插入的位置（集合），切点是我们选择要插入的那些位置（子集）。

## 6.3 切点表达式

Spring AOP 支持多种切点表达式语法，最常用的是 `execution`。

### execution 表达式语法

```
execution([访问修饰符] 返回值类型 [全限定类名]方法名(参数列表) [异常])
```

各部分说明：
- 访问修饰符：可选，省略则匹配任意访问权限
- 返回值类型：必填，`*` 表示任意类型
- 全限定类名：可选，省略则匹配所有类；`..` 表示当前包及其所有子包
- 方法名：必填，`*` 表示所有方法，`set*` 表示所有 set 开头的方法
- 参数列表：必填，`()` 无参，`(..)` 任意参数，`(*)` 恰好一个任意类型参数，`(String, *)` 第一个参数为 String

常用示例：

```
// service 包下所有类的所有 public 方法
execution(public * com.example.service.*.*(..))

// service 包及其子包下所有类的所有方法
execution(* com.example.service..*(..))

// OrderService 类中所有以 delete 开头的 public 方法
execution(public * com.example.service.OrderService.delete*(..))

// 匹配所有方法（慎用，范围过大）
execution(* *(..))
```

### @annotation 表达式

匹配被特定注解标注的方法：

```
@annotation(com.example.annotation.Log)
```

只要方法上有 `@Log` 注解，就会被切入。

### within 表达式

匹配特定类型下的所有方法（不支持方法级精确匹配）：

```
within(com.example.service.*)
within(com.example.service..*)
```

## 6.4 通知类型（5 种）

Spring AOP 提供五种通知，对应方法执行生命周期的不同阶段：

| 注解 | 说明 |
|------|------|
| @Before | 前置通知：目标方法执行之前 |
| @After | 后置通知：目标方法结束后，无论是否抛出异常都执行 |
| @AfterReturning | 返回通知：目标方法正常返回后执行，若抛出未捕获异常则不执行 |
| @AfterThrowing | 异常通知：目标方法抛出未捕获异常后执行 |
| @Around | 环绕通知：目标方法执行前后都可介入，可以控制是否执行目标方法 |

执行顺序（正常情况）：

```
@Around 前半 → @Before → 目标方法 → @AfterReturning → @After → @Around 后半
```

执行顺序（异常情况，且异常未被捕获）：

```
@Around 前半 → @Before → 目标方法（抛异常）→ @AfterThrowing → @After
（@AfterReturning 不执行，@Around 后半不执行）
```

执行顺序（异常情况，但异常在环绕通知中被捕获）：

```
@Around 前半 → @Before → 目标方法（抛异常）→ @AfterThrowing → @After → @Around 后半
（@Around 后半会执行，@AfterReturning 不执行）
```

环绕通知示例：

```java
@Around("execution(* com.example.service.*.*(..))")
public Object aroundAdvice(ProceedingJoinPoint pjp) throws Throwable {
    System.out.println("环绕前");
    Object retValue = pjp.proceed();  // 执行目标方法
    System.out.println("环绕后");
    return retValue;
}
```

`ProceedingJoinPoint` 是 `JoinPoint` 的子接口，只有 `@Around` 可以使用它。调用 `pjp.proceed()` 才会真正执行目标方法，不调用则目标方法被拦截。

返回通知获取返回值：

```java
@AfterReturning(value = "execution(* com.example.service.*.*(..))", returning = "result")
public void afterReturning(Object result) {
    System.out.println("返回值：" + result);
}
```

异常通知获取异常：

```java
@AfterThrowing(value = "execution(* com.example.service.*.*(..))", throwing = "ex")
public void afterThrowing(Exception ex) {
    System.out.println("异常信息：" + ex.getMessage());
}
```

## 6.5 @Pointcut 切点复用

当多个通知使用相同的切点表达式时，可以用 `@Pointcut` 定义一次，引用多次：

```java
@Aspect
@Component
public class LogAspect {

    // 定义切点，方法名任意，方法体为空
    @Pointcut("execution(* com.example.service.*.*(..))")
    public void servicePointcut() {}

    @Before("servicePointcut()")
    public void before() {}

    @After("servicePointcut()")
    public void after() {}

    @AfterReturning("servicePointcut()")
    public void afterReturning() {}
}
```

跨切面类引用切点：

```java
// 在其他切面类中引用，需要写全限定方法名
@Before("com.example.aspect.LogAspect.servicePointcut()")
public void before() {}
```

## 6.6 基于 AspectJ 的 AOP 注解式开发

Spring 的 AOP 功能借助 AspectJ 框架的注解语法实现，需要引入 spring-aspects 依赖：

```xml
<dependency>
    <groupId>org.springframework</groupId>
    <artifactId>spring-aspects</artifactId>
    <version>6.2.13</version>
</dependency>
```

### 配置切面类

```java
@Aspect        // 声明这是一个切面类
@Component     // 纳入 Spring 容器管理
@Order(1)      // 多个切面时，数字越小优先级越高
public class TransactionAspect {

    @Pointcut("execution(* com.example.service..*(..))")
    public void txPointcut() {}

    @Around("txPointcut()")
    public Object around(ProceedingJoinPoint pjp) {
        Object retValue = null;
        try {
            System.out.println("开启事务");
            retValue = pjp.proceed();
            System.out.println("提交事务");
        } catch (Throwable e) {
            System.out.println("回滚事务");
        }
        return retValue;
    }
}
```

### XML 配置方式开启 AOP

```xml
<!-- 开启组件扫描 -->
<context:component-scan base-package="com.example"/>
<!-- 开启 AOP 自动代理，proxy-target-class="true" 表示使用 CGLIB -->
<aop:aspectj-autoproxy proxy-target-class="true"/>
```

### 全注解方式开启 AOP

```java
@Configuration
@ComponentScan("com.example")
@EnableAspectJAutoProxy(proxyTargetClass = true)  // 开启 AOP，等价于 XML 的 aop:aspectj-autoproxy
public class SpringConfig {}
```

> SpringBoot 适配：SpringBoot 引入了 `spring-boot-starter-aop` 依赖后，自动开启 AspectJ 代理，无需手动 `@EnableAspectJAutoProxy`。在切面类上加 `@Aspect` + `@Component` 即可生效。

## 6.7 多切面执行顺序（@Order）

当多个切面切入同一个目标方法时，通过 `@Order` 注解控制优先级，数字越小越先执行（包裹在外层）：

```java
@Aspect
@Component
@Order(1)  // 优先级最高，在最外层
public class SecurityAspect {}

@Aspect
@Component
@Order(2)  // 优先级较低，在内层
public class LogAspect {}
```

执行顺序类比嵌套的 try-catch：
- 正常：SecurityAspect 前 → LogAspect 前 → 目标方法 → LogAspect 后 → SecurityAspect 后
- 异常：SecurityAspect 前 → LogAspect 前 → 目标方法抛异常 → LogAspect 异常通知 → SecurityAspect 异常通知 → （异常继续向上）

## 6.8 XML 配置 AOP（了解）

XML 方式不依赖注解，在纯 XML 项目中使用。了解结构即可，实际开发用注解方式：

```xml
<aop:config>
    <!-- 切点定义 -->
    <aop:pointcut id="txPointcut" 
                  expression="execution(* com.example.service..*(..))"/>
    <!-- 切面定义 -->
    <aop:aspect ref="transactionAspect">
        <aop:around method="around" pointcut-ref="txPointcut"/>
        <aop:before  method="before" pointcut-ref="txPointcut"/>
        <aop:after   method="after"  pointcut-ref="txPointcut"/>
    </aop:aspect>
</aop:config>

<bean id="transactionAspect" class="com.example.aspect.TransactionAspect"/>
```

> 坑点合集：
> - 切面类本身不能被代理自己切入（否则无限递归），Spring 会自动处理避免这种情况
> - `@Around` 通知中必须调用 `pjp.proceed()` 并返回其返回值，否则目标方法被阻断且调用方拿不到正确返回值
> - `@AfterThrowing` 不会捕获异常，它只是观察异常，异常仍会继续向上传播；若要捕获并处理异常，应在 `@Around` 中使用 try-catch
> - Spring AOP 是基于代理的，同一类内部方法 A 调用方法 B，B 上的 AOP 不会生效（因为 A 调用的是 `this.B()`，不经过代理对象）

---

# 第七章 Spring 集成 MyBatis

## 7.1 为什么要整合

单独使用 MyBatis 时，开发者需要手动管理 SqlSessionFactory、SqlSession 的创建与关闭，并且 MyBatis 自身不提供事务管理能力。Spring 整合 MyBatis 的核心价值在于：

- 将 SqlSessionFactory 纳入 Spring 容器管理，统一生命周期
- 通过 MapperScannerConfigurer 自动扫描 Mapper 接口，省去手动 getMapper()
- 让 Spring 的声明式事务（@Transactional）接管 MyBatis 的事务，实现统一的事务管理
- 与 Spring IoC/DI 无缝协作，Mapper 可以直接 @Autowired 注入 Service

整合需要引入的关键依赖：
- `spring-jdbc`：提供 Spring 的 JDBC 抽象和事务管理基础
- `mybatis-spring`：MyBatis 官方提供的 Spring 集成桥接包

## 7.2 Maven 依赖

```xml
<!-- Spring 上下文 -->
<dependency>
    <groupId>org.springframework</groupId>
    <artifactId>spring-context</artifactId>
    <version>6.2.13</version>
</dependency>
<!-- Spring JDBC（事务管理依赖） -->
<dependency>
    <groupId>org.springframework</groupId>
    <artifactId>spring-jdbc</artifactId>
    <version>6.2.13</version>
</dependency>
<!-- MyBatis -->
<dependency>
    <groupId>org.mybatis</groupId>
    <artifactId>mybatis</artifactId>
    <version>3.5.16</version>
</dependency>
<!-- MyBatis-Spring 桥接包 -->
<dependency>
    <groupId>org.mybatis</groupId>
    <artifactId>mybatis-spring</artifactId>
    <version>3.0.4</version>
</dependency>
<!-- 数据库连接池 -->
<dependency>
    <groupId>com.zaxxer</groupId>
    <artifactId>HikariCP</artifactId>
    <version>7.0.2</version>
</dependency>
<!-- MySQL 驱动 -->
<dependency>
    <groupId>com.mysql</groupId>
    <artifactId>mysql-connector-j</artifactId>
    <version>8.4.0</version>
</dependency>
```

## 7.3 核心配置项

Spring 整合 MyBatis 的 XML 配置中有四个关键 Bean：

### 数据源

```xml
<context:property-placeholder location="classpath:jdbc.properties"/>

<bean id="dataSource" class="com.zaxxer.hikari.HikariDataSource">
    <property name="driverClassName" value="${jdbc.driver}"/>
    <property name="jdbcUrl"         value="${jdbc.url}"/>
    <property name="username"        value="${jdbc.username}"/>
    <property name="password"        value="${jdbc.password}"/>
</bean>
```

### SqlSessionFactoryBean

`SqlSessionFactoryBean` 是 MyBatis-Spring 提供的 FactoryBean 实现，负责创建 MyBatis 的 `SqlSessionFactory`：

```xml
<bean class="org.mybatis.spring.SqlSessionFactoryBean">
    <!-- 引用 MyBatis 自身的配置文件（可选，仅放 settings 等 MyBatis 级别配置） -->
    <property name="configLocation" value="classpath:mybatis-config.xml"/>
    <!-- 注入数据源 -->
    <property name="dataSource" ref="dataSource"/>
    <!-- 实体类别名包，配置后 resultType 可以直接写类名而不用全限定名 -->
    <property name="typeAliasesPackage" value="com.example.entity"/>
</bean>
```

> 说明：`configLocation` 属性不是必须的。如果不需要 MyBatis 级别的设置（如开启下划线转驼峰、标准日志），可以完全省略 mybatis-config.xml。

mybatis-config.xml 的典型内容（仅保留 Spring 无法替代的设置）：

```xml
<configuration>
    <settings>
        <!-- 开启 MyBatis 标准日志 -->
        <setting name="logImpl" value="STDOUT_LOGGING"/>
        <!-- 开启下划线转驼峰自动映射 -->
        <setting name="mapUnderscoreToCamelCase" value="true"/>
    </settings>
</configuration>
```

### MapperScannerConfigurer

自动扫描指定包下的所有 Mapper 接口，为每个接口生成代理实现类并注入容器：

```xml
<bean class="org.mybatis.spring.mapper.MapperScannerConfigurer">
    <property name="basePackage" value="com.example.mapper"/>
</bean>
```

配置后，所有 Mapper 接口可以直接在 Service 层 @Autowired 注入：

```java
@Service
public class AccountServiceImpl implements AccountService {
    @Autowired
    private AccountMapper accountMapper;  // 无需手动 getMapper()
}
```

### 事务管理器

```xml
<bean id="txManager" class="org.springframework.jdbc.datasource.DataSourceTransactionManager">
    <property name="dataSource" ref="dataSource"/>
</bean>
<!-- 开启注解驱动的事务 -->
<tx:annotation-driven transaction-manager="txManager"/>
```

## 7.4 完整 XML 配置示例

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:context="http://www.springframework.org/schema/context"
       xmlns:tx="http://www.springframework.org/schema/tx"
       xsi:schemaLocation="...">

    <context:component-scan base-package="com.example"/>
    <context:property-placeholder location="classpath:jdbc.properties"/>

    <bean id="dataSource" class="com.zaxxer.hikari.HikariDataSource">
        <property name="driverClassName" value="${jdbc.driver}"/>
        <property name="jdbcUrl"         value="${jdbc.url}"/>
        <property name="username"        value="${jdbc.username}"/>
        <property name="password"        value="${jdbc.password}"/>
    </bean>

    <bean class="org.mybatis.spring.SqlSessionFactoryBean">
        <property name="configLocation" value="classpath:mybatis-config.xml"/>
        <property name="dataSource"     ref="dataSource"/>
        <property name="typeAliasesPackage" value="com.example.entity"/>
    </bean>

    <bean class="org.mybatis.spring.mapper.MapperScannerConfigurer">
        <property name="basePackage" value="com.example.mapper"/>
    </bean>

    <bean id="txManager"
          class="org.springframework.jdbc.datasource.DataSourceTransactionManager">
        <property name="dataSource" ref="dataSource"/>
    </bean>
    <tx:annotation-driven transaction-manager="txManager"/>
</beans>
```

## 7.5 全注解配置（配置类方式）

```java
@Configuration
@ComponentScan("com.example")
@PropertySource("classpath:application.properties")
@EnableTransactionManagement
@EnableAspectJAutoProxy
@MapperScan("com.example.mapper")  // 等价于 MapperScannerConfigurer
public class SpringMyBatisConfig {

    @Bean
    public DataSource dataSource(
            @Value("${spring.datasource.driver}") String driver,
            @Value("${spring.datasource.url}")    String url,
            @Value("${spring.datasource.user}")   String user,
            @Value("${spring.datasource.password}") String password) {
        HikariDataSource ds = new HikariDataSource();
        ds.setDriverClassName(driver);
        ds.setJdbcUrl(url);
        ds.setUsername(user);
        ds.setPassword(password);
        return ds;
    }

    @Bean
    public SqlSessionFactoryBean sqlSessionFactory(
            DataSource dataSource,
            @Value("${mybatis.config.location}") String configLocation,
            @Value("${mybatis.type.aliases.package}") String aliasesPackage) {
        SqlSessionFactoryBean factoryBean = new SqlSessionFactoryBean();
        factoryBean.setConfigLocation(new ClassPathResource(configLocation));
        factoryBean.setDataSource(dataSource);
        factoryBean.setTypeAliasesPackage(aliasesPackage);
        return factoryBean;
    }

    @Bean
    public DataSourceTransactionManager transactionManager(DataSource dataSource) {
        return new DataSourceTransactionManager(dataSource);
    }
}
```

> SpringBoot 适配：SpringBoot + MyBatis 只需引入 `mybatis-spring-boot-starter`，自动完成 SqlSessionFactory、MapperScannerConfigurer 的配置。在配置文件中设置数据源信息和 `mybatis.mapper-locations`，在启动类或配置类上加 `@MapperScan` 指定 Mapper 包路径即可。整合复杂度远低于纯 Spring 手动配置。

> 坑点：
> - Mapper XML 文件必须放在与接口同名的 resources 子目录下（如 `resources/com/example/mapper/AccountMapper.xml`），且文件名与接口名一致，否则 MyBatis 找不到 SQL
> - `typeAliasesPackage` 配置的是实体类所在包，配置后 Mapper XML 中 `resultType` 可以直接写类名（不区分大小写）
> - 测试时务必验证事务是否生效：通过在业务方法中间故意抛出异常，检查数据库是否回滚

---

# 第八章 Spring 事务管理

## 8.1 事务基础知识

事务是数据库操作的最小工作单元，多条 DML 语句（INSERT/UPDATE/DELETE）要么全部成功提交，要么全部失败回滚，不允许部分成功的中间状态。

事务的四个特性（ACID）：
- **A 原子性**：事务是不可分割的最小单元
- **C 一致性**：事务前后数据总量保持一致，业务约束不被破坏
- **I 隔离性**：并发的事务互不干扰
- **D 持久性**：事务提交后的数据变更是永久性的

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

- `DataSourceTransactionManager`：适用于 JDBC / MyBatis / Hibernate（JDBC 事务）
- `JpaTransactionManager`：适用于 JPA 框架
- `JtaTransactionManager`：适用于分布式事务（多数据源）

使用 MyBatis 时，需要配置 `DataSourceTransactionManager` 并注入同一个数据源：（这两种方式都是使用@Transactional ）

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

- 加在类上：类中所有方法都开启事务
- 加在方法上：只有该方法开启事务（方法级注解会覆盖类级注解）

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
|----------|------|---------|
| REQUIRED（默认）| 有事务则加入，没有则新建 | 没有就新建，有就加入 |
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

### 隔离级别（isolation）

隔离级别控制并发事务之间的可见性，解决三类并发问题：

并发问题说明：
- **脏读**：读到了另一个事务尚未提交的数据（该事务后来回滚了）
- **不可重复读**：同一事务中两次读取同一行，结果不同（另一事务在两次读之间提交了修改）
- **幻读**：同一事务中两次执行相同查询，结果集行数不同（另一事务在两次读之间插入/删除了记录）

| 隔离级别 | 脏读 | 不可重复读 | 幻读 | 说明 |
|---------|------|----------|------|------|
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

### 只读事务（readOnly）

```java
@Transactional(readOnly = true)
public List<User> getAllUsers() {}
```

`readOnly = true` 的作用：
- 通知数据库驱动和 ORM 框架这是只读操作，可以跳过脏检查，减少不必要的锁和开销
- 在读写分离架构中，可作为路由信号将查询请求引导到从库
- 代码可读性提升，明确标注方法意图

注意：`readOnly = true` 通常是**提示**而非强制约束，误操作写数据在多数情况下不会直接报错（Hibernate 可能会在提交时报错）。不能依赖它来防止写操作。

### 异常回滚规则（rollbackFor / noRollbackFor）

Spring 事务的默认回滚规则：
- 遇到 `RuntimeException` 及其子类：**回滚**
- 遇到 `Error` 及其子类：**回滚**
- 遇到受检异常（Checked Exception，继承 Exception 但不继承 RuntimeException）：**不回滚**

修改回滚规则：

```java
// 让受检异常也触发回滚（实际开发中推荐这样设置）
@Transactional(rollbackFor = Exception.class)

// 让某个 RuntimeException 不触发回滚
@Transactional(noRollbackFor = NullPointerException.class)
```

> 最佳实践：统一使用 `@Transactional(rollbackFor = Exception.class)`，避免受检异常不回滚导致的数据不一致问题。

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

---

# 第九章 Spring 中的设计模式

Spring 框架自身大量运用了经典 GoF 设计模式，学习这些模式在 Spring 中的应用有助于深入理解框架原理。

## 9.1 GoF 23 种设计模式分类

| 分类 | 模式（共 23 种） |
|------|----------------|
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
- `BeanWrapper`：包装 Bean 实例，为其添加属性访问、类型转换等能力
- Spring 数据源中的 `TransactionAwareDataSourceProxy`：对普通数据源进行包装，增加事务感知能力
- Java IO 流本身就是装饰器模式（`BufferedInputStream` 包装 `FileInputStream`）

识别标志：**Spring 中类名包含 Decorator 或 Wrapper 的类，通常都是装饰器模式的实现。**

```java
BeanWrapper beanWrapper = new BeanWrapperImpl(targetObject);
beanWrapper.setPropertyValue("name", "张三");
```

### 观察者模式（事件机制）

Spring 的事件发布/监听机制就是观察者模式：
- 事件源（Publisher）发布事件
- 监听器（Listener）订阅并处理事件

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
- `JdbcTemplate`：封装了 JDBC 操作的固定流程（获取连接、创建语句、执行、处理结果集、关闭连接），将 SQL 编写和结果映射交给调用者实现
- `RestTemplate`：封装了 HTTP 请求的处理流程
- `AbstractApplicationContext#refresh()`：定义了容器刷新的整体流程，各步骤由子类实现

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
- `HandlerAdapter`（SpringMVC）：将各种类型的 Handler（`@RequestMapping` 方法、HttpRequestHandler、Servlet 等）统一适配为 `DispatcherServlet` 可以统一调用的接口
- `SpringMVC` 中的各种 Adapter 实现：`RequestMappingHandlerAdapter`、`HttpRequestHandlerAdapter`

### 责任链模式

责任链模式将请求的发送者和处理者解耦，多个处理器组成一条链，请求沿链传递直到被处理。

Spring 中的应用：
- `AOP` 的通知执行链：多个切面的通知按优先级形成一条执行链，`MethodInvocationInterceptor` 链式执行
- `SpringMVC` 的 `HandlerInterceptor` 拦截器链：preHandle → handler → postHandle → afterCompletion
- Spring Security 的过滤器链

---

